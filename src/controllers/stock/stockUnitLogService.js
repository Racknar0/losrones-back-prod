// stockUnitLogService.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Registra un movimiento de StockUnit
 */


export async function logStockUnitMovement({
  stockUnitId,
  productId = null,
  storeId = null,
  expirationDate = null,
  action,
  userId = null,
}) {
  await prisma.stockUnitLog.create({
    data: {
      stockUnitId,
      productId,
      storeId,
      expirationDate,
      action,
      userId,
    },
  });
}