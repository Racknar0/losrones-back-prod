import { Router } from 'express';
import { register, login } from '../../controllers/auth/auth.controller.js';

const router = Router();

// Registro de usuario
// router.post('/register', register);

// Inicio de sesión
router.post('/login', login);



export default router;