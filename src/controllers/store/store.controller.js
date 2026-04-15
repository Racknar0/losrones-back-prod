import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


// Obtener todas las tiendas
export const getStores = async (req, res) => {
  try {
    const includeInactive =
      req.query?.includeInactive === '1' ||
      req.query?.includeInactive === 'true' ||
      req.query?.includeInactive === 'yes';

    const stores = await prisma.store.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    return res.status(500).json({ message: "Error al obtener las tiendas" });
  }
};