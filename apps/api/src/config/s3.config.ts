import { registerAs } from '@nestjs/config';

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export const s3Config = registerAs<S3Config>('s3', (): S3Config => ({
  endpoint: process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  accessKey: process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minio_admin',
  secretKey: process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'change-me-minio',
  bucket: process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'teacher-workspace',
  region: process.env.S3_REGION || 'us-east-1',
}));
