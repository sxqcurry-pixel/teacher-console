import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEventBus } from '../../common/domain-event/domain-event-bus.service';
import { FeatureService } from '../feature.service.base';
import { page, pageOffset, round2 } from '@shared/utils';
import { StudentStatus, SyncAction, SyncEntity } from '@shared/enums';
import type {
  CreateStudentRequest,
  PageResult,
  StudentDto,
  StudentQuery,
  UpdateStudentRequest,
  BulkImportResult,
} from '@shared/dto';

@Injectable()
export class StudentService extends FeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {
    super();
  }

  async query(teacherId: string, q: StudentQuery): Promise<PageResult<StudentDto>> {
    const { skip, take } = pageOffset(q.page || 1, q.pageSize || 20);
    const where: any = {
      AND: [
        q.classId ? { classId: q.classId } : undefined,
        q.status ? { status: q.status } : undefined,
        q.keyword
          ? {
              OR: [{ name: { contains: q.keyword } }, { remark: { contains: q.keyword } }],
            }
          : undefined,
        // ensure owned
        { class: { teacherId } },
      ].filter(Boolean),
    };
    const [rows, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take,
        orderBy: { serialNo: 'asc' },
        include: {
          class: { select: { name: true, teacherId: true } },
          _count: { select: { points: true, scores: true } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);
    const items = await Promise.all((rows as unknown[] as any[]).map((s) => this.enrich(s)));
    return page(items, total, q.page || 1, q.pageSize || 20);
  }

  async get(id: string, teacherId: string): Promise<StudentDto> {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { class: { select: { teacherId: true, name: true } } },
    });
    if (!s) throw new NotFoundException('学生不存在');
    if (s.class.teacherId !== teacherId) throw new NotFoundException('学生不存在');
    return this.enrich(s);
  }

  async create(teacherId: string, dto: CreateStudentRequest): Promise<StudentDto> {
    const cls = await this.prisma.class.findUnique({ where: { id: dto.classId } });
    this.ensureOwnerOr404(cls, teacherId);

    // 若未指定 serialNo，自动取当前最大序号 +1
    let serialNo = dto.serialNo;
    if (!serialNo) {
      const last = await this.prisma.student.findFirst({
        where: { classId: dto.classId },
        orderBy: { serialNo: 'desc' },
        select: { serialNo: true },
      });
      serialNo = (last?.serialNo ?? 0) + 1;
    }
    const s = await this.prisma.student.create({
      data: {
        serialNo,
        name: dto.name.trim(),
        remark: dto.remark ?? null,
        status: (dto.status as StudentStatus) ?? StudentStatus.ACTIVE,
        classId: dto.classId,
      },
      include: { class: { select: { teacherId: true, name: true } } },
    });
    await this.emitSync(SyncAction.CREATED, s);
    return this.enrich(s);
  }

  async update(id: string, teacherId: string, dto: UpdateStudentRequest): Promise<StudentDto> {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { class: { select: { teacherId: true, name: true } } },
    });
    if (!s || s.class.teacherId !== teacherId) throw new NotFoundException('学生不存在');
    const updated = await this.prisma.student.update({
      where: { id },
      data: { ...dto, status: dto.status ? (dto.status as StudentStatus) : undefined },
      include: { class: { select: { teacherId: true, name: true } } },
    });
    await this.emitSync(SyncAction.UPDATED, updated);
    return this.enrich(updated);
  }

  async remove(id: string, teacherId: string): Promise<void> {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { class: { select: { teacherId: true } } },
    });
    if (!s || s.class.teacherId !== teacherId) throw new NotFoundException('学生不存在');
    await this.prisma.student.delete({ where: { id } });
    await this.emitSync(SyncAction.DELETED, s);
  }

  /**
   * Bulk import from parsed rows (decouple file parsing so xlsx/csv/API callers all work).
   * Each row: { serialNo?, name, remark?, status? }
   */
  async bulkImport(
    teacherId: string,
    classId: string,
    rows: Array<{ serialNo?: number; name: string; remark?: string; status?: string }>,
    jobId: string,
  ): Promise<BulkImportResult> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    this.ensureOwnerOr404(cls, teacherId);
    if (!rows.length) throw new BadRequestException('导入内容为空');

    let serialCursor = (
      await this.prisma.student.findFirst({
        where: { classId },
        orderBy: { serialNo: 'desc' },
        select: { serialNo: true },
      })
    )?.serialNo ?? 0;

    const errors: Array<{ row: number; message: string }> = [];
    const toCreate: any[] = [];
    rows.forEach((row, i) => {
      const idx = i + 1;
      if (!row.name || !row.name.trim()) {
        errors.push({ row: idx, message: '姓名为空' });
        return;
      }
      if (row.serialNo !== undefined && row.serialNo <= 0) {
        errors.push({ row: idx, message: '序号必须 > 0' });
        return;
      }
      const serialNo = row.serialNo ?? ++serialCursor;
      toCreate.push({
        serialNo,
        name: row.name.trim(),
        remark: row.remark ?? null,
        status: (row.status as StudentStatus) ?? StudentStatus.ACTIVE,
        classId,
      });
    });

    let successCount = 0;
    if (toCreate.length) {
      try {
        const created = await this.prisma.student.createManyAndReturn({
          data: toCreate,
          skipDuplicates: false,
        });
        successCount = created.length;
        // batch emit sync (throttled for large imports)
        await this.events.publish({
          name: 'student.batch_imported',
          aggregateId: classId,
          payload: { count: created.length, jobId },
          channel: `class:${classId}`,
        });
      } catch (e: any) {
        errors.push({ row: 0, message: `写入失败：${e.message || String(e)}` });
      }
    }
    return {
      successCount,
      failCount: errors.length,
      errors,
      jobId,
    };
  }

  // ---------- helpers ----------

  private async enrich(s: any): Promise<StudentDto> {
    // points aggregate
    const pointsAgg = await this.prisma.point.aggregate({
      where: { studentId: s.id },
      _sum: { score: true },
    });
    // avg lesson score
    const avgRaw = await this.prisma.score.aggregate({
      where: { studentId: s.id, type: 'LESSON', weightedScore: { not: null } },
      _avg: { weightedScore: true },
    });
    // rank within class
    const rankRow: Array<{ rank: number | null }> = await this.prisma.$queryRawUnsafe(
      `
      WITH agg AS (
        SELECT student_id, COALESCE(SUM(score),0) AS total FROM points
        WHERE student_id IN (SELECT id FROM students WHERE class_id = $1)
        GROUP BY student_id
      )
      SELECT RANK() OVER (ORDER BY total DESC)::int AS rank
      FROM agg WHERE student_id = $2
      `,
      s.classId,
      s.id,
    );
    return {
      id: s.id,
      serialNo: s.serialNo,
      name: s.name,
      remark: s.remark ?? null,
      status: s.status,
      classId: s.classId,
      className: s.class?.name,
      totalPoints: pointsAgg._sum.score ?? 0,
      avgScore: avgRaw._avg.weightedScore != null ? round2(avgRaw._avg.weightedScore) : undefined,
      rank: rankRow[0]?.rank ?? undefined,
    };
  }

  private async emitSync(action: SyncAction, s: any) {
    await this.events.publish({
      name: `student.${action.toLowerCase()}`,
      aggregateId: s.id,
      payload: { id: s.id, action, entity: SyncEntity.STUDENT },
      channel: `class:${s.classId}`,
    });
  }
}
