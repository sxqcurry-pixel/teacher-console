import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PointCategory as PrismaPointCategory } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEventBus } from '../../common/domain-event/domain-event-bus.service';
import { FeatureService } from '../feature.service.base';
import { page, pageOffset } from '@shared/utils';
import { PointCategory, SyncAction, SyncEntity } from '@shared/enums';
import type {
  CreatePointRequest,
  PageResult,
  PointDto,
  PointQuery,
  PointRankingDto,
} from '@shared/dto';

@Injectable()
export class PointService extends FeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {
    super();
  }

  async query(teacherId: string, q: PointQuery): Promise<PageResult<PointDto>> {
    const { skip, take } = pageOffset(q.page || 1, q.pageSize || 50);
    const where: Prisma.PointWhereInput = {
      student: { class: { teacherId } },
      ...(q.classId ? { student: { classId: q.classId } } : {}),
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(q.category ? { category: q.category as PrismaPointCategory } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.point.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { name: true, classId: true } },
          lesson: { select: { index: true } },
        },
      }),
      this.prisma.point.count({ where }),
    ]);
    return page(
      (rows as any[]).map((p) => ({
        id: p.id,
        studentId: p.studentId,
        studentName: p.student?.name,
        lessonId: p.lessonId ?? null,
        lessonIndex: p.lesson?.index ?? null,
        category: p.category as PointCategory,
        score: p.score,
        reason: p.reason ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      q.page || 1,
      q.pageSize || 50,
    );
  }

  async add(teacherId: string, dto: CreatePointRequest): Promise<PointDto> {
    if (dto.score === 0) throw new BadRequestException('积分不能为 0');
    const s = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      include: { class: { select: { teacherId: true, id: true } } },
    });
    if (!s || s.class.teacherId !== teacherId) throw new NotFoundException('学生不存在');
    const p = await this.prisma.point.create({
      data: {
        studentId: dto.studentId,
        lessonId: dto.lessonId ?? null,
        category: dto.category as PrismaPointCategory,
        score: dto.score,
        reason: dto.reason ?? null,
      },
      include: { student: { select: { name: true, classId: true } } },
    });
    await this.events.publish({
      name: 'point.created',
      aggregateId: p.id,
      payload: { id: p.id, studentId: p.studentId, score: p.score, entity: SyncEntity.POINT, action: SyncAction.CREATED },
      channel: `class:${s.class.id}`,
    });
    return {
      id: p.id,
      studentId: p.studentId,
      studentName: p.student.name,
      lessonId: p.lessonId ?? null,
      lessonIndex: null,
      category: p.category as PointCategory,
      score: p.score,
      reason: p.reason ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  async remove(id: string, teacherId: string): Promise<void> {
    const p = await this.prisma.point.findUnique({
      where: { id },
      include: { student: { include: { class: { select: { teacherId: true, id: true } } } } },
    });
    if (!p || p.student.class.teacherId !== teacherId) throw new NotFoundException('积分记录不存在');
    await this.prisma.point.delete({ where: { id } });
    await this.events.publish({
      name: 'point.deleted',
      aggregateId: id,
      payload: { id },
      channel: `class:${p.student.class.id}`,
    });
  }

  async ranking(teacherId: string, classId: string, limit = 50): Promise<PointRankingDto[]> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    this.ensureOwnerOr404(cls, teacherId);
    const rows: Array<{ student_id: string; name: string; serial_no: number; total: bigint | number }> =
      await this.prisma.$queryRawUnsafe(
        `
      SELECT st.id                            AS student_id,
             st.name,
             st.serial_no,
             COALESCE(SUM(p.score), 0)        AS total
      FROM students st
      LEFT JOIN points p ON p.student_id = st.id
      WHERE st.class_id = $1
      GROUP BY st.id, st.name, st.serial_no
      ORDER BY total DESC, st.serial_no ASC
      LIMIT $2
      `,
        classId,
        limit,
      );
    let rank = 0;
    let prevTotal: number | null = null;
    return rows.map((r) => {
      const total = Number(r.total);
      if (total !== prevTotal) {
        rank += 1;
        prevTotal = total;
      }
      return {
        studentId: r.student_id,
        studentName: r.name,
        serialNo: r.serial_no,
        totalScore: total,
        rank,
      };
    });
  }
}
