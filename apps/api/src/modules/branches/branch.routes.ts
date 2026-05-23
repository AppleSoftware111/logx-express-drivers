import { Router } from 'express';

import { UserRole, createBranchSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  deleteBranchController,
  getBranches,
  getSingleBranch,
  patchBranch,
  postBranch,
} from './branch.controller';

const router = Router();

router.use(authenticate);

router.get('/', getBranches);
router.get('/:id', getSingleBranch);
router.post('/', requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), validateBody(createBranchSchema), postBranch);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), patchBranch);
router.delete('/:id', requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteBranchController);

export default router;
