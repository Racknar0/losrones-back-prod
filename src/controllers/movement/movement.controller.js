// controllers/movimientosController.js

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

/**
 * POST /movements/filter
 * Body: { storeId: number, startDate: string (ISO), endDate: string (ISO) }
 * Devuelve todos los stockUnitLog de esa tienda en el rango de fechas.
 */
export const getMovementsByStoreWithDates = async (req, res) => {
  try {
    const { storeId, startDate, endDate } = req.body

    // 1) Validaciones básicas
    if (!storeId) {
      return res.status(400).json({ message: 'storeId es obligatorio' })
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate y endDate son obligatorios' })
    }

    // Parseamos las fechas ISO
    const startISO = new Date(startDate)
    const endISO   = new Date(endDate)
    if (isNaN(startISO.getTime()) || isNaN(endISO.getTime())) {
      return res.status(400).json({ message: 'Fechas inválidas' })
    }

    // 2) Construimos el filtro base
    const filtro = {
      storeId: Number(storeId),
      createdAt: {}  // lo completaremos abajo
    }

    // 3) Detectamos si ambas caen en el mismo YYYY-MM-DD
    //    (comparando solo la parte '2025-06-04' de cada ISO)
    const fechaSoloStart = startDate.split('T')[0]  // p.ej. "2025-06-04"
    const fechaSoloEnd   = endDate.split('T')[0]    // p.ej. "2025-06-04"
    if (fechaSoloStart === fechaSoloEnd) {
      // Ambas son el mismo día de calendario → extendemos para cubrir TODO ese día *según hora local*.

      // 3a) Convertimos "2025-06-04" a (año,mes,día) numéricos
      const [yy, mm, dd] = fechaSoloStart.split('-').map(Number)
      
      // 3b) Creamos el inicio del día en hora local: 2025-06-04 00:00:00.000 (local)
      const inicioLocal = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
      
      // 3c) Creamos el fin del día en hora local: 2025-06-04 23:59:59.999 (local)
      const finLocal = new Date(yy, mm - 1, dd, 23, 59, 59, 999)

      filtro.createdAt = {
        gte: inicioLocal,
        lte: finLocal
      }
    } else {
      // Son fechas distintas o con horas distintas → respetamos exactamente los instantes ISO que enviaste
      filtro.createdAt = {
        gte: startISO,
        lte: endISO
      }
    }

    // 4) Ejecutar la consulta
    const logs = await prisma.stockUnitLog.findMany({
      where: filtro,
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        store:   { select: { id: true, name: true } },
        user:    { select: { id: true, name: true, lastName: true, user: true } }
      }
    })

    return res.status(200).json(logs)
  } catch (error) {
    console.error('Error obteniendo movimientos:', error)
    return res.status(500).json({ message: 'Error del servidor' })
  }
}
