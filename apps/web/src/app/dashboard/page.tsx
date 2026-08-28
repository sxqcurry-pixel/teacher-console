'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Users2,
  GraduationCap,
  Award,
  TrendingUp,
  Handshake,
  ListTodo,
  Plus,
  Upload,
  Layers,
  Sparkles,
  ArrowUpRight,
  History,
  LineChart,
  MessageSquareMore,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { endpoints } from '@/lib/api';
import { formatRelative, labelOf, rankMedal } from '@/lib/utils';
import type { DashboardStats, PointRankingDto, RecentActivity } from '@spark/shared';
import { useAppStore } from '@/stores/app-store';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <HeroCTA />
      <StatsGrid />
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <ScoreTrendCard />
          <QuickActions />
        </div>
        <div className="space-y-6">
          <PointRankCard />
          <RecentActivityCard />
        </div>
      </section>
    </div>
  );
}

/* =============== 子组件 =============== */

function HeroCTA() {
  const classes = useAppStore((s) => s.classes);
  const push = useAppStore((s) => s.pushToast);
  const router = useRouter();
  const activeClassId = useAppStore((s) => s.activeClassId);
  return (
    <Card className="overflow-hidden relative !border-primary/25">
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" aria-hidden />
      <CardContent className="relative p-6 md:p-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3 max-w-2xl">
          <span className="spark-eyebrow">
            <LineChart className="h-3 w-3" /> 今日状态 · DASHBOARD
          </span>
          <h2 className="spark-h2 leading-tight">
            今天也要带孩子们，<span className="text-gradient-brand">冲上数学火箭班 🚀</span>
          </h2>
          <p className="text-muted-foreground">
            {activeClassId
              ? `当前工作班级：${classes.find((c) => c.id === activeClassId)?.name ?? '选择中'}。左侧可随时切换。`
              : '先在左上角侧栏选择班级，或创建你的第一个班级，开始管理学生名册。'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!classes.length ? (
            <Button
              size="lg"
              onClick={async () => {
                try {
                  const c = await endpoints.classes.create({
                    name: prompt('班级名称，如：初二数学火箭班') || '初二数学火箭班',
                    grade: prompt('年级，如：初二') || '初二',
                    subject: '数学',
                  });
                  push({ variant: 'success', title: '班级创建成功', description: (c as any).name });
                  router.refresh();
                } catch (e: any) {
                  push({ variant: 'error', title: '创建失败', description: e?.message ?? '' });
                }
              }}
            >
              <Plus className="h-4 w-4" /> 新建第一个班级
            </Button>
          ) : null}
          <Button size="lg" variant="gold" asChild>
            <Link href="/scores">
              <ArrowUpRight className="h-4 w-4" /> 开始录入成绩
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  delta?: string;
  tone: 'primary' | 'gold' | 'info' | 'success' | 'warning' | 'error';
}) {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });
  const toneMap: Record<string, string> = {
    primary: 'text-primary',
    gold: 'text-[hsl(45_93%_65%)]',
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };
  return (
    <Card ref={ref}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`h-10 w-10 grid place-items-center rounded-xl bg-${tone === 'gold' ? '[hsl(45_93%_55%)]/15' : 'primary/15'} ${toneMap[tone]} spark-glow`}>
            <Icon className="h-5 w-5" />
          </div>
          {delta && <Badge variant={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : tone === 'error' ? 'destructive' : 'default'}>{delta}</Badge>}
        </div>
        <div className="mt-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.05 }}
            className={`mt-1 font-semibold tabular ${toneMap[tone]} tracking-tight`}
            style={{ fontSize: 34, lineHeight: 1.1 }}
          >
            {value}
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => endpoints.dashboard.stats() as Promise<DashboardStats>,
  });
  const cards: Array<{ key: string; icon: any; label: string; value: React.ReactNode; tone: any }> = [
    { key: 'stu', icon: Users2, label: '在读学生总数', value: data?.totalStudents ?? '—', tone: 'primary' },
    { key: 'cls', icon: GraduationCap, label: '管理班级数', value: data?.activeClasses ?? '—', tone: 'gold' },
    { key: 'score', icon: TrendingUp, label: '最近一讲均分', value: data?.avgScoreLastLesson ?? '—', tone: 'info' },
    { key: 'pt', icon: Award, label: '累计发出积分', value: data?.totalPointsGiven ?? 0, tone: 'success' },
    { key: 'todo', icon: ListTodo, label: '未完成待办', value: data?.upcomingTodosCount ?? '—', tone: 'warning' },
    { key: 'rn', icon: Handshake, label: '续费跟进（30天）', value: data?.renewalFollowUpCount ?? '—', tone: 'error' },
  ];

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: i * 0.04 }}
        >
          {isLoading ? (
            <Card><CardContent className="p-5 space-y-3"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-8 w-24" /><Skeleton className="h-7 w-16" /></CardContent></Card>
          ) : (
            <StatCard {...c} />
          )}
        </motion.div>
      ))}
    </section>
  );
}

