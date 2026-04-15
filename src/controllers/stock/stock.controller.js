import { PrismaClient } from '@prisma/client';
import { logStockUnitMovement } from './stockUnitLogService.js'; 

const prisma = new PrismaClient();

/**
 * Endpoint para crear múltiples unidades de stock (StockUnit) de forma bulk.
 * Se espera que en el body se envíen:
 *  - productId: ID del producto
 *  - storeId: (opcional para admin, obligatorio para usuarios no admin)
 *  - quantity: Cantidad de unidades a crear
 *  - expirationDates: Arreglo de fechas de vencimiento para cada unidad
 *
 * Se asume que req.user contiene la información del usuario autenticado,
 * incluyendo su rol (por ejemplo, 'Administrador') y su tienda asignada (store).
 */
export const createStockUnits = async (req, res) => {
  try {
    // Extraer datos del body
    const { productId, storeId: bodyStoreId, quantity, expirationDates } = req.body;

    // Obtener información del token (req.user)
    const tokenStoreId = req.user?.store?.id;
    const userRole = req.user?.role; // Ejemplo: 'Admin', 'Asesor', etc.

    console.log('Datos del body:', req.body);
    console.log('Datos del token:', req.user);

    // Validar que se envíe productId y quantity
    if (!productId || !quantity) {
      return res.status(400).json({ message: 'Los campos productId y quantity son obligatorios' });
    }

    // Convertir a números
    const productIdNum = Number(productId);
    const quantityNum = Number(quantity);
    if (isNaN(productIdNum) || isNaN(quantityNum) || quantityNum < 1) {
      return res.status(400).json({ message: 'Datos numéricos inválidos para productId o quantity' });
    }

    // Validar que el producto exista
    const product = await prisma.product.findUnique({ where: { id: productIdNum } });
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Determinar la tienda a la que se asignará el stock
    let storeToUse;
    if (userRole !== 'Admin') {
      if (!tokenStoreId) {
        return res.status(400).json({ message: 'No se encontró la tienda asignada a tu usuario' });
      }
      if (bodyStoreId && Number(bodyStoreId) !== tokenStoreId) {
        return res.status(403).json({ message: 'No tienes permisos para crear stock en otra tienda' });
      }
      storeToUse = tokenStoreId;
    } else {
      if (bodyStoreId) {
        storeToUse = Number(bodyStoreId);
      } else if (tokenStoreId) {
        storeToUse = tokenStoreId;
      } else {
        return res.status(400).json({ message: 'Debe asignar una tienda para crear el stock' });
      }
    }

    // Validar que la tienda exista
    const store = await prisma.store.findUnique({ where: { id: Number(storeToUse) } });
    if (!store) {
      return res.status(404).json({ message: 'Tienda no encontrada' });
    }

    if (!store.isActive) {
      return res.status(400).json({ message: 'La tienda está inactiva' });
    }

    // Si el producto es perecedero, se debe enviar un array de fechas
    if (product.perishable) {
      if (!expirationDates || !Array.isArray(expirationDates) || expirationDates.length === 0) {
        return res.status(400).json({ message: 'El producto perecedero requiere un arreglo de fechas de vencimiento' });
      }
    }

    // Crear las unidades de stock según la cantidad solicitada
    const newStockUnits = [];
    for (let i = 0; i < quantityNum; i++) {
      // Para productos perecederos, se asigna la fecha correspondiente.
      // Si no se especifica una fecha para una unidad, se usa la primera fecha del arreglo.
      const dateStr = product.perishable 
        ? (expirationDates[i] || expirationDates[0])
        : null;

      const stockUnit = await prisma.stockunit.create({
        data: {
          productId: productIdNum,
          storeId: Number(storeToUse),
          expirationDate: dateStr ? new Date(dateStr) : null,
        },
      });
      newStockUnits.push(stockUnit);

      // Registrar el movimiento de stock unit
      await logStockUnitMovement({
        stockUnitId:    stockUnit.id,
        productId:      stockUnit.productId,
        storeId:        stockUnit.storeId,
        expirationDate: stockUnit.expirationDate,
        action:         'CREATE',
        userId:         req.user?.id ?? null,
      });
    }

    return res.status(201).json({
      message: 'Stock creado exitosamente',
      stockUnits: newStockUnits,
    });
  } catch (error) {
    console.error('Error creando stock:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};



/**
 * Obtiene todas las unidades de stock de un producto.
 * Se espera que el productId se pase como parámetro en la URL.
 *
 * Ruta: GET /stock/:productId/stockunits
 */
export const getStockUnitsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { storeId } = req.query; // Recibimos el storeId desde el query

    if (!productId || !storeId) {
      return res.status(400).json({ message: 'El productId y storeId son obligatorios' });
    }

    const stockUnits = await prisma.stockunit.findMany({
      where: { 
        productId: Number(productId),
        storeId: Number(storeId),
        sold: false, // Solo unidades no vendidas
        // saleitem: { none: {} },
      },
      include: {
        store: true,    // Incluye datos de la tienda
        product: true,  // Incluye datos del producto (opcional)
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.status(200).json(stockUnits);
  } catch (error) {
    console.error('Error obteniendo stock units:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

/**
 * Elimina múltiples unidades de stock.
 * Se espera que en el body se envíe:
 *  {
 *    ids: [array de números]
 *  }
 *
 * Ruta: DELETE /stock (se utiliza el body para enviar el arreglo de ids)
 */
export const deleteStockUnitsBulk = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Se debe proporcionar un arreglo de ids' });
    }

    // Obtener las unidades de stock a eliminar para registrar el movimiento
    const toDelete = await prisma.stockunit.findMany({
      where: { id: { in: ids.map(Number) } }
    });

    // Eliminar múltiples registros cuyo id esté en el arreglo
    const deleted = await prisma.stockunit.deleteMany({
      where: {
        id: { in: ids.map(Number) },
      },
    });

    // Logear cada movimiento de eliminación
    for (const su of toDelete) {
      await logStockUnitMovement({
        stockUnitId:    su.id,
        productId:      su.productId,
        storeId:        su.storeId,
        expirationDate: su.expirationDate,
        action:         'DELETE',
        userId:         req.user?.id ?? null,
      });
    }

    return res.status(200).json({
      message: 'Stock eliminado exitosamente',
      deletedCount: deleted.count, // Cantidad de registros eliminados
    });
  } catch (error) {
    console.error('Error eliminando stock units:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

/**
 * Actualiza la fecha de vencimiento de una unidad de stock.
 * Se espera que el id de la unidad de stock se pase como parámetro en la URL,
 * y la nueva fecha de vencimiento en el body de la solicitud.
 *
 * Ruta: PATCH /stock/stockunits/:id/expiration
 */
export const updateStockUnitExpiration = async (req, res) => {
  try {
    const { id } = req.params;
    const { expirationDate } = req.body;

    console.log('Datos recibidos para actualización:', { id, expirationDate });

    if (!id) {
      return res.status(400).json({ message: 'El id de la unidad de stock es obligatorio' });
    }

    // Permite null para limpiar fecha si el producto deja de ser perecedero
    let newDate = null;
    if (expirationDate !== undefined && expirationDate !== null && `${expirationDate}`.trim() !== '') {
      const parsed = new Date(expirationDate);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ message: 'Fecha de vencimiento inválida' });
      }
      newDate = parsed;
    }

    console.log('Nueva fecha de vencimiento:', newDate);
    // Verificar que exista
    const existing = await prisma.stockunit.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return res.status(404).json({ message: 'Stock unit no encontrada' });
    }

    // No permitir editar si ya fue vendida
    if (existing.sold) {
      return res.status(400).json({ message: 'No se puede editar la fecha de una unidad ya vendida' });
    }

    const updated = await prisma.stockunit.update({
      where: { id: Number(id) },
      data: { expirationDate: newDate },
    });

    // Log del movimiento
    await logStockUnitMovement({
      stockUnitId: updated.id,
      productId: updated.productId,
      storeId: updated.storeId,
      expirationDate: updated.expirationDate,
      action: 'UPDATE_EXPIRATION',
      userId: req.user?.id ?? null,
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error actualizando fecha de vencimiento:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};