import { Router } from 'express';
import { getAllProducts, createProduct, updateProduct, deleteProduct, getProductById, getExpiringPerishablesByStore, getProductByBarcode, generateBarcode } from '../../controllers/product/product.controller.js';
// Productos perecederos próximos a vencer por tienda

import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { permitMiddleware } from '../../middlewares/permit.js';
import upload from '../../middlewares/multerConfig.js';

const router = Router();

// Endpoint de productos próximos a vencer por tienda (debe ir antes de /:id para evitar conflicto)
router.get('/expiring-perishables-by-store', authMiddleware, permitMiddleware('admin', 'asesor', 'moderador'), getExpiringPerishablesByStore);

// Endpoint para generar código de barras automático
router.get('/generate-barcode', authMiddleware, permitMiddleware('admin', 'asesor', 'moderador'), generateBarcode);

// Endpoint para buscar producto por código de barras
router.get('/barcode/:barcode', authMiddleware, permitMiddleware('admin', 'asesor', 'moderador'), getProductByBarcode);

// Define routes for role management
router.get('/', authMiddleware, permitMiddleware('admin', 'asesor', 'moderador'), getAllProducts); // Get all
router.get('/:id', authMiddleware, permitMiddleware('admin', 'asesor', 'moderador'), getProductById); // Get  by ID
router.post( '/', authMiddleware, permitMiddleware('admin', 'asesor', 'moderador'), upload('products').single('productImage'), createProduct ); // Create a new
router.patch( '/:id', authMiddleware, permitMiddleware('admin', 'asesor', 'moderador'), upload('products').single('productImage'), updateProduct ); // Update  by ID
router.delete('/:id', authMiddleware, permitMiddleware('admin', 'asesor', 'moderador'), deleteProduct); // Delete  by ID

export default router;
