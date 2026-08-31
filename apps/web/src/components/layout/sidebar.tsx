'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Users2,
  Layers,
  Sparkles,
  MessageCircleHeart,
  ListTodo,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  GraduationCap,
  ChevronDown,
  PowerSquare,
  Settings2,
  Pencil,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/stores/app-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@/lib/api';
import type { ClassDto } from '@shared/dto';

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: '总览仪表盘', icon: LayoutDashboard, href: '/dashboard', match: (p) => p.startsWith('/dashboard') || p === '/' },
  { key: 'students', label: '学生中心', icon: Users2, href: '/students', match: (p) => p.startsWith('/students') || p.startsWith('/scores') || p.startsWith('/points') },
  { key: 'wheel', label: '课堂互动', icon: Layers, href: '/wheel', match: (p) => p.startsWith('/wheel') },
  { key: 'ai', label: 'AI 工作台', icon: Sparkles, href: '/ai', match: (p) => p.startsWith('/ai') },
  { key: 'comm', label: '家校 / 待办', icon: MessageCircleHeart, href: '/communications', match: (p) => p.startsWith('/comm') || p.startsWith('/todos') },
];

const SECONDARY_NAV: Record<string, Array<{ key: string; label: string; href: string }>> = {
  students: [
    { key: 'roster', label: '学生名册', href: '/students' },
    { key: 'scores', label: '成绩登记', href: '/scores' },
    { key: 'points', label: '积分 / 竞拍', href: '/points' },
  ],
  comm: [
    { key: 'comm', label: '家校沟通', href: '/communications' },
    { key: 'todos', label: '教师待办', href: '/todos' },
  ],
};

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const open = useAppStore((s) => s.sidebarOpen);
  const setOpen = useAppStore((s) => s.setSidebarOpen);
  const classes = useAppStore((s) => s.classes);
  const setClasses = useAppStore((s) => s.setClasses);
  const activeClassId = useAppStore((s) => s.activeClassId);
  const setActiveClassId = useAppStore((s) => s.setActiveClassId);
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const push = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();

  // ==== 诊断代码：全局暴露 router + 拦截 history ====
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__DIAG = (window as any).__DIAG || {};
    (window as any).__DIAG.router = router;
    (window as any).__DIAG.pathname = () => window.location.pathname;

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    (window as any).__DIAG._hits = { push: 0, replace: 0 };
    history.pushState = function (state: any, title: string, url?: string) {
      (window as any).__DIAG._hits.push++;
      console.log('🔴 [DIAG] history.pushState #' + (window as any).__DIAG._hits.push, url);
      return origPush(state, title, url);
    };
    history.replaceState = function (state: any, title: string, url?: string) {
      (window as any).__DIAG._hits.replace++;
      console.log('🔴 [DIAG] history.replaceState #' + (window as any).__DIAG._hits.replace, url);
      return origReplace(state, title, url);
    };

    // 监听所有路由变化
    const origPop = window.onpopstate;
    window.addEventListener('popstate', () => {
      console.log('🔴 [DIAG] popstate →', window.location.pathname);
    });

    console.log('🟢 [DIAG] Sidebar 诊断已安装。当前 pathname:', path);
    console.log('🟢 [DIAG] 手动测试: window.__DIAG.router.push("/dashboard")');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (href: string) => {
    console.log('🔴 [DIAG] navigate() called, href:', href, 'router.push type:', typeof router.push);
    try {
      const result = router.push(href);
      console.log('🔴 [DIAG] router.push returned:', result);
    } catch (e) {
      console.error('🔴 [DIAG] router.push THREW:', e);
    }
    // 强制 fallback
    setTimeout(() => {
      console.log('🔴 [DIAG] 500ms 后 URL 仍是:', window.location.pathname, '(如果没变，说明 Next Router 卡死了)');
    }, 500);
  };

  // 【Classes 查询：只读不写 Zustand store】
  // 写入点统一在 AppShell（顶层）的 useQuery onSuccess setClasses(list)。
  // 这里 Sidebar 只利用 React Query 缓存拿数据，不再自己调用 setClasses，避免
  // 两个独立查询竞争写 store → 互相覆盖 activeClassId → 写入/查询班级不一致。
  useQuery({
    queryKey: ['classes', user?.id],
    queryFn: async () => {
      try { return await endpoints.classes.list(); } catch { return []; }
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const activePrimary = NAV.find((n) => n.match(path));
  const secondary = activePrimary
    ? SECONDARY_NAV[activePrimary.key === 'comm' ? 'comm' : activePrimary.key === 'students' ? 'students' : '']
    : undefined;

  return (
    <>
      {/* 收起态：只剩一个悬浮按钮 */}
      {!open && (
        <div className="fixed left-0 top-0 z-40 hidden h-14 items-center px-3 md:flex">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="展开侧栏">
            <PanelLeftOpen className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      )}

      {/* 展开态：侧栏（用纯 CSS transition 滑入/滑出，彻底移除 AnimatePresence/motion 避免 framer-motion 调度器死锁）*/}
      {open && (
        <aside
          className={cn(
            'fixed left-0 top-0 z-40 hidden h-screen w-72 shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur-xl md:flex',
            // 纯 CSS transition 代替 framer-motion
            'transition-[transform,opacity] duration-200 ease-out',
            'translate-x-0 opacity-100',
          )}
        >
          {/* Brand */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 blur-lg bg-primary/50 rounded-xl" />
                <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary to-[hsl(45_93%_55%)] grid place-items-center shadow-glow-lg">
                  <GraduationCap className="h-5 w-5 text-background" />
                </div>
              </div>
              <div className="leading-tight">
                <div className="spark-h3 tracking-tight">
                  <span className="text-gradient-brand">星火</span>教师工作台
                </div>
                <div className="text-[11px] text-muted-foreground">SPARK TEACHER HUB</div>
              </div>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="收起侧栏">
              <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Class switcher */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="spark-eyebrow mb-0">当前班级</label>
              <ClassManager
                onChanged={async () => {
                  await qc.refetchQueries({ queryKey: ['classes'] });
                }}
              >
                <button
                  type="button"
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
                  title="管理班级（新建 / 重命名 / 删除）"
                >
                  <Settings2 className="h-3 w-3" /> 管理班级
                </button>
              </ClassManager>
            </div>
            <Select value={activeClassId ?? ''} onValueChange={(v) => setActiveClassId(v)}>
              <SelectTrigger className="bg-background/60 border-primary/25" suppressHydrationWarning>
                {/* suppressHydrationWarning：服务端 SSR 渲染时 localStorage 拿不到 activeClassId → 显示『加载班级…』
                    客户端 Hydrate 后能拿到缓存 → 显示选中班级名 / 或『选择班级』，
                    两端第一次渲染文本不一致会触发 Hydration mismatch overlay → 导致 Next _rsc 请求 ERR_ABORTED
                    这里只是 placeholder 文本 + 纯展示，不需要严格 hydration，静音即可。 */}
                <SelectValue placeholder="选择班级 / 新建班级">
                  {classes.find((c) => c.id === activeClassId)?.name ?? '选择班级 / 新建班级'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 && (
                  <SelectItem value="__empty__" disabled>暂无班级，请点上方『管理班级』新建</SelectItem>
                )}
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <span>{c.name}</span>
                      <Badge variant="secondary">{c.studentCount ?? 0}人</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nav */}
          <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-3 pr-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = !!activePrimary && activePrimary.key === item.key;
              return (
                <div key={item.key} className="space-y-1">
                  <Link href={item.href} className="group block" onClick={(e) => {
                    console.log('🔴 [DIAG] Link.onClick fired for', item.href, 'defaultPrevented:', e.defaultPrevented);
                    // 让 Link 的默认行为也跑，同时手动调用 router.push 并记录
                    setTimeout(() => navigate(item.href), 0);
                  }}>
                    <div
                      className={cn(
                        'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                        active
                          ? 'bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-foreground shadow-glow'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                      )}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/_0.45)]"
                        />
                      )}
                      <Icon
                        className={cn(
                          'h-5 w-5 transition-colors',
                          active ? 'text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/_0.6)]' : '',
                        )}
                      />
                      <span className="font-medium">{item.label}</span>
                    </div>
                  </Link>
                  {active && secondary && (
                    // 纯 CSS transition 二级菜单展开：overflow-hidden + max-h 过渡
                    <div
                      className="ml-8 flex flex-col gap-1 border-l border-dashed border-border py-1 overflow-hidden"
                      style={{ animation: 'sparkSubmenuIn 150ms ease-out' }}
                    >
                      {secondary.map((s) => {
                        const active2 = path === s.href || (s.href !== '/students' && s.href !== '/communications' && path.startsWith(s.href));
                        return (
                          <Link
                            key={s.key}
                            href={s.href}
                            className={cn(
                              '-ml-px border-l-2 pl-4 pr-2 py-1.5 text-[13px] rounded-r-md',
                              active2
                                ? 'border-primary text-primary font-medium bg-primary/5'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {s.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User block */}
          <div className="border-t border-border p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-12 rounded-xl px-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-[hsl(45_93%_55%)] text-background font-semibold shadow-glow">
                    {user?.name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 text-left leading-tight">
                    <div className="text-sm font-medium">{user?.name ?? '未登录'}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{user?.email ?? ''}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuLabel>账号</DropdownMenuLabel>
                <DropdownMenuItem disabled>
                  <PowerSquare className="h-4 w-4" />
                  角色：{user?.role === 'ADMIN' ? '管理员' : '教师'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    // 【只调用 logout】redirect 由 logout 内部单点完成（window.location.assign），
                    // 避免这里再 router.push + 之前的 useEffect guard replace 的双调用竞态。
                    logout();
                  }}
                  className="text-error focus:text-error cursor-pointer"
                >
                  <LogOut className="h-4 w-4" /> 退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      )}
    </>
  );
}

/* ========== ClassManager — 班级管理 Dialog（增 / 改 / 删 / 切换） ========== */

function ClassManager({
  children,
  onChanged,
}: {
  children: React.ReactNode;
  /** 增删改完成后调用（这里 Sidebar 用它做 refetch classes 兜底）*/
  onChanged?: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const classes = useAppStore((s) => s.classes);
  const setActiveClassId = useAppStore((s) => s.setActiveClassId);
  const activeClassId = useAppStore((s) => s.activeClassId);
  const push = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();

  // —— 新建/编辑 dialog 内嵌状态：默认即为"新建班级"的默认值 ——
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('初二数学火箭班');
  const [grade, setGrade] = React.useState('初二');
  const [subject, setSubject] = React.useState('数学');
  const [submitting, setSubmitting] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  const openEdit = (c: ClassDto) => {
    setEditingId(c.id);
    setName(c.name);
    setGrade(c.grade ?? '');
    setSubject(c.subject ?? '');
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        // ———— 更新班级 ————
        const updated: any = await endpoints.classes.update(editingId, {
          name: name.trim(),
          grade: grade.trim() || undefined,
          subject: subject.trim() || undefined,
        });
        // 🔴 同步更新 Zustand classes（订阅者 ClassManager/Sidebar/StudentsPage 立即重渲染）
        useAppStore.setState((s) => ({
          classes: s.classes.map((c) => (c.id === editingId ? { ...c, ...updated } : c)),
        }));
        push({ variant: 'success', title: '班级信息已更新', description: updated?.name ?? name });
      } else {
        // ———— 新建班级 ————
        const created: any = await endpoints.classes.create({
          name: name.trim(),
          grade: grade.trim() || '未填',
          subject: subject.trim() || '数学',
        });
        if (!created?.id) throw new Error('创建成功但未返回班级 ID');
        // 🔴 同步追加新班级到 Zustand classes（订阅者 ClassManager/Sidebar 立即重渲染，不再等 refetch 回调）
        useAppStore.setState((s) => ({
          classes: [...s.classes, created as ClassDto],
        }));
        // 新建后自动切到新班：调 setActiveClassId 走源头合法性校验（classes 里刚追加了新 id 所以 safe=created.id）
        // 并统一写 localStorage = spark.class（避免硬编码 key 名不一致）。
        setActiveClassId(created.id);
        push({ variant: 'success', title: '班级创建成功', description: created.name });
      }
      setEditingId(null);
      // refetch 作为后台兜底（对齐服务端的 studentCount / 其他最新字段），
      // ClassesSyncer queryFn 回包时 setClasses 会覆盖我们手动更新的 classes。
      // 不 await：不等它回包，因为 store.classes 已经同步写好了（用户看到列表即时更新）。
      qc.refetchQueries({ queryKey: ['classes'] }).catch(() => {
        /* ignore: queryFn 里已 catch 并 setClasses([]) 兜底 */
      });
      onChanged?.();
    } catch (e: any) {
      push({ variant: 'error', title: '保存失败', description: e?.message ?? '' });
    } finally {
      setSubmitting(false);
    }
  };

  const removeClass = async (id: string) => {
    const target = classes.find((c) => c.id === id);
    if (!target) return;
    if ((target.studentCount ?? 0) > 0) {
      push({
        variant: 'warning',
        title: '无法删除',
        description: `「${target.name}」里还有 ${target.studentCount} 名学生，请先清空或转移。`,
      });
      setPendingDelete(null);
      return;
    }
    try {
      await endpoints.classes.remove(id);
      // 🔴 同步从 Zustand classes 移除；activeClassId 切换交给 setActiveClassId 源头校验写 localStorage。
      const wasActive = activeClassId === id;
      useAppStore.setState((s) => ({
        classes: s.classes.filter((c) => c.id !== id),
        // 若删的不是当前班：保留 activeClassId（setClasses 不变）
        // 若删的是当前班：先置空，下面 setActiveClassId 再切到第一个剩余班级
        activeClassId: wasActive ? null : s.activeClassId,
      }));
      if (wasActive) {
        // 读最新 classes[0] 切班（setActiveClassId 内部会做 classes.some 校验 + 写 localStorage）
        const { classes: latest } = useAppStore.getState();
        setActiveClassId(latest[0]?.id ?? null);
      }
      push({ variant: 'success', title: '已删除班级', description: target.name });
      setPendingDelete(null);
      qc.refetchQueries({ queryKey: ['classes'] }).catch(() => undefined);
      onChanged?.();
    } catch (e: any) {
      push({ variant: 'error', title: '删除失败', description: e?.message ?? '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) {
        // 关闭时重置为"新建班级"默认状态，下次再开是干净的新建表单
        setEditingId(null);
        setPendingDelete(null);
        setName('初二数学火箭班');
        setGrade('初二');
        setSubject('数学');
      }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> 班级管理
          </DialogTitle>
          <DialogDescription>
            在这里新增 / 重命名 / 删除班级。学生、成绩、积分都按班级隔离，请谨慎删除。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {classes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-3">
                <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/60" />
                <div>还没有任何班级，点下面的按钮创建你的第一个班。</div>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {classes.map((c: ClassDto) => (
                <li key={c.id}>
                  <Card className={cn(
                    'transition',
                    activeClassId === c.id ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/_0.25)]' : '',
                  )}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{c.name}</span>
                          {activeClassId === c.id && (
                            <Badge variant="success" className="shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" />当前工作班</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>【{c.grade ?? '未填'}】{c.subject ?? ''}</span>
                          <Badge variant="secondary">{c.studentCount ?? 0} 名学生</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={activeClassId === c.id}
                          onClick={() => setActiveClassId(c.id)}
                          title="切换到此班级工作"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> 切换
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(c)}
                          title="重命名 / 修改年级学科"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> 编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-error hover:text-error"
                          onClick={() => setPendingDelete(c.id)}
                          title="删除班级（班内有学生时禁止删除）"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {/* 删除确认 */}
          {pendingDelete && (() => {
            const t = classes.find((c) => c.id === pendingDelete);
            return (
              <Card className="border-error/40 bg-error/5">
                <CardContent className="p-3 space-y-3">
                  <div className="text-sm font-medium text-error">
                    确认删除「{t?.name ?? ''}」？此操作不可恢复。
                  </div>
                  <DialogFooter className="!justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPendingDelete(null)}>取消</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeClass(pendingDelete)}>确认删除</Button>
                  </DialogFooter>
                </CardContent>
              </Card>
            );
          })()}

          {/* 新建/编辑表单（始终展示；editingId=null 表示新建，有值表示编辑）*/}
          <Card className="bg-card/60">
            <CardContent className="p-3 space-y-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                {editingId ? (<><Pencil className="h-4 w-4" /> 编辑班级</>) : (<><CheckCircle2 className="h-4 w-4 text-primary" /> 新建班级</>)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>班级名称 *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：初二数学火箭班" />
                </div>
                <div className="space-y-1.5">
                  <Label>年级</Label>
                  <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="例：初二" />
                </div>
                <div className="space-y-1.5">
                  <Label>学科</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="例：数学" />
                </div>
              </div>
              <DialogFooter className="!justify-end gap-2">
                {editingId && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingId(null); setName(''); setGrade('初二'); setSubject('数学'); }}>取消编辑</Button>
                )}
                <Button size="sm" onClick={submit} disabled={!name.trim() || submitting}>
                  {submitting ? '保存中…' : editingId ? '保存修改' : '创建班级'}
                </Button>
              </DialogFooter>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
