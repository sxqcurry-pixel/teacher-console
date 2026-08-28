import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  host: string;
  port: number;
  prefix: string;
  corsOrigin: string[];
  swaggerEnabled: boolean;
  tz: string;
}

export const appConfig = registerAs<AppConfig>(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    host: process.env.API_HOST || '0.0.0.0',
    port: Number(process.env.API_PORT) || 3001,
    prefix: process.env.API_PREFIX || '/api/v1',
    corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    swaggerEnabled: (process.env.SWAGGER_ENABLED || 'true') === 'true',
    tz: process.env.TZ || 'Asia/Shanghai',
  }),
);
