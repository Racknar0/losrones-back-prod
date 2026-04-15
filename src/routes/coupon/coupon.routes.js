import { Router } from 'express';

import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { createCoupon, deleteCoupon, getCoupons } from '../../controllers/coupon/coupon.controller.js';

const router = Router();

// Define routes for store management
router.post('/', createCoupon);
router.get('/', getCoupons);
router.delete('/:id', deleteCoupon);

export default router;