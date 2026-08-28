'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ClipboardList,
  Sparkles,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
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
import { TodoCategory as TodoCategoryEnum } from '@spark/shared';
import type { TodoDto } from '@spark/shared';

type TodoCatFilter = typeof TodoCategoryEnum.LESSON_PREP | typeof TodoCategoryEnum.FOLLOW_UP | typeof TodoCategoryEnum.RENEWAL | typeof TodoCategoryEnum.ADMIN;
const TAB_KEYS: readonly ('ALL' | TodoCatFilter)[] = [
  'ALL',
  TodoCategoryEnum.LESSON_PREP,
  TodoCategoryEnum.FOLLOW_UP,
  TodoCategoryEnum.RENEWAL,
  TodoCategoryEnum.ADMIN,
] as const;

export default function TodosPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="spark-eyebrow"><ClipboardList className="h-3 w-3" /> TEACHER · TODOS</span>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight spark-title-gradient">
            教师待办清单
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按备课 / 跟进 / 续费 / 行政四大分类组织，自动同步到仪表盘今日卡片。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TodoProgressBadge />
          <NewTodoDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> 待办清单</CardTitle>
              <FilterHint />
            </div>
            <CardDescription>勾选后自动更新，可设置截止日期。</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="ALL">
              <TabsList>
                <TabsTrigger value="ALL">全部</TabsTrigger>
                <TabsTrigger value={TodoCategoryEnum.LESSON_PREP}>{labelOf('TodoCategory', TodoCategoryEnum.LESSON_PREP)}</TabsTrigger>
                <TabsTrigger value={TodoCategoryEnum.FOLLOW_UP}>{labelOf('TodoCategory', TodoCategoryEnum.FOLLOW_UP)}</TabsTrigger>
                <TabsTrigger value={TodoCategoryEnum.RENEWAL}>{labelOf('TodoCategory', TodoCategoryEnum.RENEWAL)}</TabsTrigger>
                <TabsTrigger value={TodoCategoryEnum.ADMIN}>{labelOf('TodoCategory', TodoCategoryEnum.ADMIN)}</TabsTrigger>
              </TabsList>
              {TAB_KEYS.map((k) => (
                <TabsContent key={k} value={k}>
                  <TodoList category={k === 'ALL' ? null : k} />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">今日 · 四象限</CardTitle>
            <CardDescription>紧急重要 → 重要不紧急 → 紧急不重要 → 不重要不紧急</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Quadrant />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------- 进度徽章 ----------------------------- */
function TodoProgressBadge() {
  const { data = [], isLoading } = useTodos('ALL');
  const total = data.length;
  const done = data.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (isLoading) return <Skeleton className="h-9 w-36 rounded-xl" />;
  return (
    <div className="relative rounded-xl border border-border/50 bg-muted/10 px-4 py-2 w-44">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">进度</span>
        <span className="tabular font-semibold">{done}/{total}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
        />
      </div>
    </div>
  );
}

function FilterHint() {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground">
      <Filter className="h-3 w-3" /> 上方 Tab 可按分类筛选
    </div>
  );
}

/* ----------------------------- 待办列表 ----------------------------- */
function useTodos(filter: TodoCatFilter | 'ALL' | null) {
  return useQuery<TodoDto[]>({
    queryKey: ['todos', filter],
    queryFn: async () => {
      const res = (await endpoints.todos.list({
        category: !filter || filter === 'ALL' ? undefined : filter,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: 1,
        pageSize: 300,
      })) as any;
      return Array.isArray(res) ? res : res.items ?? [];
    },
  });
}

function TodoList({ category }: { category: TodoCatFilter | null }) {
  const { data = [], isLoading } = useTodos(category ?? 'ALL');
  const list = useMemo(() => data, [data]);
  const qc = useQueryClient();
  const push = useAppStore((s) => s.pushToast);

  const toggle = useMutation({
    mutationFn: (t: TodoDto) => endpoints.todos.update(t.id, { completed: !t.completed }),
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: ['todos'] });
      const prev = qc.getQueryData<TodoDto[]>(['todos', category ?? 'ALL']) ?? [];
      qc.setQueryData<TodoDto[]>(['todos', category ?? 'ALL'],
        prev.map((x) => x.id === t.id ? { ...x, completed: !x.completed } : x));
      return { prev };
    },
    onError: (_e, _t, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['todos', category ?? 'ALL'], ctx.prev);
      push({ variant: 'error', title: '更新失败' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['todos'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => endpoints.todos.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todos'] });
      push({ variant: 'success', title: '已删除' });
    },
  });

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      ))}
    </div>
  );

  if (list.length === 0) return (
    <div className="py-16 text-center text-muted-foreground">
      <Sparkles className="mx-auto h-8 w-8 opacity-50 mb-3" />
      当前分类下没有待办。点右上角「新建待办」开始规划～
    </div>
  );

  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {list.map((t, i) => {
          const overdue = !!t.dueDate && !t.completed && new Date(t.dueDate) < new Date(new Date().toDateString());
          const today = !!t.dueDate && isSameDay(new Date(t.dueDate), new Date());
          return (
            <motion.li
              key={t.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ delay: i * 0.02 }}
              className={cn(
                'group flex items-start gap-3 rounded-xl border p-3 transition',
                t.completed
                  ? 'border-border/30 bg-muted/5 opacity-70'
                  : 'border-border/60 bg-muted/10 hover:bg-muted/25',
              )}
            >
              <div className="pt-0.5">
                <Checkbox
                  checked={t.completed}
                  onCheckedChange={() => toggle.mutate(t)}
                  disabled={toggle.isPending}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn(
                  'flex flex-wrap items-center gap-2',
                  t.completed && 'line-through text-muted-foreground',
                )}>
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {labelOf('TodoCategory', t.category as typeof TodoCategoryEnum[keyof typeof TodoCategoryEnum])}
                  </Badge>
                  {t.dueDate && (
                    <Badge variant={today ? 'gold' : overdue ? 'destructive' : 'outline'} className={cn('text-[10px]', overdue && 'opacity-90')}>
                      <CalendarClock className="h-2.5 w-2.5 mr-1" />
                      {overdue ? '已过期 · ' : today ? '今天 · ' : ''}
                      {formatDate(t.dueDate, { year: undefined })}
                    </Badge>
                  )}
                </div>
                {!t.completed && (
                  <div className="mt-1 text-[11px] text-muted-foreground tabular">
                    创建于 {formatRelative(t.createdAt ?? new Date().toISOString())}
                  </div>
                )}
              </div>
              <Button
                variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition"
                onClick={() => remove.mutate(t.id)} disabled={remove.isPending}
                title="删除"
              >
                <Trash2 className="h-4 w-4 text-error" />
              </Button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/* ----------------------------- 新建 Dialog ----------------------------- */
function NewTodoDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('FOLLOW_UP');
  const [due, setDue] = useState<string>('');
  const qc = useQueryClient();
  const push = useAppStore((s) => s.pushToast);
  const mut = useMutation({
    mutationFn: () => endpoints.todos.create({
      title, category, dueDate: due || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todos'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      push({ variant: 'success', title: '已新建待办' });
      setOpen(false); setTitle(''); setDue('');
    },
    onError: (e: any) => push({ variant: 'error', title: '创建失败', description: e.message }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> 新建待办</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>新建一条教师待办</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label>事项</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：周三前改完 6 班出门测" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>分类</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TodoCatFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TodoCategoryEnum.LESSON_PREP}>备课</SelectItem>
                  <SelectItem value={TodoCategoryEnum.FOLLOW_UP}>跟进</SelectItem>
                  <SelectItem value={TodoCategoryEnum.RENEWAL}>续费</SelectItem>
                  <SelectItem value={TodoCategoryEnum.ADMIN}>行政</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>截止日期（可选）</Label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !title}>
            确认创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- 四象限侧栏 ----------------------------- */
function Quadrant() {
  const { data = [] } = useTodos('ALL');
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 86400_000);

  function q(t: TodoDto) {
    if (t.completed) return 'done';
    const urgent = !!t.dueDate && new Date(t.dueDate) <= threeDays;
    const important = t.category === TodoCategoryEnum.RENEWAL || t.category === TodoCategoryEnum.FOLLOW_UP;
    if (urgent && important) return 'q1';
    if (!urgent && important) return 'q2';
    if (urgent && !important) return 'q3';
    return 'q4';
  }
  const qmap = {
    q1: { title: '紧急重要', hint: '现在就做', tone: 'border-destructive/50 bg-destructive/10', badge: 'destructive' as const },
    q2: { title: '重要不紧急', hint: '排计划做', tone: 'border-primary/50 bg-primary/10', badge: 'gold' as const },
    q3: { title: '紧急不重要', hint: '能委托就委托', tone: 'border-info/40 bg-info/10', badge: 'outline' as const },
    q4: { title: '不重要不紧急', hint: '抽空处理', tone: 'border-border/40 bg-muted/10', badge: 'outline' as const },
  } as const;
  const done = data.filter((t) => t.completed).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {(['q1', 'q2', 'q3', 'q4'] as const).map((k) => {
          const m = qmap[k];
          const items = data.filter((t) => q(t) === k).slice(0, 5);
          return (
            <div key={k} className={cn('rounded-xl border p-3 min-h-[140px]', m.tone)}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{m.title}</span>
                <Badge variant={m.badge}>{items.length}</Badge>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</div>
              <ul className="mt-2 space-y-1.5">
                {items.map((t) => (
                  <li key={t.id} className="flex items-start gap-1.5 text-xs">
                    {t.completed
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                      : <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
                    <span className="truncate" title={t.title}>{t.title}</span>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="text-xs text-muted-foreground italic">空</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">今日完成</span>
          <Badge variant="gold">{done} 项</Badge>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, data.length ? (done / Math.max(data.length, 1)) * 100 : 0)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-success via-primary to-accent"
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground tabular">
          完成率 {data.length ? Math.round((done / data.length) * 100) : 0}% · 总共 {data.length} 条
        </div>
      </div>
    </>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
