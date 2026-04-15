import { Router } from 'express';
import { getStores } from '../../controllers/store/store.controller.js';

const router = Router();

// Define routes for store management
router.get('/', getStores); // Get all stores


export default router;