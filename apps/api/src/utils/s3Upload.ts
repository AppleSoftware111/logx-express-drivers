import { randomUUID } from 'crypto';

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Multer } from 'multer';
import multer from 'multer';

import { POD_ALLOWED_MIME_TYPES, POD_MAX_FILE_SIZE_BYTES, S3_PRESIGNED_URL_EXPIRES_SECONDS } from '@logx/shared';

import { S3_BUCKET, s3Client } from '../config/s3';

export const podUpload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: POD_MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if ((POD_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

export async function uploadFileToS3(
  buffer: Buffer,
  mimeType: string,
  folder: 'pod-photos' | 'pod-signatures'
): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const key = `${folder}/${randomUUID()}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256',
    })
  );

  return key;
}

export async function getPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3Client, command, {
    expiresIn: S3_PRESIGNED_URL_EXPIRES_SECONDS,
  });
}

