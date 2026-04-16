import { Router } from 'express';
import {
  createFavoriteBlockCategory,
  createStoreNews,
  createStoreCategory,
  createStoreItemsFromProducts,
  deleteFavoriteBlockCategory,
  deleteStoreNews,
  deleteStoreCategory,
  deleteStoreItem,
  getFavoriteBlockCategories,
  getStoreNews,
  getProductsForFavoriteBlockCategory,
  getSourceProductsForStoreItems,
  getStoreCategories,
  getStoreItems,
  getHighlightBlock,
  getPublicHighlightBlock,
  getPublicFavoriteBlockCategories,
  getPublicFavoriteProducts,
  getPublicStoreNews,
  getPublicStoreCategories,
  getPublicStoreItems,
  updateStoreNews,
  updateFavoriteBlockCategoryProducts,
  updateStoreCategory,
  updateStoreItem,
  updateHighlightBlock,
} from '../../controllers/store/storeItems.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { permitMiddleware } from '../../middlewares/permit.js';
import upload from '../../middlewares/multerConfig.js';

const router = Router();

router.get('/public/favorites/categories', getPublicFavoriteBlockCategories);
router.get('/public/favorites/products', getPublicFavoriteProducts);
router.get('/public/highlight-block', getPublicHighlightBlock);
router.get('/public/news', getPublicStoreNews);
router.get('/public/categories', getPublicStoreCategories);
router.get('/public/products', getPublicStoreItems);

router.get('/products-source', authMiddleware, permitMiddleware('admin', 'moderador'), getSourceProductsForStoreItems);
router.post('/bulk-create', authMiddleware, permitMiddleware('admin', 'moderador'), createStoreItemsFromProducts);

router.get('/categories', authMiddleware, permitMiddleware('admin', 'moderador'), getStoreCategories);
router.post('/categories', authMiddleware, permitMiddleware('admin', 'moderador'), createStoreCategory);
router.patch('/categories/:id', authMiddleware, permitMiddleware('admin', 'moderador'), updateStoreCategory);
router.delete('/categories/:id', authMiddleware, permitMiddleware('admin', 'moderador'), deleteStoreCategory);

router.get('/favorites/categories', authMiddleware, permitMiddleware('admin', 'moderador'), getFavoriteBlockCategories);
router.post('/favorites/categories', authMiddleware, permitMiddleware('admin', 'moderador'), createFavoriteBlockCategory);
router.delete('/favorites/categories/:id', authMiddleware, permitMiddleware('admin', 'moderador'), deleteFavoriteBlockCategory);
router.get('/favorites/categories/:id/products', authMiddleware, permitMiddleware('admin', 'moderador'), getProductsForFavoriteBlockCategory);
router.patch('/favorites/categories/:id/products', authMiddleware, permitMiddleware('admin', 'moderador'), updateFavoriteBlockCategoryProducts);

router.get('/highlight-block', authMiddleware, permitMiddleware('admin', 'moderador'), getHighlightBlock);
router.patch('/highlight-block', authMiddleware, permitMiddleware('admin', 'moderador'), upload('products').single('highlightImage'), updateHighlightBlock);

router.get('/news', authMiddleware, permitMiddleware('admin', 'moderador'), getStoreNews);
router.post('/news', authMiddleware, permitMiddleware('admin', 'moderador'), upload('products').single('newsImage'), createStoreNews);
router.patch('/news/:id', authMiddleware, permitMiddleware('admin', 'moderador'), upload('products').single('newsImage'), updateStoreNews);
router.delete('/news/:id', authMiddleware, permitMiddleware('admin', 'moderador'), deleteStoreNews);

router.get('/', authMiddleware, permitMiddleware('admin', 'moderador'), getStoreItems);
router.patch('/:id', authMiddleware, permitMiddleware('admin', 'moderador'), upload('products').array('storeImages', 15), updateStoreItem);
router.delete('/:id', authMiddleware, permitMiddleware('admin', 'moderador'), deleteStoreItem);

export default router;
