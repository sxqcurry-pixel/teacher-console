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
import { useAppStore } from '@/stores/app-store';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@/lib/api';

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

  useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      try {
        const list = await endpoints.classes.list();
        setClasses(list as any);
        return list;
      } catch {
        return [];
      }
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
          <div className="px-4 py-3">
            <label className="spark-eyebrow mb-2">当前班级</label>
            <Select value={activeClassId ?? ''} onValueChange={(v) => setActiveClassId(v)}>
              <SelectTrigger className="bg-background/60 border-primary/25">
                <SelectValue placeholder="选择班级 / 新建班级">
                  {classes.find((c) => c.id === activeClassId)?.name ?? '加载班级…'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 && (
                  <SelectItem value="__empty__" disabled>暂无班级，请先去仪表盘创建</SelectItem>
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
