import { Router } from 'express';

import { loginSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';
import { validateBody } from '../../middleware/validate';
import { login, logout, me, refresh } from './auth.controller';

const router = Router();

router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

export default router;
