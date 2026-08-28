import { Injectable, NotFoundException } from '@nestjs/common';
import type { AIChatRequest, AIChatOption } from '@shared/dto';
import { AIProvider } from '../../infrastructure/ai/ai.provider';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AIChatService {
  constructor(
    private readonly ai: AIProvider,
    private readonly prisma: PrismaService,
  ) {}

  async optionTemplates(): Promise<AIChatOption[]> {
    return [
      {
        id: 'STUDENT_LEARNING_ADVICE',
        label: '生成学生个性化学习建议',
        template: 'STUDENT_LEARNING_ADVICE',
        requiredParams: ['studentId'],
      },
      {
        id: 'TEACHER_TEACHING_ADVICE',
        label: '下次课教学优化建议',
        template: 'TEACHER_TEACHING_ADVICE',
        requiredParams: ['classId'],
      },
      {
        id: 'PARENT_MESSAGE',
        label: '家长沟通话术（微信/电话）',
        template: 'PARENT_MESSAGE',
        requiredParams: ['studentId'],
      },
      {
        id: 'LESSON_PLAN_IDEA',
        label: '备课灵感 / 课堂引入创意',
        template: 'LESSON_PLAN_IDEA',
      },
      {
        id: 'CUSTOM',
        label: '自由提问',
        template: 'CUSTOM',
      },
    ];
  }

  async chat(teacherId: string, req: AIChatRequest): Promise<{ content: string }> {
    const messages = await this.buildMessages(teacherId, req);
    const res = await this.ai.chat(messages, { temperature: 0.7, maxTokens: 1500 });
    return { content: res.content };
  }

  async *chatStream(teacherId: string, req: AIChatRequest): AsyncGenerator<string> {
    const messages = await this.buildMessages(teacherId, req);
    const stream = await this.ai.chatStream(messages, { temperature: 0.7, maxTokens: 1500 });
    for await (const chunk of stream) {
      if (chunk.content) yield chunk.content;
      if (chunk.done) yield '';
    }
  }

  private async buildMessages(
    teacherId: string,
    req: AIChatRequest,
  ): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
    const system =
      '你是一位资深初中数学教研组长兼心理咨询师，熟悉中山星火教育初中冲刺激增体系。输出请：(1)结构清晰，分 3-5 条要点；(2)每条具体可执行，附话术或例题；(3)语气专业、正向、幽默但不尴尬，符合"家长信任 + 学生喜欢"的品牌人格。';
    const userText = await this.renderPrompt(teacherId, req);
    return [
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ];
  }

  private async renderPrompt(teacherId: string, req: AIChatRequest): Promise<string> {
    if (req.template === 'CUSTOM') return req.prompt ?? '请自我介绍。';

    let student: any = null;
    if (req.studentId) {
      student = await this.prisma.student.findUnique({
        where: { id: req.studentId },
        include: {
          class: { include: { teacher: { select: { id: true } } } },
          _count: { select: { scores: true, points: true } },
          scores: { take: 3, orderBy: { createdAt: 'desc' } },
          points: { take: 10, orderBy: { createdAt: 'desc' } },
        },
      });
      if (!student || student.class.teacher.id !== teacherId) throw new NotFoundException('学生不存在');
    }
    const ctx = req.context ?? {};
    switch (req.template) {
      case 'STUDENT_LEARNING_ADVICE':
        if (!student) throw new Error('缺少 studentId');
        return `请为以下学生写 3 条具体可执行的学习建议，覆盖"课堂听讲 / 作业习惯 / 错题复盘"三维：\n
姓名：${student.name}
班级：${student.class.name}
最近 3 次讲次成绩（满分30）：${student.scores.map((s: any) => s.rawScore ?? '-').join('、') || '暂无'}
近期积分记录：${student.points.map((p: any) => `${p.category}:${p.score}`).join('、') || '暂无'}
备注：${student.remark ?? '无'}
额外上下文：${JSON.stringify(ctx)}`;

      case 'TEACHER_TEACHING_ADVICE': {
        const cls = await this.prisma.class.findUnique({
          where: { id: req.classId ?? '' },
          include: { _count: { select: { students: true } }, lessons: true },
        });
        if (!cls || cls.teacherId !== teacherId) throw new NotFoundException('班级不存在');
        const clsAny = cls as any;
        return `为"${cls.name}"(${clsAny._count?.students ?? (clsAny as any).students?.length ?? 0}人) 下一讲的教学设计给出 3 条优化建议，包含：
(1)开场破冰引入方式；(2)课堂互动节奏与提问策略；(3)差异化分层（拔高/补弱）。
已安排讲次：${(clsAny.lessons ?? []).map((l: any) => `第${l.index}讲 ${l.title}`).join(' / ') || '暂无'}
上下文：${JSON.stringify(ctx)}`;
      }

      case 'PARENT_MESSAGE':
        if (!student) throw new Error('缺少 studentId');
        return `请写一段发给家长的微信沟通话术，要求：
- 开场摸底（最近在家状态 + 上次课后反馈）
- 客观数据分析（2-3 个数据点）
- 给出 2 条解决方案（家里如何配合）
- 引导认知（强调中考备考节奏）
- 最后对齐下阶段目标并续费软性铺垫

学生：${student.name}
班级：${student.class.name}
最近成绩：${student.scores.map((s: any) => `${s.rawScore}/30`).join('、') || '暂无'}
续费意向：${ctx.renewalStatus ?? '待确认'}
语气：真诚、专业、不焦虑。`;

      case 'LESSON_PLAN_IDEA':
        return `请给出 3 个初中数学课堂"5 分钟惊艳开场"的创意，主题：${req.prompt ?? (ctx.topic as string) ?? '二次函数综合应用'}。
要求：(1)尽量低成本，只用白板+学生文具即可；(2)学生高参与度；(3)紧扣知识点，不只是噱头。`;

      default:
        return req.prompt ?? '请给出教学建议。';
    }
  }
}
