'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Plus,
  Trash2,
  Gavel,
  Clock,
  Sparkles,
  Users,
  Zap,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { endpoints } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import { cn, formatRelative, labelOf, rankMedal } from '@/lib/utils';
import type {
  AuctionDto,
  PageResult,
  PointCategory,
  PointDto,
  PointRankingDto,
  StudentDto,
} from '@spark/shared';

const CATEGORY_SCORE_MAP: Record<string, number> = {
  ANSWER: 1,
  TOP3: 3,
  HOMEWORK_ON_TIME: 1,
  HOMEWORK_QUALITY: 2,
  NOTE_QUALITY: 2,
  OTHER: 1,
};

export default function PointsPage() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const classes = useAppStore((s) => s.classes);
  const push = useAppStore((s) => s.pushToast);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="spark-eyebrow"><Sparkles className="h-3 w-3" /> POINTS & AUCTIONS</span>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight spark-title-gradient">
            积分 & 竞拍市场
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            班级当前：
            <Badge variant="outline" className="ml-2">
              <Users className="h-3 w-3 mr-1" />
              {activeClassId ? classes.find((c) => c.id === activeClassId)?.name ?? '未选班级' : '请先选择班级'}
            </Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddPointDialog />
          <CreateAuctionDialog />
        </div>
      </div>

      <Tabs defaultValue="ranking">
        <TabsList>
          <TabsTrigger value="ranking"><Crown className="h-3.5 w-3.5 mr-1" /> 排行榜</TabsTrigger>
          <TabsTrigger value="ledger"><Zap className="h-3.5 w-3.5 mr-1" /> 积分明细</TabsTrigger>
          <TabsTrigger value="auctions"><Gavel className="h-3.5 w-3.5 mr-1" /> 竞拍市场</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking"><RankingPanel /></TabsContent>
        <TabsContent value="ledger"><LedgerPanel /></TabsContent>
        <TabsContent value="auctions"><AuctionsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------- 排行榜 ----------------------------- */
function RankingPanel() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const { data, isLoading } = useQuery<PointRankingDto[]>({
    queryKey: ['points', 'ranking', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return [];
      return endpoints.points.ranking(activeClassId, 50) as Promise<PointRankingDto[]>;
    },
    enabled: !!activeClassId,
  });

  const list = data ?? [];
  const max = list[0]?.totalScore ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-accent" /> 班级积分榜</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 flex-1 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            ))
          : list.length === 0
          ? <EmptyState text="暂无积分数据，先给学生加一次分吧。" />
          : <ol className="space-y-2">
              {list.map((r, i) => (
                <motion.li
                  key={r.studentId}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.02 }}
                  className="group grid grid-cols-[auto_2.5rem_1fr_auto] items-center gap-3 rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5 hover:bg-muted/30 transition"
                >
                  <div className={cn('w-7 text-center tabular text-sm font-semibold', {
                    'text-amber-400': r.rank === 1,
                    'text-slate-300': r.rank === 2,
                    'text-orange-400': r.rank === 3,
                    'text-muted-foreground': r.rank && r.rank > 3,
                  })}>
                    {rankMedal(r.rank) || `#${r.rank}`}
                  </div>
                  <div className={cn(
                    'grid h-10 w-10 place-items-center rounded-full font-semibold text-sm',
                    r.rank === 1 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.45)]' :
                    r.rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-black' :
                    r.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                    'bg-primary/15 text-primary',
                  )}>
                    {r.studentName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{r.studentName}</span>
                      <Badge variant="outline" className="text-[10px]">No.{r.serialNo}</Badge>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(r.totalScore / max) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', {
                          'bg-gradient-to-r from-amber-300 to-amber-500': r.rank === 1,
                          'bg-gradient-to-r from-slate-200 to-slate-400': r.rank === 2,
                          'bg-gradient-to-r from-orange-400 to-orange-600': r.rank === 3,
                          'bg-gradient-to-r from-primary to-accent': !r.rank || r.rank > 3,
                        })}
                      />
                    </div>
                  </div>
                  <div className="tabular text-right">
                    <div className="text-xl font-semibold">{r.totalScore}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">POINTS</div>
                  </div>
                </motion.li>
              ))}
            </ol>}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- 积分明细 ----------------------------- */
