import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { DashboardStats, RecentActivity } from '@shared/dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(teacherId: string): Promise<DashboardStats> {
    const [
      activeClasses,
      totalStudents,
      totalPoints,
      upcomingTodos,
      renewalFollowUps,
    ] = await Promise.all([
      this.prisma.class.count({ where: { teacherId } }),
      this.prisma.student.count({ where: { class: { teacherId }, status: 'ACTIVE' } }),
      this.prisma.point
        .aggregate({ where: { student: { class: { teacherId } } }, _sum: { score: true } })
        .then((r: any) => r?._sum?.score ?? 0),
      this.prisma.todo.count({
        where: { userId: teacherId, completed: false, dueDate: { gte: new Date() } },
      }),
      this.prisma.communication.count({
        where: {
          student: { class: { teacherId } },
          renewalStatus: { in: ['HIGH', 'MEDIUM'] },
          createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
      }),
    ]);

    // —— 最后一讲全班均分：纯 Prisma groupBy，避免 $queryRaw（P2010 列名方言风险）
    // 步骤 1：老师所有班级
    const classIds = (
      await this.prisma.class.findMany({
        where: { teacherId },
        select: { id: true },
      })
    ).map((c: { id: string }) => c.id);

    let avgScoreLastLesson: number | null = null;
    if (classIds.length) {
      // 步骤 2：找出每个班级的最大 lesson.index（=最后一讲）
      const lastIndexPerClass = new Map<string, number>();
      const byClass = await this.prisma.lesson.groupBy({
        by: ['classId'],
        where: { classId: { in: classIds } },
        _max: { index: true },
      });
      for (const row of byClass) {
        if (row._max.index != null) lastIndexPerClass.set(row.classId, row._max.index);
      }
      if (lastIndexPerClass.size) {
        // 步骤 3：每个班级最后一讲的 LESSON 类型 weighted_score 平均
        const filters = Array.from(lastIndexPerClass.entries()).map(([classId, index]) => ({
          classId,
          lesson: { index },
          type: 'LESSON' as const,
          weightedScore: { not: null },
        }));
        if (filters.length) {
          const avgAgg = await this.prisma.score.aggregate({
            where: {
              OR: filters.map((f) => ({
                student: { classId: f.classId },
                lesson: { classId: f.classId, index: f.lesson.index },
                type: f.type,
                weightedScore: f.weightedScore,
              })),
            },
            _avg: { weightedScore: true },
          });
          const raw = avgAgg._avg.weightedScore;
          avgScoreLastLesson = raw != null ? Number(Number(raw).toFixed(2)) : null;
        }
      }
    }

    return {
      totalStudents,
      activeClasses,
      avgScoreLastLesson,
      totalPointsGiven: Number(totalPoints) || 0,
      upcomingTodosCount: upcomingTodos,
      renewalFollowUpCount: renewalFollowUps,
    };
  }

  async recentActivity(teacherId: string, limit = 10): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];
    const scores: any[] = await this.prisma.score.findMany({
      where: { student: { class: { teacherId } } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { name: true } } },
    });
    activities.push(
      ...scores.map<RecentActivity>((s: any) => ({
        id: 'score-' + s.id,
        type: 'SCORE',
        title: `📝 ${s.student?.name ?? '学生'} · 成绩 ${s.rawScore ?? '-'}`,
        subtitle: s.result ?? undefined,
        timestamp: s.createdAt.toISOString(),
      })),
    );

    const points: any[] = await this.prisma.point.findMany({
      where: { student: { class: { teacherId } } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { name: true } } },
    });
    activities.push(
      ...points.map<RecentActivity>((p: any) => ({
        id: 'pt-' + p.id,
        type: 'POINT',
        title: `⭐ ${p.student?.name ?? '学生'} · ${p.score > 0 ? '+' : ''}${p.score} 分`,
        subtitle: p.category,
        timestamp: p.createdAt.toISOString(),
      })),
    );

    const comms: any[] = await this.prisma.communication.findMany({
      where: { student: { class: { teacherId } } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { name: true } } },
    });
    activities.push(
      ...comms.map<RecentActivity>((c: any) => ({
        id: 'comm-' + c.id,
        type: 'COMM',
        title: `📞 ${c.student?.name ?? '学生'} · ${c.type} 沟通`,
        subtitle: c.renewalStatus ?? undefined,
        timestamp: c.createdAt.toISOString(),
      })),
    );

    const todos: any[] = await this.prisma.todo.findMany({
      where: { userId: teacherId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    activities.push(
      ...todos.map<RecentActivity>((t: any) => ({
        id: 'todo-' + t.id,
        type: 'TODO',
        title: `${t.completed ? '✅' : '⏳'} ${t.title}`,
        subtitle: t.category,
        timestamp: t.createdAt.toISOString(),
      })),
    );

    return activities
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, limit);
  }
}
