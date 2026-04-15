import { Router } from 'express';
import { createStockUnits,  deleteStockUnitsBulk, getStockUnitsByProduct, updateStockUnitExpiration } from '../../controllers/stock/stock.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

const router = Router();

// Define routes for store management
router.post('/', authMiddleware , createStockUnits); // Crear stock
router.get('/:productId/stockunits', authMiddleware, getStockUnitsByProduct); // Obtener stock units por producto
router.patch('/:id/expiration', authMiddleware, updateStockUnitExpiration); // Actualizar fecha de vencimiento de una unidad
router.delete('/', authMiddleware, deleteStockUnitsBulk); // Eliminar stock por IDs 


export default router;