function LedgerPanel() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const { data, isLoading } = useQuery<PageResult<PointDto>>({
    queryKey: ['points', 'ledger', activeClassId, category],
    queryFn: async () => {
      if (!activeClassId) return { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 };
      return endpoints.points.query({
        classId: activeClassId,
        category: category === 'ALL' ? undefined : category,
        page: 1,
        pageSize: 200,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }) as Promise<PageResult<PointDto>>;
    },
    enabled: !!activeClassId,
  });
  const items = useMemo(() => {
    const arr = data?.items ?? [];
    if (!keyword) return arr;
    return arr.filter((p) => (p.studentName ?? '').includes(keyword));
  }, [data, keyword]);
  const qc = useQueryClient();
  const push = useAppStore((s) => s.pushToast);
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.points.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['points'] });
      push({ variant: 'success', title: '已删除该条积分记录' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>积分明细 · 时间轴</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="类别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部类别</SelectItem>
                {Object.entries({
                  ANSWER: '课堂回答', TOP3: '出门测前三', HOMEWORK_ON_TIME: '作业按时',
                  HOMEWORK_QUALITY: '作业优质', NOTE_QUALITY: '笔记优质', OTHER: '其他',
                }).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="搜索学生名" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-40" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-t border-border">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-6 w-40 rounded-full" />
                <Skeleton className="h-4 flex-1 rounded" />
              </div>
            ))
          : items.length === 0
          ? <EmptyState text="还没有积分记录。" />
          : <ul className="relative border-l border-border/60 ml-3 pl-6 space-y-5">
              {items.map((p) => (
                <li key={p.id} className="relative group">
                  <span className="absolute -left-[31px] top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-primary to-accent shadow-glow">
                    <Zap className="h-2.5 w-2.5 text-primary-foreground" />
                  </span>
                  <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border/40 bg-muted/10 p-3 hover:bg-muted/25 transition">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.studentName ?? '学生'}</span>
                        <Badge variant="gold">+{p.score}</Badge>
                        <Badge variant="outline">{labelOf('PointCategory', p.category as PointCategory)}</Badge>
                        {p.lessonIndex ? <Badge variant="outline">第 {p.lessonIndex} 讲</Badge> : null}
                      </div>
                      {p.reason && <p className="mt-1 text-sm text-muted-foreground">{p.reason}</p>}
                      <p className="mt-1 text-xs text-muted-foreground tabular">{formatRelative(p.createdAt)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition"
                      onClick={() => remove.mutate(p.id)} disabled={remove.isPending}>
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- 竞拍市场 ----------------------------- */
function AuctionsPanel() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const { data, isLoading } = useQuery<AuctionDto[]>({
    queryKey: ['auctions', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return [];
      return (endpoints.auctions.list(activeClassId) as unknown) as AuctionDto[];
    },
    enabled: !!activeClassId,
  });
  const list = data ?? [];
  const [open, openBid, settle] = useBidTools();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {isLoading && Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}><CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" />
        </CardContent></Card>
      ))}
      {!isLoading && list.length === 0 && (
        <Card className="col-span-full">
          <CardContent className="p-10 text-center text-muted-foreground">
            暂无竞拍品。点击右上角「发布拍品」上架奖品，用学生积分来竞拍。
          </CardContent>
        </Card>
      )}
      {list.map((a, i) => {
        const left = Math.max(0, new Date(a.expiresAt).getTime() - Date.now());
        const openBidding = a.status === 'OPEN' && left > 0;
        return (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="spark-card-hover h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant={openBidding ? 'gold' : 'outline'}>
                    {openBidding ? '竞拍中' : labelOf('AuctionStatus', a.status)}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground tabular">
                    <Clock className="h-3 w-3" />
                    {left > 0 ? `${Math.floor(left / 86400000)}d ${Math.floor((left % 86400000) / 3600000)}h` : '已结束'}
                  </div>
                </div>
                <CardTitle className="mt-2 text-lg">{a.title}</CardTitle>
                {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">起拍</div>
                    <div className="mt-1 tabular text-xl font-semibold">{a.startingPrice}</div>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-3 ring-1 ring-primary/30">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">当前价</div>
                    <div className="mt-1 tabular text-xl font-semibold text-primary">{a.currentPrice}</div>
                  </div>
                </div>
                {a.winnerName ? (
                  <Badge variant="gold" className="w-full justify-center py-1.5">
                    <Trophy className="h-3.5 w-3.5 mr-1" /> 获得者：{a.winnerName}
                  </Badge>
                ) : (
                  <div className="text-xs text-muted-foreground text-center">暂无人出价</div>
                )}
                <div className="flex gap-2">
                  {openBidding && (
                    <Button className="flex-1" onClick={() => openBid(a)}>
                      <Gavel className="h-4 w-4 mr-1" /> 出价
                    </Button>
                  )}
                  {!openBidding && !a.winnerId && (
                    <Button variant="outline" className="flex-1" onClick={() => settle(a.id)}>
                      流标 · 结束
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function useBidTools() {
  const qc = useQueryClient();
  const push = useAppStore((s) => s.pushToast);
  const [auction, setAuction] = useState<AuctionDto | null>(null);
  const [price, setPrice] = useState<string>('');
  const students = useStudentsInClass();
  const [bidderId, setBidderId] = useState<string>('');
  const bidMut = useMutation({
    mutationFn: async () => {
      if (!auction) return null;
      const p = Number(price);
      if (!Number.isFinite(p)) throw new Error('价格不合法');
      if (p <= auction.currentPrice) throw new Error(`必须高于当前价 ${auction.currentPrice}`);
      return endpoints.auctions.bid({ auctionId: auction.id, price: p, studentId: bidderId || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auctions'] });
      qc.invalidateQueries({ queryKey: ['points'] });
      setAuction(null); setPrice('');
      push({ variant: 'success', title: '出价成功' });
    },
    onError: (e: any) => push({ variant: 'error', title: '出价失败', description: e.message }),
  });
  const settleMut = useMutation({
    mutationFn: (id: string) => endpoints.auctions.settle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auctions'] });
      qc.invalidateQueries({ queryKey: ['points'] });
      push({ variant: 'success', title: '已结束该竞拍' });
    },
  });
  const openBid = (a: AuctionDto) => { setAuction(a); setPrice(String(a.startingPrice)); };
  const DialogComp = (
    <Dialog open={!!auction} onOpenChange={(o) => !o && setAuction(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>出价竞拍 — {auction?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">起拍价</span>
            <span className="tabular">{auction?.startingPrice}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">当前价</span>
            <span className="tabular font-semibold text-primary">{auction?.currentPrice}</span>
          </div>
          <div>
            <Label>出价学生（可选）</Label>
            <Select value={bidderId} onValueChange={setBidderId}>
              <SelectTrigger><SelectValue placeholder="未指定（匿名加分）" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · No.{s.serialNo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>积分出价</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="tabular text-lg font-semibold" />
            <p className="mt-1 text-xs text-muted-foreground">出价必须高于当前价 {auction?.currentPrice}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAuction(null)}>取消</Button>
          <Button onClick={() => bidMut.mutate()} disabled={bidMut.isPending}>
            <Gavel className="h-4 w-4 mr-1" /> 确认出价
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return [DialogComp, openBid, (id: string) => settleMut.mutate(id)] as const;
}

function useStudentsInClass(): StudentDto[] {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const { data } = useQuery({
    queryKey: ['students', 'simple', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return [] as StudentDto[];
      const res = await endpoints.students.query({
        classId: activeClassId, page: 1, pageSize: 300, status: 'ACTIVE',
      }) as PageResult<StudentDto>;
      return res.items;
    },
    enabled: !!activeClassId,
  });
  return data ?? [];
}

/* ----------------------------- Dialogs ----------------------------- */
function AddPointDialog() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const push = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();
  const students = useStudentsInClass();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState<string>('ANSWER');
  const [score, setScore] = useState<string>(String(CATEGORY_SCORE_MAP.ANSWER));
  const [reason, setReason] = useState('');

  const mut = useMutation({
    mutationFn: () => endpoints.points.create({
      studentId, category, score: Number(score), reason: reason || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['points'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      push({ variant: 'success', title: '加分成功', description: `已加 ${score} 分` });
      setOpen(false); setReason(''); setScore(String(CATEGORY_SCORE_MAP[category] ?? 1));
    },
    onError: (e: any) => push({ variant: 'error', title: '加分失败', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!activeClassId}><Plus className="h-4 w-4" /> 快速加分</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>给学生加积分</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label>学生</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="选择学生" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · No.{s.serialNo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>类别</Label>
            <Select value={category} onValueChange={(v) => {
              setCategory(v);
              setScore(String(CATEGORY_SCORE_MAP[v] ?? 1));
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries({
                  ANSWER: '课堂回答 (+1)', TOP3: '出门测前三 (+3)',
                  HOMEWORK_ON_TIME: '作业按时 (+1)', HOMEWORK_QUALITY: '作业优质 (+2)',
                  NOTE_QUALITY: '笔记优质 (+2)', OTHER: '其他 (+自定义)',
                }).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>分值</Label>
              <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div>
              <Label>理由（可选）</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：白板板书优秀" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !studentId}>
            <Zap className="h-4 w-4 mr-1" /> 确认加分
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateAuctionDialog() {
  const push = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('50');
  const [hours, setHours] = useState('72');
  const mut = useMutation({
    mutationFn: () => endpoints.auctions.create({
      title, description: desc || undefined, startingPrice: Number(price),
      expiresAt: new Date(Date.now() + Number(hours) * 3600_000).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auctions'] });
      push({ variant: 'success', title: '拍品已上架' });
      setOpen(false); setTitle(''); setDesc('');
    },
    onError: (e: any) => push({ variant: 'error', title: '上架失败', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Gavel className="h-4 w-4 mr-1" /> 发布拍品</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>发布竞拍品</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div><Label>拍品名称</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：免罚券 / 零食大礼包" /></div>
          <div><Label>介绍（可选）</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="简短介绍" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>起拍积分</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div><Label>持续（小时）</Label><Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !title}>
            确认上架
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground">
      <Sparkles className="mx-auto h-8 w-8 opacity-50 mb-3" />
      {text}
    </div>
  );
}
