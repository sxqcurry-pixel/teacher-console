import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(private readonly prisma: PrismaService) {}

  async isHealthy(): Promise<{ up: boolean; latencyMs: number; tables: number }> {
    const start = Date.now();
    try {
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = current_schema()`,
      )) as Array<{ count: number }>;
      const count = Array.isArray(rows) && rows[0] ? (rows[0] as { count?: number }).count ?? 0 : 0;
      return { up: true, latencyMs: Date.now() - start, tables: count };
    } catch (e) {
      return { up: false, latencyMs: Date.now() - start, tables: 0 };
    }
  }
}
