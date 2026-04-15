import { Router } from 'express';
import { createUser, deleteUser, getUserById, getUsers, updateUser, } from '../../controllers/user/user.controller.js';
import upload from '../../middlewares/multerConfig.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { permitMiddleware } from '../../middlewares/permit.js';

const router = Router();

router.get('/', authMiddleware, permitMiddleware('admin'), getUsers);
router.get('/:id', authMiddleware, permitMiddleware('admin'), getUserById);
router.post( '/', authMiddleware, permitMiddleware('admin'), upload('profiles').single('profilePicture'), createUser );
router.patch( '/:id', authMiddleware, permitMiddleware('admin'), upload('profiles').single('profilePicture'), updateUser ); 
router.delete('/:id', authMiddleware, permitMiddleware('admin'), deleteUser);

export default router;
