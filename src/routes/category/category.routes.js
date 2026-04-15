import { Router } from 'express';
import { createCategory, getCategoryById, deleteCategory, updateCategory, getCategories } from '../../controllers/categoria/categoria.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { permitMiddleware } from '../../middlewares/permit.js';

const router = Router();

// Define routes for role management
router.get('/', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), getCategories); // Get all categories
router.get('/:id', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), getCategoryById); // Get categorie by ID
router.post('/', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), createCategory); // Create a new categorie
router.patch('/:id', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), updateCategory); // Update a categorie by ID
router.delete('/:id', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), deleteCategory); // Delete a categorie by ID

export default router;
