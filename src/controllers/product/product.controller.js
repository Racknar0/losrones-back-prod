import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const isLocalUploadPath = (filePath) => {
  return typeof filePath === 'string' && /^uploads[\\/]/.test(filePath);
};

const deleteLocalUploadFile = (relativePath) => {
  if (!isLocalUploadPath(relativePath)) {
    return;
  }

  try {
    const absolutePath = path.join(process.cwd(), relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    console.error(`Error eliminando archivo ${relativePath}:`, error);
  }
};

// Crear un nuevo producto
export const createProduct = async (req, res) => {
    const { name, code, barcode, categoryId, purchasePrice, salePrice, perishable, hasTax } = req.body;
    
    // Se guarda la ruta completa del archivo
    const image = req.file ? req.file.path : null;
  
    console.log("✅CREANDO PRODUCTO ------->")
    console.log(req.body)
    console.log(image);
    console.log("<------------------------>")

    // Convertir valores string a los tipos adecuados
    const categoryIdNum = parseInt(categoryId);
    const purchasePriceNum = parseFloat(purchasePrice);
    const salePriceNum = parseFloat(salePrice);
    const isPerishable = perishable === 'true' || perishable === true;
    const includesTax  = hasTax === 'true' || hasTax === true;
  
    // Validar campos obligatorios
    if (
      !name ||
      !code ||
      isNaN(categoryIdNum) ||
      isNaN(purchasePriceNum) ||
      isNaN(salePriceNum)
    ) {
      return res.status(400).json({ message: 'Faltan campos obligatorios o hay datos inválidos' });
    }
  
    try {
      // Verificar que no exista otro producto con el mismo código
      const existingProduct = await prisma.product.findUnique({
        where: { code },
      });
  
      if (existingProduct) {
        return res.status(404).json({ message: 'Ya existe un producto con este código' });
      }

      // Si se proporciona un código de barras, verificar que sea único
      if (barcode) {
        const existingBarcode = await prisma.product.findUnique({
          where: { barcode },
        });
  
        if (existingBarcode) {
          return res.status(404).json({ message: 'Ya existe un producto con este código de barras' });
        }
      }
  
      // Crear el producto en la base de datos
      const product = await prisma.product.create({
        data: {
          name: name.toLowerCase(),
          code: code.toUpperCase(),
          barcode: barcode || null,
          categoryId: categoryIdNum,
          purchasePrice: purchasePriceNum,
          salePrice: salePriceNum,
          status: 'active',
          image,
          perishable: isPerishable,
          hasTax: includesTax,
        },
      });
  
      return res.status(201).json({ message: 'Producto creado', product });
    } catch (error) {
      console.error('Error al crear producto:', error);
      return res.status(500).json({ message: 'Error del servidor' });
    }
  };
  

// Obtener todos los productos, filtrando stock por tienda (storeId es obligatorio)
export const getAllProducts = async (req, res) => {
  try {
    // Verifica que storeId esté presente en la query
    const storeIdParam = req.query.storeId;
    if (!storeIdParam) {
      return res.status(400).json({ message: "El parámetro 'storeId' es obligatorio" });
    }

    // Convertir el storeId a número y validar que sea correcto
    const storeId = parseInt(storeIdParam);
    if (isNaN(storeId)) {
      return res.status(400).json({ message: "El parámetro 'storeId' debe ser un número válido" });
    }

    // Buscar productos incluyendo stockunit filtrado por la tienda proporcionada
    const products = await prisma.product.findMany({
      include: {
        category: true,
        stockunit: {
          where: { 
            storeId,
            sold: false, // Solo stock no vendido
          },
          include: {
            store: true, // Incluimos la info de la tienda
            product: true, // Incluimos la info del producto
          },
        },
      },
      orderBy: [
        {
          category: {
            name: 'asc', // Ordena por categoría alfabéticamente
          },
        },
        {
          name: 'asc', // Luego por nombre de producto
        },
      ],
    });

    return res.status(200).json(products);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};


// Obtener un producto por ID
export const getProductById = async (req, res) => {
    const { id } = req.params;

    try {
        const product = await prisma.product.findUnique({
            where: { id: Number(id) },
            include: {
                category: true,
            },
        });

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        return res.status(200).json(product);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        return res.status(500).json({ message: 'Error del servidor' });
    }
};


export const updateProduct = async (req, res) => {
  const { id } = req.params;

  console.log("✅ACTUALIZANDO PRODUCTO ------->");
  console.log(req.body);
  console.log("<------------------------>");

  if (isNaN(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const { name, code, barcode, categoryId, purchasePrice, salePrice, perishable, status, hasTax  } = req.body;

  // Si se envía un archivo, se captura la ruta completa de la nueva imagen.
  const newImage = req.file ? req.file.path : undefined;

  try {
    // Buscar el producto existente.
    const existing = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Normalizamos el código para la comparación (en este caso se usa mayúsculas)
    const normalizedNewCode = code.toUpperCase();

    // Solo se valida la unicidad si se está cambiando el código
    if (existing.code !== normalizedNewCode) {
      const duplicate = await prisma.product.findFirst({
        where: {
          code: normalizedNewCode,
          id: { not: parseInt(id) }, // Excluimos el producto que se está actualizando
        },
      });
      if (duplicate) {
        return res.status(400).json({ message: 'El código ya está en uso por otro producto' });
      }
    }

    // Validar unicidad del código de barras si se proporciona
    if (barcode && existing.barcode !== barcode) {
      const duplicateBarcode = await prisma.product.findFirst({
        where: {
          barcode: barcode,
          id: { not: parseInt(id) },
        },
      });
      if (duplicateBarcode) {
        return res.status(400).json({ message: 'El código de barras ya está en uso por otro producto' });
      }
    }

    // Si hay una nueva imagen y ya existe una almacenada, eliminamos la anterior
    if (newImage && existing.image) {
      const imagePath = path.join(process.cwd(), existing.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    const includesTax = hasTax === 'true' || hasTax === true;

    // Realizamos la actualización del producto
    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name: name.toLowerCase(),
        code: normalizedNewCode,
        barcode: barcode || undefined,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        salePrice: salePrice ? parseFloat(salePrice) : undefined,
        perishable: perishable !== undefined ? perishable === 'true' : undefined,
        image: newImage || undefined, // Si no hay nueva imagen se conserva la anterior
        hasTax: hasTax !== undefined ? includesTax : undefined,
        status: status || 'active',
      },
    });

    return res.status(200).json({
      message: 'Producto actualizado con éxito',
      product: updated,
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    // En caso de error de clave única que no hayamos capturado previamente, se puede capturar aquí.
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'El código ya está en uso por otro producto' });
    }
    return res.status(500).json({ message: 'Error del servidor' });
  }
};


// Eliminar un producto
export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
      include: {
        storeItem: {
          select: {
            image: true,
            gallery: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const filesToDelete = new Set();
    if (product.image) filesToDelete.add(product.image);
    if (product.storeItem?.image) filesToDelete.add(product.storeItem.image);

    if (Array.isArray(product.storeItem?.gallery)) {
      product.storeItem.gallery
        .map((entry) => String(entry))
        .filter(Boolean)
        .forEach((entry) => filesToDelete.add(entry));
    }

    // Eliminar producto de la base de datos
    await prisma.product.delete({
      where: { id: Number(id) },
    });

    // Eliminar archivos en disco después del borrado en BD
    filesToDelete.forEach((filePath) => deleteLocalUploadFile(filePath));

    return res.status(200).json({ message: 'Producto eliminado' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

  
// Endpoint: productos perecederos no vendidos próximos a vencer por tienda
export const getExpiringPerishablesByStore = async (req, res) => {
  try {
    console.log("✅INICIANDO OBTENCIÓN DE PRODUCTOS PERECEDEROS POR TIENDA ------->");
    // Obtener todas las tiendas
    const stores = await prisma.store.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    const today = new Date();
    const fifteenDaysLater = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);

    // Para cada tienda, buscar productos perecederos no vendidos próximos a vencer
    const results = await Promise.all(
      stores.map(async (store) => {
        // Buscar stockunits no vendidos, perecederos, con vencimiento <= 15 días
        const stockunits = await prisma.stockunit.findMany({
          where: {
            storeId: store.id,
            sold: false,
            expirationDate: {
              gte: today,
              lte: fifteenDaysLater,
            },
            product: {
              perishable: true,
            },
          },
          include: {
            product: true,
          },
        });

        // Agrupar por producto y contar unidades
        const productsMap = {};
        stockunits.forEach((unit) => {
          const prodId = unit.product.id;
          if (!productsMap[prodId]) {
            productsMap[prodId] = {
              id: prodId,
              name: unit.product.name,
              code: unit.product.code,
              expirationDate: unit.expirationDate,
              salePrice: unit.product.salePrice,
              stockunitCount: 1,
            };
          } else {
            // Mantener la fecha de vencimiento más próxima
            if (new Date(unit.expirationDate) < new Date(productsMap[prodId].expirationDate)) {
              productsMap[prodId].expirationDate = unit.expirationDate;
            }
            productsMap[prodId].stockunitCount += 1;
          }
        });

        return {
          storeName: store.name,
          products: Object.values(productsMap).sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate)).slice(0, 5),
        };
      })
    );

    res.status(200).json(results);
  } catch (error) {
    console.error('Error al obtener productos próximos a vencer por tienda:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// Buscar producto por código de barras
export const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const { storeId } = req.query;

    if (!barcode) {
      return res.status(400).json({ message: 'El código de barras es requerido' });
    }

    if (!storeId) {
      return res.status(400).json({ message: 'El ID de la tienda es requerido' });
    }

    const product = await prisma.product.findUnique({
      where: { barcode },
      include: {
        category: true,
        stockunit: {
          where: { 
            storeId: parseInt(storeId),
            sold: false, // Solo stock no vendido
          },
          include: {
            store: true,
            product: true,
          },
          orderBy: { 
            expirationDate: 'asc' // Para productos perecederos, el más próximo a vencer primero
          }
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado con ese código de barras' });
    }

    // Verificar si hay stock disponible
    if (product.stockunit.length === 0) {
      return res.status(404).json({ 
        message: 'Producto encontrado pero sin stock disponible',
        product: {
          id: product.id,
          name: product.name,
          code: product.code,
          barcode: product.barcode,
          salePrice: product.salePrice
        }
      });
    }

    return res.status(200).json(product);
  } catch (error) {
    console.error('Error al buscar producto por código de barras:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

// Generar código de barras automático
export const generateBarcode = async (req, res) => {
  try {
    // Generar un código de barras único basado en timestamp y random
    let barcode;
    let exists = true;

    while (exists) {
      // Formato: LLYYYYMMDDHHMMSS donde LL = Los Rones, Y=año, M=mes, D=día, H=hora, M=minuto, S=segundo
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hour = now.getHours().toString().padStart(2, '0');
      const minute = now.getMinutes().toString().padStart(2, '0');
      const second = now.getSeconds().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');

      barcode = `LR${year}${month}${day}${hour}${minute}${second}${random}`;

      // Verificar si ya existe
      const existingProduct = await prisma.product.findUnique({
        where: { barcode },
      });

      exists = !!existingProduct;
    }

    return res.status(200).json({ barcode });
  } catch (error) {
    console.error('Error al generar código de barras:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};