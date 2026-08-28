import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  secret: string;
  accessTtl: string;
  refreshTtl: string;
}

export const jwtConfig = registerAs<JwtConfig>('jwt', (): JwtConfig => ({
  secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-please-change',
  accessTtl: process.env.JWT_ACCESS_TOKEN_TTL || '15m',
  refreshTtl: process.env.JWT_REFRESH_TOKEN_TTL || '7d',
}));
