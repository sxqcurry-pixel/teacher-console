/**
 * Spark Teacher Workspace — NestJS bootstrap
 * Responsibilities:
 *   - CORS / Body parser limits
 *   - Global ValidationPipe (class-validator)
 *   - Global Prefix (/api/v1)
 *   - Swagger (only when SWAGGER_ENABLED=true)
 *   - WebSocket upgrade via PlatformSocketIO adapter
 */
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    cors: false, // we configure via explicit middleware below
  });

  const config = app.get(ConfigService);
  // API_PORT 优先（本地）；Railway/Vercel 注入的 PORT 自动兜底；都没设用 3001
  const port = process.env.PORT ? Number(process.env.PORT) : (config.get<number>('API_PORT') ?? 3001);
  const host = config.get<string>('API_HOST', '0.0.0.0');
  const prefix = config.get<string>('API_PREFIX', '/api/v1');
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  // ---- Body limits ----
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ---- CORS ----
  app.enableCors({
    origin: corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition'],
  });

  // ---- Global path prefix & versioning ----
  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ---- Validation ----
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ---- Response wrapper + exception filter ----
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // ---- WebSocket adapter ----
  app.useWebSocketAdapter(new IoAdapter(app));

  // ---- Swagger ----
  if (config.get<string>('SWAGGER_ENABLED', 'true') === 'true') {
    const docConfig = new DocumentBuilder()
      .setTitle('星火教师工作台 API')
      .setDescription('Spark Teacher Workspace · commercial grade backend')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .addServer(`http://localhost:${port}${prefix}`)
      .build();
    const document = SwaggerModule.createDocument(app, docConfig, {
      ignoreGlobalPrefix: false,
    });
    SwaggerModule.setup(`${prefix}/docs`, app, document, {
      jsonDocumentUrl: `${prefix}/docs-json`,
      yamlDocumentUrl: `${prefix}/docs-yaml`,
    });
    Logger.log(`Swagger → http://localhost:${port}${prefix}/docs`, 'Bootstrap');
  }

  await app.listen(port, host);
  Logger.log(`🚀 API server → http://${host}:${port}${prefix}`, 'Bootstrap');
}

bootstrap();
