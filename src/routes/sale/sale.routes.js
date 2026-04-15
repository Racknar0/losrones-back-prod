import { Router } from 'express';
import { createSale, filterSalesByDate, generateSalePDF, listSales, deleteSale } from '../../controllers/sale/sale.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

const router = Router();

// Define routes for store management
router.post('/', authMiddleware , createSale); // Get all stores

// New route to generate the PDF of the sale
router.get('/generate-pdf/:id', generateSalePDF);
router.get('/', authMiddleware , listSales);
router.post('/filter', authMiddleware , filterSalesByDate);
router.delete('/:id',  deleteSale);

export default router;