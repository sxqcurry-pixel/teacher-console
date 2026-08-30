'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shuffle,
  History,
  RotateCcw,
  Users,
  Crown,
  Sparkles,
  Trophy,
  Play,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { endpoints } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import { cn, formatRelative } from '@/lib/utils';
import type { StudentDto, PageResult, WheelHistoryDto, WheelSegment, WheelSpinResult } from '@spark/shared';

const PALETTE = [
  '#F97316', '#FACC15', '#FB923C', '#FED7AA', '#EA580C', '#EAB308',
  '#FDBA74', '#F59E0B', '#FBBF24', '#FDE68A',
];

export default function WheelPage() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const classes = useAppStore((s) => s.classes);
  const className = activeClassId ? classes.find((c) => c.id === activeClassId)?.name ?? '未选班级' : '请先选择班级';
  const qc = useQueryClient();

  // 基础学生池
  const { data, isLoading } = useQuery<PageResult<StudentDto>>({
    queryKey: ['students', 'roster', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return { items: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      return endpoints.students.query({ classId: activeClassId, page: 1, pageSize: 300, status: 'ACTIVE' }) as Promise<PageResult<StudentDto>>;
    },
    enabled: !!activeClassId,
  });

  const students = data?.items ?? [];
  const studentsRef = React.useRef<StudentDto[]>([]);

  // 扇区：初始化为学生池，权重默认 1；可淘汰
  const [segments, setSegments] = useState<WheelSegment[]>([]);
  const [elimination, setElimination] = useState(false);
  const [winner, setWinner] = useState<{ segment: WheelSegment; rotation: number } | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');

  // ==== 【根治无限循环 1/3】重建 segments
  //
  // 之前写法：
  //   useEffect(() => { if (students.length===0) setSegments([]); setSegments(prev => { ... }) }, [students]);
  //   React Query 每次渲染都会返回 items 数组的全新引用 → students 引用变化 → effect 跑 → setState →
  //   重渲染 → 新 students 引用 → 循环跑，触发 Maximum update depth exceeded。
  //
  // 现在用 ref 缓存上次应用的 id 集（O(1)）。只有"学生 id 集合发生变化（增删）"才会真正调用 setSegments；
  // 引用变了但 id 没变（例如完全相同内容的重请求）→ 不 setState → 不重渲染 → 不死循环。
  useEffect(() => {
    if (manualMode) return; // 手动模式下不要被 effect 重置扇区
    if (students.length === 0) {
      if (segments.length === 0) return; // 已经是 []，不 setState
      setSegments([]);
      studentsRef.current = [];
      return;
    }
    const curIds = studentsRef.current ?? [];
    const sameLen = curIds.length === students.length;
    const sameContent = sameLen && curIds.every((s, i) => s?.id === students[i]?.id);
    if (sameContent) return; // 学生池实际内容没变 → 绝对不 setState（最关键）

    // 重建 —— 只跑一次
    const idSet = new Set(students.map((s) => s.id));
    const keep = segments.filter((s) => s.studentId && idSet.has(s.studentId));
    const keepIds = new Set(keep.map((s) => s.studentId));
    const added = students
      .filter((s) => !keepIds.has(s.id))
      .map((s, i) => ({
        id: s.id,
        studentId: s.id,
        label: s.name,
        weight: 1,
        eliminateOnWin: elimination,
        eliminated: false,
        color: PALETTE[(keep.length + i) % PALETTE.length],
      }));
    const next = [...keep, ...added];
    // 如果顺序不同也保持稳定
    setSegments(next);
    studentsRef.current = [...students];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  // 【根治无限循环 2/3】history：直接用 React Query 的 data + 本地追加写回 qc.setQueryData
  //
  // 之前写法：
  //   const [history, setHistory] = useState([]);
  //   useEffect(() => { if (historyQuery.data) setHistory(historyQuery.data); }, [historyQuery.data]);
  //   onWin: setHistory([localAppend, ...h]);
  // 效果：historyQuery.data 引用变（每次返回新数组）→ setHistory → 重渲染 → historyQuery.data 引用再变 → 循环
  //
  // 现在：不做 state 镜像，只依赖 query 缓存。onWin 时通过 setQueryData 追加进缓存，
  // React Query 内部有去重逻辑，不会无限触发渲染。
  const historyQuery = useQuery<WheelHistoryDto[]>({
    queryKey: ['wheel', 'history', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return [];
      return endpoints.wheel.history(activeClassId, 50) as Promise<WheelHistoryDto[]>;
    },
    enabled: !!activeClassId,
  });
  const history = historyQuery.data ?? [];

  const alive = segments.filter((s) => !s.eliminated);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="spark-eyebrow"><Shuffle className="h-3 w-3" /> WHEEL · LIVE</span>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight spark-title-gradient">
            课堂互动转盘
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            班级：<Badge variant="outline" className="ml-1"><Users className="h-3 w-3 mr-1" />{className}</Badge>
            <span className="mx-2 text-border">·</span>
            扇区数 <span className="tabular text-foreground font-semibold">{alive.length}</span>
            / {segments.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeSwitcher value={manualMode ? 'PRIZE' : 'STUDENT'} onChange={(m) => {
            setManualMode(m === 'PRIZE');
            if (m === 'PRIZE') {
              const def: WheelSegment[] = [
                { id: 'p1', label: '免罚券', weight: 2, color: PALETTE[0] },
                { id: 'p2', label: '棒棒糖', weight: 3, color: PALETTE[1] },
                { id: 'p3', label: '+5 分', weight: 3, color: PALETTE[2] },
                { id: 'p4', label: '下次免作业', weight: 1, color: PALETTE[3] },
                { id: 'p5', label: '座位优选', weight: 2, color: PALETTE[4] },
                { id: 'p6', label: '再来一次', weight: 1, color: PALETTE[5] },
              ];
              setSegments(def);
            } else {
              setSegments(students.map((s, i) => ({
                id: s.id, studentId: s.id, label: s.name, weight: 1,
                eliminateOnWin: false, eliminated: false, color: PALETTE[i % PALETTE.length],
              })));
            }
          }} />
          <Button variant="ghost" onClick={() => {
            setSegments((prev) => prev.map((s) => ({ ...s, eliminated: false })));
          }}>
            <RotateCcw className="h-4 w-4 mr-1" /> 重置淘汰
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-accent" />
                {manualMode ? '抽奖转盘' : '随机点名'}
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={elimination}
                    onCheckedChange={(v) => {
                      setElimination(v);
                      setSegments((prev) => prev.map((s) => ({ ...s, eliminateOnWin: v })));
                    }}
                  />
                  <Label className="text-xs text-muted-foreground m-0">淘汰模式（抽中移除）</Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <WheelStage
              segments={alive}
              elimination={elimination}
              mode={manualMode ? 'PRIZE' : 'STUDENT'}
              classId={activeClassId ?? undefined}
              onWin={(w) => {
                setWinner(w);
                setShowWin(true);
                if (elimination) {
                  setSegments((prev) => prev.map((s) => s.id === w.segment.id ? { ...s, eliminated: true } : s));
                }
                // 【根治无限循环 3/3】本地追加历史：不写 state，而是改 React Query 缓存
                const newEntry: WheelHistoryDto = {
                  id: 'local-' + Date.now(),
                  classId: activeClassId ?? '',
                  mode: manualMode ? 'PRIZE' : 'STUDENT',
                  winnerLabel: w.segment.label,
                  winnerStudentId: w.segment.studentId ?? null,
                  createdAt: new Date().toISOString(),
                };
                qc.setQueryData<WheelHistoryDto[]>(
                  ['wheel', 'history', activeClassId],
                  (old) => [newEntry, ...(old ?? []).filter((x) => !x.id.startsWith('local-') || x.id !== newEntry.id)].slice(0, 50),
                );
              }}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        {/* 右侧：扇区配置 + 历史 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" /> 扇区设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
              {manualMode && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="自定义扇区，用逗号分隔"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                  />
                  <Button onClick={() => {
                    const parts = manualText.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
                    if (!parts.length) return;
                    setSegments(parts.map((l, i) => ({
                      id: `custom-${i}-${Date.now()}`,
                      label: l,
                      weight: 1,
                      color: PALETTE[i % PALETTE.length],
                    })));
                    setManualText('');
                  }}>
                    <PlusMini className="h-4 w-4 mr-1" /> 应用
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {segments.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {manualMode ? '请先输入自定义扇区。' : '班级暂无在读学生。'}
                  </div>
                )}
                {segments.map((s) => (
                  <div key={s.id} className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 transition',
                    s.eliminated ? 'border-border/30 bg-muted/10 opacity-40' : 'border-border/60 bg-muted/20',
                  )}>
                    <span className="h-4 w-4 rounded-sm ring-1 ring-black/20" style={{ backgroundColor: s.color ?? '#F97316' }} />
                    <div className="flex-1 truncate text-sm">{s.label}</div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, weight: Math.max(0, x.weight - 1) } : x))}>
                        <span className="text-xs">−</span>
                      </Button>
                      <span className="tabular text-xs w-5 text-center">{s.weight}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, weight: x.weight + 1 } : x))}>
                        <span className="text-xs">+</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> 抽取历史</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
              {historyQuery.isLoading && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 flex-1 rounded" />
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
              ))}
              {!historyQuery.isLoading && history.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  还没有抽取记录，点中间开始 Spin 吧。
                </div>
              )}
              {history.map((h, i) => (
                <div key={h.id + '-' + i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/10 px-3 py-2">
                  <Badge variant="outline">{h.mode === 'PRIZE' ? '抽奖' : '点名'}</Badge>
                  <div className="flex-1 truncate text-sm font-medium">{h.winnerLabel}</div>
                  <div className="text-xs text-muted-foreground tabular">{formatRelative(h.createdAt)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 中奖弹窗 */}
      <AnimatePresence>
        {showWin && winner && (
          <Dialog open={showWin} onOpenChange={setShowWin}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle className="sr-only">中奖</DialogTitle></DialogHeader>
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="grid place-items-center py-6"
              >
                <div className="relative">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-amber-600 shadow-[0_0_60px_rgba(251,146,60,0.55)] ring-8 ring-amber-400/20"
                  >
                    <Trophy className="h-16 w-16 text-black drop-shadow" />
                  </motion.div>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="absolute left-1/2 top-1/2 block h-2 w-2 rounded-full"
                      style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                      initial={{ x: 0, y: 0, opacity: 1 }}
                      animate={{
                        x: Math.cos((i / 10) * Math.PI * 2) * 120,
                        y: Math.sin((i / 10) * Math.PI * 2) * 120,
                        opacity: 0,
                      }}
                      transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.3, delay: i * 0.03 }}
                    />
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <div className="spark-eyebrow text-accent"><Sparkles className="h-3 w-3" /> WINNER</div>
                  <div className="mt-2 text-4xl font-bold spark-title-gradient">{winner.segment.label}</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {elimination ? '已按淘汰模式暂时移出转盘池（可右上角重置）。' : '本次抽取完成。'}
                  </p>
                </div>
                <div className="mt-6 flex gap-2">
                  <Button variant="outline" onClick={() => setShowWin(false)}>关闭</Button>
                  <Button onClick={() => setShowWin(false)}><Play className="h-4 w-4 mr-1" /> 继续抽下一位</Button>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlusMini({ className }: { className?: string }) {
  return <svg viewBox="0 0 15 15" fill="none" className={className} aria-hidden><path d="M7.5 2.5v10m-5-5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function ModeSwitcher({ value, onChange }: { value: 'STUDENT' | 'PRIZE'; onChange: (v: 'STUDENT' | 'PRIZE') => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1">
      {(['STUDENT', 'PRIZE'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition',
            value === t
              ? 'bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-glow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t === 'STUDENT' ? '👨‍🎓 点名模式' : '🎁 抽奖模式'}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------- 转盘 Stage ----------------------------- */
function WheelStage({
  segments, elimination, mode, classId, onWin, isLoading,
}: {
  segments: WheelSegment[];
  elimination: boolean;
  mode: 'STUDENT' | 'PRIZE';
  classId?: string;
  onWin: (w: { segment: WheelSegment; rotation: number }) => void;
  isLoading?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wheelRef = useRef<SVGGElement | null>(null);
  const spinnerRef = useRef<gsap.core.Tween | null>(null);
  const rotationRef = useRef(0);
  const unmountedRef = useRef(false);
  const [spinning, setSpinning] = useState(false);
  const push = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();

  // 离开 /wheel 页时，必须 kill 正在进行的 GSAP 动画并标记组件已卸载，
  // 否则 5.2s 的长动画 + setState 回调会在已卸载组件上抛错，卡死路由切换。
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (spinnerRef.current) {
        try { spinnerRef.current.kill(); } catch {}
        spinnerRef.current = null;
      }
      // 兜底：清掉 wheelRef 节点上所有 gsap 痕迹
      if (wheelRef.current) {
        try { gsap.killTweensOf(wheelRef.current); } catch {}
      }
    };
  }, []);

  // 计算扇区路径
  const total = segments.reduce((a, b) => a + Math.max(0, b.weight), 0);
  const N = segments.length;
  const radius = 260;
  const cx = 300, cy = 300;

  const arcs = useMemo(() => {
    if (!N || total <= 0) return [] as Array<{ seg: WheelSegment; path: string; labelX: number; labelY: number; angle: number }>;
    const result: Array<{ seg: WheelSegment; path: string; labelX: number; labelY: number; angle: number }> = [];
    let acc = 0;
    segments.forEach((s, i) => {
      const w = Math.max(0, s.weight) / total;
      const start = acc * Math.PI * 2 - Math.PI / 2; // 让第一个扇区中心从顶部开始
      const end = (acc + w) * Math.PI * 2 - Math.PI / 2;
      const mid = (start + end) / 2;
      acc += w;
      const largeArc = end - start > Math.PI ? 1 : 0;
      const x1 = cx + radius * Math.cos(start);
      const y1 = cy + radius * Math.sin(start);
      const x2 = cx + radius * Math.cos(end);
      const y2 = cy + radius * Math.sin(end);
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const lx = cx + radius * 0.62 * Math.cos(mid);
      const ly = cy + radius * 0.62 * Math.sin(mid);
      // angle 用于标记扇区中线角度（deg），方便最后定位指针指到哪个扇区
      const angleDeg = (mid * 180) / Math.PI + 90;
      result.push({ seg: s, path, labelX: lx, labelY: ly, angle: normDeg(angleDeg) });
    });
    return result;
  }, [segments, total, N]);

  const spinMut = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error('请先选择班级');
      if (!segments.length) throw new Error('转盘还没有扇区');
      return endpoints.wheel.spin({ classId, segments, mode, enableElimination: elimination }) as Promise<WheelSpinResult>;
    },
    onSuccess: (res) => { if (!unmountedRef.current) animateSpin(res); },
    onError: (e: any) => {
      if (unmountedRef.current) return;
      push({ variant: 'error', title: '抽取失败', description: e.message });
      setSpinning(false);
    },
  });

  function animateSpin(res: WheelSpinResult) {
    if (!wheelRef.current) return onWin({ segment: res.winner, rotation: res.finalRotation });
    const winner = res.winner;
    const idx = arcs.findIndex((a) => a.seg.id === winner.id);
    const hit = idx >= 0 ? arcs[idx] : undefined;
    // 使用后端给定 finalRotation，加上 5 圈保证视觉感
    const base = 360 * 5;
    // 让指针（顶部，0°）对准目标扇区中心：我们需要把该扇区的 arc 中线角度旋转到 0 度
    const winnerCenter = hit?.angle ?? 0;
    const final = rotationRef.current + base + (360 - winnerCenter);
    spinnerRef.current?.kill();
    spinnerRef.current = gsap.to(wheelRef.current, {
      rotation: final,
      duration: 5.2,
      ease: 'power3.out',
      onStart: () => { if (!unmountedRef.current) setSpinning(true); },
      onComplete: () => {
        if (unmountedRef.current) return;
        rotationRef.current = final % 360;
        setSpinning(false);
        qc.invalidateQueries({ queryKey: ['wheel', 'history'] });
        onWin({ segment: winner, rotation: final });
      },
    });
  }

  function handleSpin() {
    if (spinning) return;
    if (!segments.length) return push({ variant: 'info', title: '扇区为空', description: '请先添加扇区或切换班级。' });
    spinMut.mutate();
  }

  return (
    <div className="relative w-full bg-gradient-to-b from-background via-background to-background/40 py-8">
      {/* 舞台光晕 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_40%,rgba(251,146,60,0.18),transparent_60%)]" />
      <div className="relative mx-auto" style={{ width: 'min(100%,640px)' }}>
        <svg ref={svgRef} viewBox="0 0 600 600" className="w-full h-auto drop-shadow-glow">
          <defs>
            <filter id="spark-wheel-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="10" />
              <feOffset dy="6" result="offsetblur" />
              <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="spark-wheel-ring" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
              <stop offset="80%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 外圈霓虹环 */}
          <circle cx={cx} cy={cy} r={radius + 24} fill="url(#spark-wheel-ring)" opacity="0.35" />
          <circle cx={cx} cy={cy} r={radius + 12} fill="none" stroke="hsl(var(--primary)/0.6)" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={radius + 6} fill="none" stroke="hsl(var(--accent)/0.5)" strokeDasharray="3 6" strokeWidth="1.2" />

          {/* 转盘主体 */}
          <g
            ref={wheelRef}
            style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'fill-box' as any }}
            filter="url(#spark-wheel-shadow)"
          >
            {isLoading || arcs.length === 0 ? (
              <circle cx={cx} cy={cy} r={radius} fill="hsl(var(--muted)/0.5)" stroke="hsl(var(--border))" strokeDasharray="4 8" />
            ) : (
              arcs.map(({ seg, path, labelX, labelY }, i) => {
                const angle = (labelX - cx) / radius; // 粗略用于文字旋转
                const rotate = (Math.atan2(labelY - cy, labelX - cx) * 180) / Math.PI + 90;
                return (
                  <g key={seg.id}>
                    <path
                      d={path}
                      fill={seg.color ?? PALETTE[i % PALETTE.length]}
                      stroke="hsl(var(--background))"
                      strokeWidth="2"
                      opacity={seg.eliminated ? 0.15 : 1}
                    />
                    <g transform={`translate(${labelX}, ${labelY}) rotate(${rotate})`}>
                      <text
                        x="0" y="0"
                        textAnchor="middle" dominantBaseline="middle"
                        fill="#0b0b0b"
                        fontSize={seg.label.length > 5 ? 14 : 18}
                        fontWeight={700}
                        style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.35)', strokeWidth: 3 }}
                      >
                        {seg.label}
                      </text>
                    </g>
                  </g>
                );
              })
            )}
            {/* 轮毂 */}
            <circle cx={cx} cy={cy} r={48} fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="3" />
            <circle cx={cx} cy={cy} r={34} fill="hsl(var(--primary))" />
            <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--primary-foreground))" fontSize={18} fontWeight={800}>
              SPARK
            </text>
          </g>

          {/* 指针（顶部） */}
          <g style={{ transformOrigin: `${cx}px ${cy - radius - 10}px` }}>
            <path
              d={`M ${cx - 20} ${cy - radius - 24} L ${cx + 20} ${cy - radius - 24} L ${cx} ${cy - radius + 18} Z`}
              fill="hsl(var(--accent))"
              stroke="hsl(var(--accent-foreground))"
              strokeWidth="2"
            />
            <circle cx={cx} cy={cy - radius - 24} r={8} fill="hsl(var(--accent))" />
          </g>
        </svg>

        {/* Spin 按钮 */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={handleSpin}
            disabled={spinning || !segments.length}
            className={cn(
              'rounded-full px-8 py-6 text-base shadow-[0_0_30px_rgba(251,146,60,0.45)]',
              'bg-gradient-to-r from-primary via-accent to-primary hover:brightness-110 active:scale-95 transition',
            )}
          >
            {spinning ? (
              <><RotateCcw className="h-5 w-5 mr-2 animate-spin" /> 旋转中…</>
            ) : (
              <><Shuffle className="h-5 w-5 mr-2" /> 开始 {mode === 'STUDENT' ? '抽答' : '抽奖'}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function normDeg(d: number) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}
