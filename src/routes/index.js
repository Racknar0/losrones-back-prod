import express from 'express';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './users/user.routes.js';
import roleRoutes from './role/role.routes.js'; 
import storeRoutes from './stores/stores.routes.js';
import categoryRoutes from './category/category.routes.js';
import productRoutes from './product/product.routes.js'
import sotckRoutes from './stock/stock.routes.js'
import saleRoutes from './sale/sale.routes.js'
import couponRoutes from './coupon/coupon.routes.js';
import movementRoutes from './movement/movement.routes.js';
import cortesRoutes from './cortes/cortes.routes.js';
import storeItemsRoutes from './store-items/store-items.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes); 
router.use('/stores', storeRoutes);
router.use('/category', categoryRoutes);
router.use('/product', productRoutes);
router.use('/stock', sotckRoutes);
router.use('/sale', saleRoutes);
router.use('/coupons', couponRoutes);
router.use('/movements', movementRoutes);
router.use('/cortes', cortesRoutes);
router.use('/store-items', storeItemsRoutes);


export default router;