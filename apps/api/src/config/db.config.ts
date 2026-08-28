import { registerAs } from '@nestjs/config';

export interface DbConfig {
  url: string;
  host: string;
  port: number;
  user: string;
  database: string;
}

export const dbConfig = registerAs<DbConfig>('db', (): DbConfig => {
  const url =
    process.env.DATABASE_URL ||
    'postgresql://spark_teacher:change-me@localhost:5432/spark_teacher_workspace?schema=public';
  // Fallback fields for legacy consumers
  return {
    url,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'spark_teacher',
    database: process.env.POSTGRES_DB || 'spark_teacher_workspace',
  };
});
