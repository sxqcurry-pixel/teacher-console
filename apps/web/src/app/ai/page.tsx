'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Bot,
  Sparkles,
  BrainCircuit,
  Users2,
  GraduationCap,
  BookOpenCheck,
  MessageSquareText,
  Wand2,
  Copy,
  RefreshCw,
  Send,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { endpoints } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import type { AIChatOption, AITemplateType, PageResult, StudentDto } from '@spark/shared';

const DEFAULT_OPTIONS: AIChatOption[] = [
  {
    id: 'opt-student-advice',
    label: '学生个性化学习建议',
    template: 'STUDENT_LEARNING_ADVICE',
    icon: 'Users2',
    requiredParams: ['studentId'],
  },
  {
    id: 'opt-teaching-advice',
    label: '班级教学复盘建议',
    template: 'TEACHER_TEACHING_ADVICE',
    icon: 'GraduationCap',
    requiredParams: ['classId'],
  },
  {
    id: 'opt-parent-msg',
    label: '家校沟通话术生成',
    template: 'PARENT_MESSAGE',
    icon: 'MessageSquareText',
    requiredParams: ['studentId'],
  },
  {
    id: 'opt-lesson-plan',
    label: '讲次备课灵感',
    template: 'LESSON_PLAN_IDEA',
    icon: 'BookOpenCheck',
    requiredParams: [],
  },
  {
    id: 'opt-custom',
    label: '自由提问（自定义）',
    template: 'CUSTOM',
    icon: 'Wand2',
    requiredParams: [],
  },
];

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Users2, GraduationCap, MessageSquareText, BookOpenCheck, Wand2,
};

