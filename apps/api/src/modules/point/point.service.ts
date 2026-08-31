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
    // 纯 Prisma：全班学生（含 0 分）+ groupBy 聚合 points，TS 内算 RANK()
    const [students, agg] = await Promise.all([
      this.prisma.student.findMany({
        where: { classId },
        select: { id: true, name: true, serialNo: true },
        orderBy: { serialNo: 'asc' },
      }),
      this.prisma.point.groupBy({
        by: ['studentId'],
        where: { student: { classId } },
        _sum: { score: true },
      }),
    ]);
    const scoreMap = new Map<string, number>();
    for (const s of students) scoreMap.set(s.id, 0);
    for (const a of agg) scoreMap.set(a.studentId, Number(a._sum.score ?? 0));
    type Row = {
      studentId: string;
      studentName: string;
      serialNo: number;
      totalScore: number;
    };
    const sorted: Row[] = students
      .map((s: { id: string; name: string; serialNo: number }) => ({
        studentId: s.id,
        studentName: s.name,
        serialNo: s.serialNo,
        totalScore: scoreMap.get(s.id) ?? 0,
      }))
      .sort((a: Row, b: Row) =>
        a.totalScore === b.totalScore
          ? a.serialNo - b.serialNo
          : b.totalScore - a.totalScore,
      )
      .slice(0, Math.max(1, limit));
    let rank = 0;
    let prevTotal: number | null = null;
    return sorted.map((row: Row & { rank?: number }) => {
      if (row.totalScore !== prevTotal) {
        rank += 1;
        prevTotal = row.totalScore;
      }
      return { ...row, rank };
    });
  }
}
