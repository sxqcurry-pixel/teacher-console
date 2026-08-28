'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PhoneCall,
  MessageSquare,
  Users,
  HeartHandshake,
  Plus,
  Send,
  Search,
  Filter,
  RefreshCw,
  CalendarDays,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
import { endpoints } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import { cn, formatDate, formatRelative, labelOf } from '@/lib/utils';
import type { CommunicationDto, CommType, PageResult, RenewalStatus, StudentDto } from '@spark/shared';

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="spark-eyebrow"><HeartHandshake className="h-3 w-3" /> PARENT · COMMUNICATIONS</span>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight spark-title-gradient">
            家校沟通 & 续费跟进
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按五段式框架记录沟通：摸底 → 分析 → 方案 → 认知 → 收口。所有记录均可按续费意向快速筛选。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RenewalSummaryBadges />
          <NewCommDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /> 沟通时间轴</CardTitle>
              <Toolbar />
            </div>
            <CardDescription>最新记录在顶部，可点击「新增记录」快速录入。</CardDescription>
          </CardHeader>
          <CardContent>
            <TimelinePanel />
          </CardContent>
        </Card>

        <SidebarTemplates />
      </div>
    </div>
  );
}

function RenewalSummaryBadges() {
  const { data = [] } = useComms();
  const counts = useMemo(() => {
    const c = { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
    data.forEach((r) => {
      const k = r.renewalStatus ?? 'NONE';
      if (k === 'HIGH' || k === 'MEDIUM' || k === 'LOW') c[k] += 1; else c.NONE += 1;
    });
    return c;
  }, [data]);
  return (
    <div className="hidden md:flex items-center gap-1 rounded-xl border border-border/50 bg-muted/10 px-3 py-2 text-xs">
      <Badge variant="gold" className="text-[10px]">高意向 {counts.HIGH}</Badge>
      <Badge variant="outline" className="text-[10px]">跟进中 {counts.MEDIUM}</Badge>
      <Badge variant="destructive" className="text-[10px] opacity-80">待激活 {counts.LOW}</Badge>
    </div>
  );
}

/* ----------------------------- 工具条 ----------------------------- */
function Toolbar() {
  const [keyword, setKeyword] = useState('');
  const [renewal, setRenewal] = useState<string>('ALL');
  const [type, setType] = useState<string>('ALL');
  const setF = useAppStore((s) => s.setCommFilter);
  React.useEffect(() => { setF({ keyword, renewal, type }); }, [keyword, renewal, type, setF]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="搜索学生 / 内容" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-8 w-52" />
      </div>
      <Select value={renewal} onValueChange={setRenewal}>
        <SelectTrigger className="w-36"><Filter className="h-3.5 w-3.5 mr-1.5 opacity-70 inline" /> <SelectValue placeholder="续费意向" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">全部意向</SelectItem>
          <SelectItem value="HIGH">高意向</SelectItem>
          <SelectItem value="MEDIUM">跟进中</SelectItem>
          <SelectItem value="LOW">待激活</SelectItem>
          <SelectItem value="_NONE">未标注</SelectItem>
        </SelectContent>
      </Select>
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-32"><SelectValue placeholder="沟通方式" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">全部方式</SelectItem>
          <SelectItem value="PHONE">电话</SelectItem>
          <SelectItem value="WECHAT">微信</SelectItem>
          <SelectItem value="FACE_TO_FACE">面谈</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function useComms(): { data: CommunicationDto[]; isLoading: boolean } {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const q = useAppStore((s) => s.commFilter);
  const { data, isLoading } = useQuery<CommunicationDto[]>({
    queryKey: ['communications', activeClassId, q],
    queryFn: async () => {
      const res = (await endpoints.communications.query({
        classId: activeClassId,
        page: 1,
        pageSize: 300,
        keyword: q?.keyword || undefined,
        renewalStatus: !q?.renewal || q.renewal === 'ALL' ? undefined : q.renewal === '_NONE' ? '' : q.renewal,
        type: !q?.type || q.type === 'ALL' ? undefined : q.type,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })) as PageResult<CommunicationDto>;
      return res.items;
    },
    enabled: !!activeClassId,
  });
  return { data: data ?? [], isLoading };
}

/* ----------------------------- 时间轴 ----------------------------- */
function TimelinePanel() {
  const { data, isLoading } = useComms();
  const push = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => endpoints.communications.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communications'] });
      push({ variant: 'success', title: '已删除记录' });
    },
  });

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-6 w-6 rounded-full mt-1" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );

  if (data.length === 0) return (
    <div className="py-16 text-center text-muted-foreground">
      <HeartHandshake className="mx-auto h-8 w-8 opacity-50 mb-3" />
      还没有沟通记录。点击右上角「新增记录」开始跟进第一个学生。
    </div>
  );

  return (
    <ul className="relative border-l border-border/60 ml-3 pl-6 space-y-5">
      <AnimatePresence initial={false}>
        {data.map((c, i) => (
          <motion.li
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: i * 0.02 }}
            className="relative group"
          >
            <TimelineIcon type={c.type as CommType} />
            <div className="rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/25 transition p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{labelOf('CommType', c.type as CommType)}</Badge>
                  <span className="font-semibold">{c.studentName ?? '未标注学生'}</span>
                  <Badge variant="ghost" className="tabular text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3 mr-1" />
                    {formatRelative(c.createdAt)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {c.renewalStatus && (
                    <Badge variant={c.renewalStatus === 'HIGH' ? 'gold' : c.renewalStatus === 'MEDIUM' ? 'outline' : 'destructive'}
                      className={cn(c.renewalStatus === 'LOW' && 'opacity-80')}>
                      <HeartHandshake className="h-3 w-3 mr-1" />
                      {labelOf('RenewalStatus', c.renewalStatus as RenewalStatus)}
                    </Badge>
                  )}
                  <Button
                    variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition"
                    onClick={() => del.mutate(c.id)} disabled={del.isPending}
                    title="删除"
                  >
                    <svg viewBox="0 0 15 15" className="h-4 w-4 text-error" fill="none" aria-hidden>
                      <path d="M1.5 4.5h12M6 1.5h3M3 4.5l.6 7.5a1 1 0 001 .9h5.8a1 1 0 001-.9l.6-7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
              {c.followUp && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-primary/80 mb-0.5">后续动作</div>
                    <div className="text-sm">{c.followUp}</div>
                  </div>
                </div>
              )}
              <div className="mt-2 text-[11px] text-muted-foreground tabular">
                记录时间：{formatDate(c.createdAt)}
              </div>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function TimelineIcon({ type }: { type: CommType }) {
  const map = {
    PHONE: { Icon: PhoneCall, cls: 'bg-primary text-primary-foreground' },
    WECHAT: { Icon: MessageSquare, cls: 'bg-success text-success-foreground' },
    FACE_TO_FACE: { Icon: Users, cls: 'bg-accent text-accent-foreground' },
  } as const;
  const { Icon, cls } = map[type] ?? map.WECHAT;
  return (
    <span className={cn('absolute -left-[31px] top-1.5 grid h-6 w-6 place-items-center rounded-full ring-4 ring-background shadow', cls)}>
      <Icon className="h-3 w-3" />
    </span>
  );
}

/* ----------------------------- 新增 Dialog ----------------------------- */
function NewCommDialog() {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState<string>('WECHAT');
  const [renewal, setRenewal] = useState<string>('MEDIUM');
  const [content, setContent] = useState('');
  const [followUp, setFollowUp] = useState('');
  const qc = useQueryClient();
  const push = useAppStore((s) => s.pushToast);
  const activeClassId = useAppStore((s) => s.activeClassId);

  const students = useStudentsInClass();

  const mut = useMutation({
    mutationFn: () => endpoints.communications.create({
      studentId, type, content, followUp: followUp || undefined, renewalStatus: renewal,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communications'] });
      push({ variant: 'success', title: '沟通记录已保存' });
      setOpen(false); setContent(''); setFollowUp('');
    },
    onError: (e: any) => push({ variant: 'error', title: '保存失败', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!activeClassId}><Plus className="h-4 w-4 mr-1" /> 新增记录</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> 记录一次家校沟通</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="md:col-span-1">
            <Label>学生</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="选择学生" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · No.{s.serialNo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>沟通方式</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WECHAT">微信</SelectItem>
                <SelectItem value="PHONE">电话</SelectItem>
                <SelectItem value="FACE_TO_FACE">面谈</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>续费意向</Label>
            <Select value={renewal} onValueChange={setRenewal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">高意向</SelectItem>
                <SelectItem value="MEDIUM">跟进中</SelectItem>
                <SelectItem value="LOW">待激活</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <Label>沟通内容（推荐按五段式）</Label>
          <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)}
            placeholder={`1️⃣ 摸底：寒暄 + 最近 1 个具体正向细节\n2️⃣ 分析：3 句数据讲薄弱项\n3️⃣ 方案：分 3 级给出可执行方案\n4️⃣ 认知：引导家长认识到根因\n5️⃣ 收口：给出选择（A/B/C）并约好下次联系时间`} />
        </div>
        <div className="mt-3">
          <Label>后续动作（可选）</Label>
          <Textarea rows={2} value={followUp} onChange={(e) => setFollowUp(e.target.value)}
            placeholder="如：下周三 20:00 回访阶段测成绩" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={() => mut.mutate()} disabled={!studentId || !content || mut.isPending}>
            保存记录
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useStudentsInClass(): StudentDto[] {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const { data } = useQuery({
    queryKey: ['students', 'simple', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return [] as StudentDto[];
      const res = await endpoints.students.query({ classId: activeClassId, page: 1, pageSize: 300, status: 'ACTIVE' }) as PageResult<StudentDto>;
      return res.items;
    },
    enabled: !!activeClassId,
  });
  return data ?? [];
}

/* ----------------------------- 侧边话术模板 ----------------------------- */
function SidebarTemplates() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">五段式话术小抄</CardTitle>
        <CardDescription>点卡片可一键复制话术开头</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <CopyCard title="① 摸底开场" text="哈喽 XX 妈妈～昨天课堂上 XX 主动上台讲了一道几何题，思路非常清晰，全班同学都给她鼓掌了！我特别记下来想先跟您夸一夸～" />
        <CopyCard title="② 客观分析" text="客观来看，XX 在『二次函数·分类讨论』这一块还需要补强：最近 3 次讲次测里，这个题型得分率 42%，和班级平均 68% 相比有点差距；不过她的计算题得分率 91%，计算习惯非常稳。" />
        <CopyCard title="③ 提供方案" text="我给您三个方案，您看哪个更贴合家庭节奏：\nA 方案（轻松）：每晚 15 分钟分类讨论专题，2 周后测试\nB 方案（标准）：额外加一次周末一对一复盘 + 专题\nC 方案（强效果）：连续 3 周小测 + 每周复盘，直到稳定在 85 分" />
        <CopyCard title="④ 引导认知" text="我觉得 XX 现在的问题不是『粗心』，而是拿到题目的『分类讨论顺序』还没形成习惯；这类习惯一旦建立，接下来学相似、圆这些综合题时会非常省力，反而越晚补越容易丢冤枉分。" />
        <CopyCard title="⑤ 收口约时间" text="那我先按 XX 方案给 XX 准备材料，明天我把具体执行清单发给您；下周三晚上 8 点我再回访一次，咱们看看第一周的效果，再做微调～" />
      </CardContent>
    </Card>
  );
}

function CopyCard({ title, text }: { title: string; text: string }) {
  const push = useAppStore((s) => s.pushToast);
  return (
    <div className="group rounded-xl border border-border/50 bg-muted/15 p-3 hover:bg-muted/30 transition">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{title}</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition"
          onClick={() => {
            navigator.clipboard?.writeText(text);
            push({ variant: 'success', title: '话术已复制' });
          }}>
          <RefreshCw className={cn('h-3 w-3 mr-1 rotate-[-45deg] scale-x-[-1]')} /> 复制
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}