function ScoreTrendCard() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const classes = useAppStore((s) => s.classes);
  // 示例数据（成绩趋势）— 真实可由 scores 模块聚合接口返回
  const trend = [
    { name: '第1讲', 均分: 22.6, 优秀率: 32 },
    { name: '第2讲', 均分: 24.1, 优秀率: 38 },
    { name: '第3讲', 均分: 23.3, 优秀率: 34 },
    { name: '第4讲', 均分: 25.8, 优秀率: 44 },
    { name: '第5讲', 均分: 26.9, 优秀率: 51 },
    { name: '第6讲', 均分: 27.4, 优秀率: 56 },
  ];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <span className="spark-eyebrow">SCORE · TREND</span>
          <CardTitle className="mt-1">讲次成绩趋势</CardTitle>
        </div>
        <Badge variant="outline">
          {activeClassId ? classes.find((c) => c.id === activeClassId)?.name : '示例数据'}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(25 95% 53%)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(25 95% 53%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rateArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(45 93% 55%)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="hsl(45 93% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  boxShadow: '0 10px 40px -10px hsl(0 0% 0% / 60%)',
                }}
                cursor={{ stroke: 'hsl(var(--primary) / 0.4)', strokeDasharray: '3 4' }}
              />
              <Area type="monotone" dataKey="均分" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#scoreArea)" />
              <Area type="monotone" dataKey="优秀率" stroke="hsl(45 93% 55%)" strokeWidth={2.5} fill="url(#rateArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const items = [
    { key: 'import', icon: Upload, label: '批量导入学生', href: '/students', desc: 'Excel 拖拽 · 自动分序号', tone: 'primary' },
    { key: 'wheel', icon: Layers, label: '课堂转盘抽奖', href: '/wheel', desc: '权重 · 淘汰模式', tone: 'gold' },
    { key: 'ai', icon: Sparkles, label: 'AI 学习建议', href: '/ai', desc: '按学生一键生成', tone: 'info' },
    { key: 'msg', icon: MessageSquareMore, label: '家校话术模板', href: '/communications', desc: '五步沟通框架', tone: 'success' },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <span className="spark-eyebrow">QUICK · ACTIONS</span>
        <CardTitle className="mt-1">快捷入口</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-0">
        {items.map((a, i) => (
          <Link key={a.key} href={a.href} className="block">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="spark-glass spark-card-hover p-4 h-full flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary spark-glow">
                  <a.icon className="h-4.5 w-4.5" />
                </div>
                <div className="font-semibold">{a.label}</div>
              </div>
              <div className="text-xs text-muted-foreground">{a.desc}</div>
              <ArrowUpRight className="mt-auto h-4 w-4 ml-auto text-primary/70" />
            </motion.div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function PointRankCard() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const classes = useAppStore((s) => s.classes);
  const { data } = useQuery({
    queryKey: ['points', 'ranking', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return [];
      return endpoints.points.ranking(activeClassId, 8) as Promise<PointRankingDto[]>;
    },
    enabled: !!activeClassId,
  });
  const fallback: PointRankingDto[] = [
    { studentId: '1', studentName: '陈一诺', serialNo: 1, totalScore: 524, rank: 1 },
    { studentId: '2', studentName: '张思远', serialNo: 2, totalScore: 498, rank: 2 },
    { studentId: '3', studentName: '李明轩', serialNo: 3, totalScore: 472, rank: 3 },
    { studentId: '4', studentName: '王子涵', serialNo: 4, totalScore: 431, rank: 4 },
    { studentId: '5', studentName: '刘雨桐', serialNo: 5, totalScore: 418, rank: 5 },
  ];
  const list = (data && data.length ? data : fallback).slice(0, 6);
  const max = list[0]?.totalScore ?? 1;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <span className="spark-eyebrow">LEADERBOARD · TOP 6</span>
          <CardTitle className="mt-1">积分榜</CardTitle>
        </div>
        <Badge variant="gold">{activeClassId ? classes.find((c) => c.id === activeClassId)?.name : '示例'}</Badge>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={list} layout="vertical" margin={{ top: 6, left: 0, right: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 6" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                type="category"
                dataKey="studentName"
                width={68}
                fontSize={12}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10 }}
                cursor={{ fill: 'hsl(var(--primary) / 0.08)' }}
              />
              <Bar dataKey="totalScore" radius={[0, 8, 8, 0]}>
                {list.map((d, i) => (
                  <Cell key={i} fill={i === 0 ? 'hsl(45 93% 55%)' : i <= 2 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.55)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5">
          {list.map((s) => (
            <li key={s.studentId} className="flex items-center gap-3 text-sm">
              <div className="w-6 text-center tabular text-muted-foreground">{rankMedal(s.rank) || `#${s.rank}`}</div>
              <div className="flex-1 truncate">{s.serialNo}. {s.studentName}</div>
              <div className="tabular font-semibold text-primary">{s.totalScore}</div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RecentActivityCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => endpoints.dashboard.activity(20) as Promise<RecentActivity[]>,
  });
  const list = data ?? [];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <span className="spark-eyebrow"><History className="h-3 w-3" /> RECENT</span>
          <CardTitle className="mt-1">最近动态</CardTitle>
        </div>
        <Button variant="link" size="sm" asChild className="text-muted-foreground">
          <Link href="/todos">查看全部</Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="relative border-l border-dashed border-border ml-3 pl-5 py-2 space-y-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </li>
              ))
            : list.length === 0
              ? <li className="text-sm text-muted-foreground py-10 text-center">暂无动态</li>
              : list.slice(0, 8).map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/_0.7)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-background" />
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-medium leading-snug">{a.title}</div>
                      <div className="text-[11px] text-muted-foreground tabular whitespace-nowrap">{formatRelative(a.timestamp)}</div>
                    </div>
                    {a.subtitle && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {typeof a.subtitle === 'string' && a.subtitle.length < 10
                          ? labelOf('TodoCategory', a.subtitle) || a.subtitle
                          : a.subtitle}
                      </div>
                    )}
                  </li>
                ))}
        </ul>
      </CardContent>
    </Card>
  );
}
