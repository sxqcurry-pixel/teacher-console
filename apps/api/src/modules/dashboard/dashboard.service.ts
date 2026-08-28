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
      lastLessonAvgRow,
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
      this.prisma.$queryRawUnsafe(
        `
        SELECT AVG(s.weighted_score)::numeric(5,2) AS avg
        FROM scores s
        JOIN lessons l ON l.id = s.lesson_id
        JOIN classes c ON c.id = l.class_id
        WHERE c.teacher_id = $1
          AND s.type = 'LESSON'
          AND s.weighted_score IS NOT NULL
          AND l.index = (
            SELECT MAX(index) FROM lessons l2 WHERE l2.class_id = c.id
          )
      `,
        teacherId,
      ) as Promise<Array<{ avg: number | null }>>,
    ]);
    return {
      totalStudents,
      activeClasses,
      avgScoreLastLesson: Array.isArray(lastLessonAvgRow) && lastLessonAvgRow[0]
        ? (lastLessonAvgRow[0] as { avg?: number | null }).avg ?? null
        : null,
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
