import { Router } from 'express';
import { getRoles, createRole, updateRole, deleteRole, getRoleById, } from '../../controllers/role/role.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { permitMiddleware } from '../../middlewares/permit.js';

const router = Router();

// Define routes for role management
router.get('/', authMiddleware, permitMiddleware('admin'), getRoles); // Get all roles
router.get('/:id', authMiddleware, permitMiddleware('admin'), getRoleById); // Get roles by ID
router.post('/', authMiddleware, permitMiddleware('admin'), createRole); // Create a new role
router.patch('/:id', authMiddleware, permitMiddleware('admin'), updateRole); // Update a role by ID
router.delete('/:id', authMiddleware, permitMiddleware('admin'), deleteRole); // Delete a role by ID

export default router;
