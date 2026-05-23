import { Router } from 'express';
import type { Request, Response } from 'express';

import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AppError } from '../../middleware/errorHandler';
import { uploadLimiter } from '../../middleware/rateLimiter';
import { sendSuccess } from '../../utils/apiResponse';
import { getPresignedUrl, podUpload, uploadFileToS3 } from '../../utils/s3Upload';
import { savePodToStop } from '../executions/execution.service';

const router = Router();

router.use(authenticate);
router.use(uploadLimiter);

router.post(
  '/:executionId/stops/:stopId',
  podUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    const photoFile = files?.photo?.[0];
    const signatureFile = files?.signature?.[0];

    if (!photoFile && !signatureFile) {
      throw new AppError('At least one file (photo or signature) is required', 400);
    }

    let photoKey: string | undefined;
    let signatureKey: string | undefined;

    if (photoFile) {
      photoKey = await uploadFileToS3(
        photoFile.buffer,
        photoFile.mimetype,
        'pod-photos'
      );
    }

    if (signatureFile) {
      signatureKey = await uploadFileToS3(
        signatureFile.buffer,
        signatureFile.mimetype,
        'pod-signatures'
      );
    }

    const stop = await savePodToStop(
      req.user!.companyId,
      req.params.executionId,
      req.params.stopId,
      photoKey,
      signatureKey
    );

    return sendSuccess(res, stop);
  })
);

router.get(
  '/presigned',
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.query.key as string;
    if (!key) throw new AppError('key query parameter is required', 400);

    const url = await getPresignedUrl(key);
    return sendSuccess(res, { url });
  })
);

export default router;
