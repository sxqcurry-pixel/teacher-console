import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ScoreType as PrismaScoreType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEventBus } from '../../common/domain-event/domain-event-bus.service';
import { FeatureService } from '../feature.service.base';
import { page, pageOffset, round2, weightedStageTest } from '@shared/utils';
import { ScoreType, SyncAction, SyncEntity } from '@shared/enums';
import type {
  CreateScoresBatchRequest,
  PageResult,
  ScoreDto,
  ScoreQuery,
} from '@shared/dto';

@Injectable()
export class ScoreService extends FeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {
    super();
  }

  async query(teacherId: string, q: ScoreQuery): Promise<PageResult<ScoreDto>> {
    const { skip, take } = pageOffset(q.page || 1, q.pageSize || 50);
    const where: Prisma.ScoreWhereInput = {
      student: { class: { teacherId } },
      ...(q.lessonId ? { lessonId: q.lessonId } : {}),
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(q.type ? { type: q.type as PrismaScoreType } : {}),
      ...(q.classId ? { student: { classId: q.classId } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.score.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { name: true, classId: true } },
          lesson: { select: { index: true } },
        },
      }),
      this.prisma.score.count({ where }),
    ]);
    return page(rows.map(this.map), total, q.page || 1, q.pageSize || 50);
  }

  /**
   * Batch upsert scores for a given lesson. Also computes:
   *   - weightedScore = STAGE_TEST ? rawScore*0.3 : rawScore
   *   - result label  = 优秀 / 及格 / 待提升
   *   - rank          = RANK() partitioned by lesson & type
   */
  async batchUpsert(
    teacherId: string,
    dto: CreateScoresBatchRequest,
  ): Promise<{ updated: number; classId: string }> {
    if (!dto.scores.length) throw new BadRequestException('成绩为空');
    const classId = dto.classId;
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    this.ensureOwnerOr404(cls, teacherId);

    const type = dto.type as PrismaScoreType;
    const lessonFullScore = dto.lessonId
      ? (await this.prisma.lesson.findUnique({ where: { id: dto.lessonId } }))?.fullScore ?? 30
      : dto.type === ScoreType.STAGE_TEST
        ? 100
        : 30;

    // verify all students belong to the class
    const studentIds = dto.scores.map((s) => s.studentId);
    const validCount = await this.prisma.student.count({
      where: { id: { in: studentIds }, classId },
    });
    if (validCount !== studentIds.length) {
      throw new BadRequestException('存在不属于该班级的学生');
    }

    const tx: Prisma.PrismaPromise<any>[] = [];
    for (const item of dto.scores) {
      const raw = Number(item.rawScore);
      if (Number.isNaN(raw) || raw < 0) throw new BadRequestException('分数格式无效');
      const weighted =
        type === ScoreType.STAGE_TEST ? weightedStageTest(raw) : round2(raw);
      const result = this.labelResult(raw, lessonFullScore);
      tx.push(
        this.prisma.score.upsert({
          where: {
            studentId_lessonId_type: {
              studentId: item.studentId,
              lessonId: dto.lessonId ?? '',
              type,
            },
          },
          create: {
            studentId: item.studentId,
            lessonId: dto.lessonId ?? null,
            type,
            rawScore: raw,
            weightedScore: weighted,
            result,
            remark: item.remark ?? null,
          },
          update: {
            rawScore: raw,
            weightedScore: weighted,
            result,
            remark: item.remark ?? null,
          },
        }),
      );
    }
    await this.prisma.$transaction(tx);

    // recompute ranks in batch (window function → N updates by student/lesson/type)
    await this.recalcRanks(classId, dto.lessonId ?? null, type);

    await this.events.publish({
      name: 'score.batch_updated',
      aggregateId: dto.lessonId ?? classId,
      payload: {
        count: dto.scores.length,
        lessonId: dto.lessonId ?? null,
        type,
        entity: SyncEntity.SCORE,
        action: SyncAction.BATCH_UPDATED,
      },
      channel: `class:${classId}`,
    });

    return { updated: dto.scores.length, classId };
  }

  async remove(id: string, teacherId: string): Promise<void> {
    const score = await this.prisma.score.findUnique({
      where: { id },
      include: { student: { include: { class: { select: { teacherId: true, id: true } } } } },
    });
    if (!score || score.student.class.teacherId !== teacherId) {
      throw new NotFoundException('成绩记录不存在');
    }
    await this.prisma.score.delete({ where: { id } });
    await this.events.publish({
      name: 'score.deleted',
      aggregateId: id,
      payload: { id, lessonId: score.lessonId, studentId: score.studentId },
      channel: `class:${score.student.class.id}`,
    });
  }

  // ---------- helpers ----------

  private async recalcRanks(classId: string, lessonId: string | null, type: PrismaScoreType) {
    // 纯 Prisma + TS sort 计算 RANK()，避免 $queryRaw（Prisma P2010 列名方言风险）
    const where: any = {
      student: { classId },
      type,
      ...(lessonId ? { lessonId } : { lessonId: { not: null } }),
    };
    const scores = await this.prisma.score.findMany({
      where,
      select: { id: true, weightedScore: true },
    });
    if (!scores.length) return;
    const sorted = [...scores].sort(
      (a, b) => Number(b.weightedScore ?? 0) - Number(a.weightedScore ?? 0),
    );
    const rankUpdates: Array<Promise<any>> = [];
    let lastScore: number | null = null;
    let lastRank = 0;
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i]!;
      const score = Number(s.weightedScore ?? 0);
      const pos = i + 1;
      const rank = score === lastScore ? lastRank : pos;
      rankUpdates.push(
        this.prisma.score.update({ where: { id: s.id }, data: { rank } }),
      );
      lastScore = score;
      lastRank = rank;
    }
    await Promise.all(rankUpdates);
  }

  private labelResult(raw: number, fullScore: number): string {
    const pct = raw / Math.max(1, fullScore);
    if (pct >= 0.9) return '优秀';
    if (pct >= 0.6) return '及格';
    return '待提升';
  }

  private map(s: any): ScoreDto {
    return {
      id: s.id,
      studentId: s.studentId,
      studentName: s.student?.name,
      lessonId: s.lessonId ?? null,
      lessonIndex: s.lesson?.index ?? null,
      type: s.type,
      rawScore: s.rawScore ?? null,
      weightedScore: s.weightedScore ?? null,
      rank: s.rank ?? null,
      result: s.result ?? null,
      remark: s.remark ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
