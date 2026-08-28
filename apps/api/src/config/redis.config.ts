import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password?: string;
  db: number;
}

export const redisConfig = registerAs<RedisConfig>('redis', (): RedisConfig => ({
  url: process.env.REDIS_URL || 'redis://localhost:6379/0',
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
}));
