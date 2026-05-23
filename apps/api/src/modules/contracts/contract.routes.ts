import { Router } from 'express';

import { UserRole, createContractSchema, updateContractSchema } from '@logx/shared';

import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validateBody } from '../../middleware/validate';
import {
  deleteContract,
  getContracts,
  getSingleContract,
  patchContract,
  postContract,
} from './contract.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.OPERATOR, UserRole.SUPER_ADMIN));

router.get('/', getContracts);
router.get('/:id', getSingleContract);
router.post('/', validateBody(createContractSchema), postContract);
router.patch('/:id', validateBody(updateContractSchema), patchContract);
router.delete('/:id', requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), deleteContract);

export default router;
