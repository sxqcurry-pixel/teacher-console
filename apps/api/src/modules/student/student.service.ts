import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    // —— 一次聚合全班所有学生的 points 和 LESSON scores，彻底消除 N+1 查询
    //    并且不使用 $queryRaw（Prisma P2010 风险：列名方言差异 / 运行时 schema 不匹配都要炸）
    const ids = (rows as Array<{ id: string }>).map((r) => r.id);
    const [pointsAggsRaw, scoreAggsRaw] = ids.length
      ? await Promise.all([
          this.prisma.point.groupBy({
            by: ['studentId'],
            where: { studentId: { in: ids } },
            _sum: { score: true },
          }),
          this.prisma.score.groupBy({
            by: ['studentId'],
            where: { studentId: { in: ids }, type: 'LESSON', weightedScore: { not: null } },
            _avg: { weightedScore: true },
          }),
        ])
      : [[], []];

    // Map<studentId, number>
    const pointsMap = new Map<string, number>();
    for (const a of pointsAggsRaw) pointsMap.set(a.studentId, Number(a._sum.score ?? 0));
    const avgMap = new Map<string, number>();
    for (const a of scoreAggsRaw) avgMap.set(a.studentId, Number(a._avg.weightedScore ?? 0));

    // 全班 rank：按 studentId -> totalPoints 降序相同分数并列（RANK，非 DENSE_RANK）
    // 需要取全班所有学生的 points 聚合（不只是当前页），否则分页内排名错误
    const allClassIds = Array.from(new Set((rows as Array<{ classId: string }>).map((r) => r.classId).filter(Boolean)));
    const classRankMaps = new Map<string, Map<string, number>>(); // classId → Map<studentId, rank>
    if (allClassIds.length) {
      const allClassPointsAggs = await this.prisma.point.groupBy({
        by: ['studentId'],
        where: { student: { classId: { in: allClassIds } } },
        _sum: { score: true },
      });
      for (const cid of allClassIds) {
        // 先查这个班所有学生 ID（含没 points 的，没 points 按 0 分参与排名）
        const allStudentsInClass = await this.prisma.student.findMany({
          where: { classId: cid },
          select: { id: true },
        });
        const perStudentTotal = new Map<string, number>();
        for (const s of allStudentsInClass) perStudentTotal.set(s.id, 0);
        for (const a of allClassPointsAggs) {
          if (perStudentTotal.has(a.studentId)) {
            perStudentTotal.set(a.studentId, Number(a._sum.score ?? 0));
          }
        }
        // RANK() 降序：相同 totalPoints 给同一名次，随后跳过
        const entries: Array<[string, number]> = Array.from(perStudentTotal.entries()).sort(
          (a, b) => b[1] - a[1],
        );
        const rankMap = new Map<string, number>();
        let lastScore: number | null = null;
        let lastRank = 0;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]!;
          const sid: string = entry[0];
          const score: number = entry[1];
          const position = i + 1;
          const rank = score === lastScore ? lastRank : position;
          rankMap.set(sid, rank);
          lastScore = score;
          lastRank = rank;
        }
        classRankMaps.set(cid, rankMap);
      }
    }

    const items: StudentDto[] = rows.map((s: any) => ({
      id: s.id,
      serialNo: s.serialNo,
      name: s.name,
      remark: s.remark ?? null,
      status: s.status,
      classId: s.classId,
      className: s.class?.name,
      totalPoints: pointsMap.get(s.id) ?? 0,
      avgScore: avgMap.has(s.id) ? round2(avgMap.get(s.id)!) : undefined,
      rank: classRankMaps.get(s.classId)?.get(s.id),
    }));

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

  /**
   * enrich — 纯 Prisma groupBy + 应用层排序，**彻底不用 $queryRaw**。
   *
   * 历史上这里用 Prisma.sql + $queryRaw 跑窗口函数算 rank，
   * 但项目 Prisma schema 没为字段声明 @map（列名是 camelCase，
   * e.g. "classId" / "studentId"），Postgres 对未加引号的标识符强制小写，
   * 导致 `WHERE class_id = ...` 报列不存在 → Prisma P2010。
   * 新增 / 更新 / 查询单条 都调用 enrich，P2010 把整条写操作链路炸穿。
   * 现在：groupBy + TS sort 计算标准 RANK()（相同分数同名次跳过）。
   */
  private async enrich(s: any): Promise<StudentDto> {
    const [pointsAgg, avgRaw] = await Promise.all([
      this.prisma.point.aggregate({
        where: { studentId: s.id },
        _sum: { score: true },
      }),
      this.prisma.score.aggregate({
        where: { studentId: s.id, type: 'LESSON', weightedScore: { not: null } },
        _avg: { weightedScore: true },
      }),
    ]);

    let rank: number | undefined;
    if (s.classId) {
      // 全班学生（含 0 分的）points 聚合后应用层排 RANK()
      const [allInClass, pointsAggs] = await Promise.all([
        this.prisma.student.findMany({
          where: { classId: s.classId },
          select: { id: true },
        }),
        this.prisma.point.groupBy({
          by: ['studentId'],
          where: { student: { classId: s.classId } },
          _sum: { score: true },
        }),
      ]);
      const totals = new Map<string, number>();
      for (const st of allInClass) totals.set(st.id, 0);
      for (const a of pointsAggs) totals.set(a.studentId, Number(a._sum.score ?? 0));
      const sorted: Array<[string, number]> = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
      let lastScore: number | null = null;
      let lastRank = 0;
      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i]!;
        const sid: string = entry[0];
        const score: number = entry[1];
        const pos = i + 1;
        const r = score === lastScore ? lastRank : pos;
        if (sid === s.id) {
          rank = r;
          break;
        }
        lastScore = score;
        lastRank = r;
      }
    }
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
      rank,
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
