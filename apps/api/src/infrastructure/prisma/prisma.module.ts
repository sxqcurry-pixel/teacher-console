import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { PrismaHealthIndicator } from './prisma.health';

/**
 * Prisma database module — global so all feature modules can inject PrismaService.
 */
@Global()
@Module({
  providers: [PrismaClient, PrismaService, PrismaHealthIndicator],
  exports: [PrismaService, PrismaHealthIndicator],
})
export class PrismaModule implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleDestroy() {
    try {
      await this.prisma.$disconnect();
    } catch {
      /* noop */
    }
  }
}
