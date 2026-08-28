import { Global, Module, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigType } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { s3Config } from '../../config/s3.config';

export const S3_CLIENT = Symbol('S3_CLIENT');
export const S3_BUCKET_TOKEN = Symbol('S3_BUCKET');

/**
 * MinIO / S3-compatible object storage module.
 *
 * Usage:
 *   @Inject(S3_CLIENT) private readonly s3: Minio.Client
 *   @Inject(S3_BUCKET_TOKEN) private readonly bucket: string
 */
@Global()
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      useFactory: (cfg: ConfigType<typeof s3Config>) => {
        const url = new URL(cfg.endpoint);
        const useSSL = url.protocol === 'https:';
        const portStr = url.port;
        const port = portStr
          ? Number(portStr)
          : useSSL
            ? 443
            : 9000;
        return new Minio.Client({
          endPoint: url.hostname,
          port,
          useSSL,
          accessKey: cfg.accessKey,
          secretKey: cfg.secretKey,
          region: cfg.region,
        });
      },
      inject: [s3Config.KEY],
    },
    {
      provide: S3_BUCKET_TOKEN,
      useFactory: (cfg: ConfigType<typeof s3Config>) => cfg.bucket,
      inject: [s3Config.KEY],
    },
    StorageModule,
  ],
  exports: [S3_CLIENT, S3_BUCKET_TOKEN, StorageModule],
})
export class StorageModule implements OnModuleInit {
  constructor(
    @Inject(S3_CLIENT) private readonly s3: Minio.Client,
    @Inject(S3_BUCKET_TOKEN) private readonly bucket: string,
  ) {}

  async onModuleInit() {
    try {
      const exists = await this.s3.bucketExists(this.bucket);
      if (!exists) {
        await this.s3.makeBucket(this.bucket, 'us-east-1');
        Logger.log(`S3 bucket "${this.bucket}" created`, StorageModule.name);
      } else {
        Logger.log(`S3 bucket "${this.bucket}" ready`, StorageModule.name);
      }
    } catch (e) {
      Logger.warn(
        `S3/MinIO not ready: ${(e as Error).message}. Fix env vars before using uploads.`,
        StorageModule.name,
      );
    }
  }
}
