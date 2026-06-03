import { Router } from 'express';

import { loginSchema, updateUserPreferencesSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';
import { validateBody } from '../../middleware/validate';
import { login, logout, me, refresh, updatePreferences } from './auth.controller';

const router = Router();

router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.patch('/me/preferences', authenticate, validateBody(updateUserPreferencesSchema), updatePreferences);

export default router;