export default function AIPage() {
  const push = useAppStore((s) => s.pushToast);
  const classes = useAppStore((s) => s.classes);
  const activeClassId = useAppStore((s) => s.activeClassId);

  const [selected, setSelected] = useState<AIChatOption>(DEFAULT_OPTIONS[0] as AIChatOption);
  const [studentId, setStudentId] = useState<string>('');
  const [classId, setClassId] = useState<string>(activeClassId ?? '');
  useEffect(() => { if (activeClassId && !classId) setClassId(activeClassId); }, [activeClassId, classId]);
  const [prompt, setPrompt] = useState('');
  const [log, setLog] = useState<Array<{ id: string; role: 'user' | 'ai'; content: string; template: string }>>([]);

  const { data, isLoading } = useQuery<PageResult<StudentDto>>({
    queryKey: ['students', 'roster', classId],
    queryFn: async () => {
      if (!classId) return { items: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      return endpoints.students.query({ classId, page: 1, pageSize: 300, status: 'ACTIVE' }) as Promise<PageResult<StudentDto>>;
    },
    enabled: !!classId,
  });
  const students = data?.items ?? [];

  const askMut = useAskMutation({ onChunk: (chunk, id) => {
    setLog((prev) => prev.map((m) => m.id === id ? { ...m, content: m.content + chunk } : m));
  }, onDone: (id) => {
    setLog((prev) => prev.map((m) => m.id === id ? { ...m, content: m.content + '\n\n—— 建议仅作参考，请注意结合实际学情。' } : m));
  }, onError: (e, id) => {
    setLog((prev) => prev.map((m) => m.id === id ? { ...m, content: m.content + `\n\n❌ 生成失败：${e.message}` } : m));
    push({ variant: 'error', title: 'AI 生成失败', description: e.message });
  } });

  function onSubmit() {
    const needStudent = selected.requiredParams?.includes('studentId');
    const needClass = selected.requiredParams?.includes('classId');
    if (needStudent && !studentId) return push({ variant: 'info', title: '请选择学生' });
    if (needClass && !classId) return push({ variant: 'info', title: '请选择班级' });
    if (selected.template === 'CUSTOM' && !prompt.trim()) return push({ variant: 'info', title: '请输入提问内容' });

    const userText = buildUserSummary(selected, {
      studentName: students.find((s) => s.id === studentId)?.name,
      className: classes.find((c) => c.id === classId)?.name,
      prompt,
    });
    const aiId = 'ai-' + Date.now();
    setLog((prev) => [
      ...prev,
      { id: 'u-' + Date.now(), role: 'user', content: userText, template: selected.template },
      { id: aiId, role: 'ai', content: '', template: selected.template },
    ]);
    askMut.mutate({
      template: selected.template,
      studentId: studentId || undefined,
      classId: classId || undefined,
      prompt: selected.template === 'CUSTOM' ? prompt : undefined,
      stream: true,
      __aiId: aiId,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="spark-eyebrow"><BrainCircuit className="h-3 w-3" /> AI STUDIO · BETA</span>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight spark-title-gradient">
            AI 备课 & 沟通工作台
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选一个场景卡片，再补上下文（学生 / 班级 / 提问），AI 会逐字打出可用方案。
          </p>
        </div>
        <Badge variant="gold"><Sparkles className="h-3 w-3 mr-1" /> 豆包 / 通义 / OpenAI 可切换</Badge>
      </div>

      {/* 选项卡片 5 张 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {DEFAULT_OPTIONS.map((opt, i) => {
          const active = selected.id === opt.id;
          const Icon = ICONS[opt.icon ?? 'Wand2'] ?? Wand2;
          return (
            <motion.button
              key={opt.id}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(opt)}
              className={cn(
                'group relative text-left rounded-2xl border p-5 transition',
                active
                  ? 'border-primary bg-gradient-to-br from-primary/15 via-background to-accent/10 shadow-glow ring-1 ring-primary/40'
                  : 'border-border/60 bg-muted/10 hover:bg-muted/25',
              )}
            >
              <div className={cn(
                'grid h-11 w-11 place-items-center rounded-xl mb-4',
                active ? 'bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow' : 'bg-primary/15 text-primary',
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-semibold tracking-tight">{opt.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {describe(opt.template)}
              </div>
              <ChevronRight className={cn(
                'absolute right-4 top-5 h-4 w-4 transition',
                active ? 'translate-x-0 text-primary opacity-100' : '-translate-x-2 opacity-0 text-muted-foreground',
              )} />
            </motion.button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* 左：对话与流式输出 */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-accent" /> {selected.label}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setLog([])}><RefreshCw className="h-3.5 w-3.5 mr-1" /> 清空对话</Button>
              </div>
            </div>
            <CardDescription>{describe(selected.template)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/60 bg-muted/10 p-4 h-[52vh] overflow-y-auto space-y-4 pr-2">
              {log.length === 0 ? (
                <div className="h-full grid place-items-center text-muted-foreground">
                  <div className="text-center max-w-md">
                    <Sparkles className="mx-auto h-8 w-8 text-primary/70 mb-3" />
                    <p>先在右侧填写上下文，再点下方「生成」按钮。</p>
                    <p className="mt-2 text-xs">AI 的建议仅作参考，请你结合实际学情与学生性格做微调。</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {log.map((m) => (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <div className={cn(
                        'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed',
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-br-md shadow-glow'
                          : 'bg-muted/60 border border-border/60 rounded-bl-md',
                      )}>
                        <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1.5">
                          {m.role === 'user' ? 'You' : 'AI'} · {m.template.replace(/_/g, ' ')}
                        </div>
                        <div className="tabular-nums">
                          {m.role === 'ai'
                            ? <TypewriterInline text={m.content} />
                            : m.content}
                        </div>
                        {m.role === 'ai' && m.content && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-7 text-xs opacity-80"
                              onClick={() => {
                                navigator.clipboard?.writeText(m.content);
                                push({ variant: 'success', title: '已复制到剪贴板' });
                              }}>
                              <Copy className="h-3 w-3 mr-1" /> 复制
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* 输入区 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>班级（用于教学建议 / 数据分析）</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue placeholder="选择班级" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>学生（学习建议 / 家校话术）</Label>
                <Select value={studentId} onValueChange={setStudentId} disabled={!students.length || isLoading}>
                  <SelectTrigger><SelectValue placeholder={isLoading ? '加载学生…' : '选择学生（可选）'} /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · No.{s.serialNo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <Label>{selected.template === 'CUSTOM' ? '你的提问' : '补充说明（可选）'}</Label>
              <div className="mt-1 flex gap-2">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSubmit();
                  }}
                  placeholder={placeholderOf(selected.template)}
                  rows={3}
                />
                <Button
                  className="self-end shrink-0"
                  onClick={onSubmit}
                  disabled={askMut.isPending}
                >
                  {askMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  {askMut.isPending ? '生成中…' : '生成'}
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                ⌨️ 提示：Ctrl/Cmd + Enter 快速生成。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 右：模板小抄 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">模板速览</CardTitle>
            <CardDescription>每个模板都会自动填入学生/班级数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[64vh] overflow-y-auto pr-1">
            <Tabs defaultValue="advice">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="advice">学习建议</TabsTrigger>
                <TabsTrigger value="parent">家校话术</TabsTrigger>
              </TabsList>
              <TabsContent value="advice" className="mt-3 space-y-3 text-sm">
                <PromptCheat title="基础诊断" text="最近 3 次讲次测成绩、阶段测加权分、出勤与作业情况 → 提炼薄弱章节" />
                <PromptCheat title="方法建议" text="按照『基础/中档/压轴』三层，给出具体 3 条可执行训练方案，附每日时长" />
                <PromptCheat title="信心鼓励" text="用学生熟悉的生活比喻把数学概念讲清楚，最后加一段能抄到家长群的话术" />
              </TabsContent>
              <TabsContent value="parent" className="mt-3 space-y-3 text-sm">
                <PromptCheat title="摸底开头" text="先用 1 句拉近感情的话问候家长，说出孩子课堂上 1 个具体的正向细节" />
                <PromptCheat title="客观分析" text="用 3 句数据讲薄弱项，避免『粗心』『不努力』等模糊词" />
                <PromptCheat title="续费收口" text="给出下阶段的学习方案（分 3 级），再引导家长做出选择" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PromptCheat({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 p-3 hover:bg-muted/30 transition">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="outline">TIP</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function describe(t: AITemplateType) {
  switch (t) {
    case 'STUDENT_LEARNING_ADVICE': return '结合成绩/积分/课堂表现，输出个性化提升方案';
    case 'TEACHER_TEACHING_ADVICE': return '基于班级整体数据，给出下阶段教学节奏与重点题目';
    case 'PARENT_MESSAGE': return '输出可直接复制到微信的五段式家校沟通文案';
    case 'LESSON_PLAN_IDEA': return '给出讲次引入、典型例题、互动游戏、出门测四件套灵感';
    case 'CUSTOM': return '自由提问，由你填写 Prompt';
  }
}

function placeholderOf(t: AITemplateType) {
  switch (t) {
    case 'STUDENT_LEARNING_ADVICE': return '如：学生最近在二次函数总错分类讨论…（可选）';
    case 'TEACHER_TEACHING_ADVICE': return '如：下节课讲相似三角形，希望设计 1 个课堂小游戏';
    case 'PARENT_MESSAGE': return '如：家长在意分数细节，语气要温和，附带一个下周小目标建议';
    case 'LESSON_PLAN_IDEA': return '如：七年级上 · 一元一次方程应用 · 行程问题';
    case 'CUSTOM': return '请输入你想让 AI 帮你完成的事…';
  }
}

function buildUserSummary(opt: AIChatOption, ctx: { studentName?: string; className?: string; prompt: string }) {
  const parts: string[] = [`模板：${opt.label}`];
  if (ctx.studentName) parts.push(`学生：${ctx.studentName}`);
  if (ctx.className) parts.push(`班级：${ctx.className}`);
  if (ctx.prompt) parts.push(`补充说明：${ctx.prompt}`);
  return parts.join(' · ');
}

function useAskMutation(opts: {
  onChunk: (chunk: string, id: string) => void;
  onDone?: (id: string) => void;
  onError?: (e: Error, id: string) => void;
}) {
  return useMutation({
    mutationFn: async (req: Parameters<typeof endpoints.ai.chat>[0] & { __aiId: string }) => {
      const { __aiId, ...rest } = req;
      const controller = new AbortController();
      try {
        // 1) 真实 SSE 流式（fetch + ReadableStream）
        await endpoints.ai.streamChat(
          rest,
          (content) => opts.onChunk(content, __aiId),
          controller.signal,
        );
        opts.onDone?.(__aiId);
      } catch (err: unknown) {
        // 用户取消 → 不报错
        if ((err as Error)?.name === 'AbortError') return { id: __aiId };
        // 2) 降级：一次性 chat + 前端打字机
        try {
          const res = (await endpoints.ai.chat(rest)) as unknown;
          const content =
            typeof res === 'string'
              ? res
              : res && typeof res === 'object' && 'content' in (res as Record<string, unknown>)
                ? String((res as { content: string }).content)
                : JSON.stringify(res);
          await typewrite(content, (c) => opts.onChunk(c, __aiId), () => opts.onDone?.(__aiId));
        } catch (e) {
          opts.onError?.(e as Error, __aiId);
          throw e;
        }
      }
      return { id: __aiId };
    },
  });
}

/** 逐字打字机：每 ~18ms 输出一段，模拟流式。 */
function typewrite(content: string, onChunk: (c: string) => void, onDone: () => void) {
  return new Promise<void>((resolve) => {
    let i = 0;
    const tick = () => {
      const step = Math.max(1, Math.floor(content.length / 80));
      const next = Math.min(content.length, i + step);
      onChunk(content.slice(i, next));
      i = next;
      if (i >= content.length) {
        onDone();
        resolve();
      } else {
        setTimeout(tick, 18);
      }
    };
    tick();
  });
}

/** 流式打字机光标，内容是外部受控的（onChunk 持续追加），所以这里只加光标闪烁 */
function TypewriterInline({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref}>
      {text}
      <span className="inline-block w-[2px] h-[1em] align-[-2px] ml-0.5 bg-primary/80 animate-shimmer" aria-hidden />
    </span>
  );
}

/* Skeleton fallback (unused, reserved) */
export const __unused__AISkeletons = () => (
  <>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="rounded-xl border border-border/50 bg-muted/15 p-3 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    ))}
  </>
);
