import { Router } from 'express';

import { UserRole, createCompanySchema, updateCompanySchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  deleteCompany,
  getCompanies,
  getSingleCompany,
  patchCompany,
  postCompany,
} from './company.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(UserRole.SUPER_ADMIN), getCompanies);
router.get('/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), getSingleCompany);
router.post('/', requireRole(UserRole.SUPER_ADMIN), validateBody(createCompanySchema), postCompany);
router.patch(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN),
  validateBody(updateCompanySchema),
  patchCompany
);
router.delete('/:id', requireRole(UserRole.SUPER_ADMIN), deleteCompany);

export default router;
