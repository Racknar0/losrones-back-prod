import { Router } from 'express';

import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { getMovementsByStoreWithDates } from '../../controllers/movement/movement.controller.js';


const router = Router();

// Define routes for store management
router.post('/filter', authMiddleware,  getMovementsByStoreWithDates);

export default router;