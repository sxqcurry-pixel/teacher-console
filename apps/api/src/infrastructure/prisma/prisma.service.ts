import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Centralized PrismaClient wrapper with startup logging + optional
 * soft-delete / audit middleware can be hooked here via $use().
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'info' },
      ],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('PostgreSQL connected via Prisma');
    } catch (e) {
      this.logger.error('Prisma connect failed. Is postgres running?', e as Error);
      // don't throw — let HTTP lifecycle report via /health
    }
  }
}
