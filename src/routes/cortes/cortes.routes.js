import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { permitMiddleware } from '../../middlewares/permit.js';
import { createTodayCorte, deleteTodayCorte, getDailyCorte, getCortesByRange, generateCortePDF } from '../../controllers/cortes/cortes.controller.js';

const router = Router();


router.post('/', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), createTodayCorte); // Create today's corte 
router.delete('/', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), deleteTodayCorte); // Delete today's corte
router.get('/summary', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), getDailyCorte); // Get daily summary
router.post('/range', authMiddleware,  permitMiddleware('admin', 'asesor', 'moderador'), getCortesByRange); // Get cortes by range

router.get( '/generate-pdf/:id', generateCortePDF ); // Generate PDF for a specific corte by ID

export default router;
