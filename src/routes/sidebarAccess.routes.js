import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { superadminOnly, getMySidebar, getSidebarSettings, saveSidebarSettings } from '../controllers/sidebarAccess.controller.js';
const router = Router();
router.get('/mine', protect, getMySidebar);
router.get('/', protect, superadminOnly, getSidebarSettings);
router.put('/:role', protect, superadminOnly, saveSidebarSettings);
export default router;
