'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
// Header / Sidebar 都用 dynamic ssr:false — 避免 localStorage 条件渲染导致的 Hydration mismatch
const HeaderCSR = dynamic(() => import('./header').then((m) => m.Header), {
  ssr: false,
  loading: () => <header className="h-14 shrink-0 border-b border-border/50 bg-card/30" aria-hidden />,
});
import { useAppStore } from '@/stores/app-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Sidebar 客户端渲染（完全禁用 SSR）
 *
 * Sidebar 里大量使用 localStorage（getActiveClassId/setActiveClassId/remember tokens） +
 * 班级 Select placeholder 随缓存数据变化 —— SSR 拿不到 localStorage，所以第一次渲染时服务端
 * 输出的是 placeholder 文本，而客户端 Hydrate 时马上有了缓存内容 → 两端 HTML 不一致
 * → React 抛 Hydration mismatch 红框 → Next 会取消正在加载的 _rsc payload（ERR_ABORTED）→ App Router
 *  后续的 layout-router 状态异常。用 dynamic ssr:false 让 Sidebar 只在客户端渲染，直接消除这类不一致。
 */
const Sidebar = dynamic(() => import('./sidebar').then((m) => m.Sidebar), {
  ssr: false,
  loading: () => (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border/50 bg-card/30" aria-hidden />
  ),
});

/**
 * AppShell — responsive PC/Mobile wrapper.
 *
 * NOTE: 2026-08-29：根布局页面切换移除所有 AnimatePresence / framer-motion 过渡动画。
 * 因为 /wheel 等页面内部嵌套使用 motion/AnimatePresence，父子在切换时 framer-motion 调度器会无限等待
 * （即使没显式 mode="wait" 也可能出现），导致 App Router 路由完全冻结：URL 不更新、内容不变化、0 报错。
 * 用 CSS 过渡/普通 React 渲染即可，视觉差异可忽略。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const setUser = useAppStore((s) => s.setUser);
  const setToken = useAppStore((s) => s.setAccessToken);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  const bootedRef = useRef(false);
  const isAuthRoute = path === '/login' || path === '/register';

  // 注入 store 的 router 以便 logout 单点 redirect（避免 sidebar push + guard replace 双重竞争卡死）
  useEffect(() => {
    useAppStore.setState({
      __router: router,
      __queryClient: qc,
    } as any);
  }, [router, qc]);

  // Persistent auto-login via stored token + /me. Only runs once.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    (async () => {
      const token =
        typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
      if (!token) {
        // Boot 时没有 token：如果不在认证路由，立刻 redirect 到 /login（只在 boot 时做，不在后续 user 变化时重复触发！）
        if (!isAuthRoute) {
          router.replace('/login');
        }
        return;
      }
      try {
        setToken(token);
        const me = await endpoints.auth.me();
        setUser(me as any);
      } catch {
        setToken(null);
        setUser(null);
        if (!isAuthRoute) router.replace('/login');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isAuthRoute) {
    return (
      <div className="relative z-10 min-h-screen w-full">
        <div key={'auth-' + path} className="min-h-screen w-full">
          {children}
        </div>
      </div>
    );
  }

  // 每次路径变化都强制 children 重新挂载：彻底避免上一页的 useEffect/IO/观察者
  // 遗留到下一页的副作用——这是之前 dashboard → wheel 时 framer-motion useInView
  // 的 IntersectionObserver 在卸载边界触发回调导致 router 死锁的最后一道防线。
  // 配合前面移除的所有全局 framer-motion 调度器（sidebar/header/dashboard），
  // 页面切换时 React 会真正销毁旧组件再重新构造新组件，不会有跨页面的副作用残留。
  return (
    <div className="relative z-10 min-h-screen w-full">
      {/* 【统一 Classes 数据源：CSR-only 组件，避免 SSR 水合报错】
          实现思路：把 classes 查询从 Sidebar 升顶到 AppShell，但 AppShell 本身是 SSR-able 的，
          直接在顶层 useQuery 会因 SSR(enabled=false) vs CSR(enabled=true) fiber 内部状态不一致
          触发 React hydration failed。用 mounted useEffect 守卫：SSR/hydration 首帧返回 null，
          React 不挂任何 useQuery → 两端渲染完全一致；客户端 hydrated 后再挂载查询。*/}
      <ClassesSyncer />
      <Sidebar />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-500',
          sidebarOpen ? 'md:pl-72' : 'md:pl-0',
        )}
      >
        <HeaderCSR />
        <main className="relative flex-1 px-4 py-6 md:px-8 md:py-8 max-w-[1500px] w-full mx-auto">
          {/* 🔴 强制 remount 防护：以 path 为 key，每次路由变化都会完全销毁上一个页面的组件树，
                 杜绝上一页的 IO / motion 调度器 / pending useEffect 回调残留到下一页 */}
          <RemountGuard path={path}>
            <div key={'page-' + path}>
              {children}
            </div>
          </RemountGuard>
        </main>

        {/* Mobile bottom nav (<md) */}
        <MobileBottomNav />
      </div>
    </div>
  );
}

/**
 * RemountGuard — 兜底强制重挂载组件
 *
 * 检测路径切换后，在一个微任务内先展示一个空的占位层，然后再渲染真正的 children。
 * 这样即使 React 复用了某些 fiber（如 Suspense boundary），我们也能保证上一页的 DOM/effect 被真正卸载。
 */
function RemountGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const [displayKey, setDisplayKey] = React.useState(path);

  useEffect(() => {
    let cancelled = false;
    // 用 queueMicrotask 保证在路由 pending 更新后切换 key，
    // 确保 router.push 完成回调已经全部执行后再重挂载
    queueMicrotask(() => {
      if (!cancelled) setDisplayKey(path + '::' + Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return <React.Fragment key={displayKey}>{children}</React.Fragment>;
}

function MobileBottomNav() {
  const path = usePathname();
  const items = [
    { key: 'dashboard', label: '仪表盘', href: '/dashboard', active: (p: string) => p.startsWith('/dashboard') || p === '/' },
    { key: 'students', label: '学生', href: '/students', active: (p: string) => p.startsWith('/student') || p.startsWith('/score') || p.startsWith('/point') },
    { key: 'wheel', label: '转盘', href: '/wheel', active: (p: string) => p.startsWith('/wheel') },
    { key: 'ai', label: 'AI', href: '/ai', active: (p: string) => p.startsWith('/ai') },
    { key: 'todos', label: '待办', href: '/todos', active: (p: string) => p.startsWith('/todo') || p.startsWith('/comm') },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/85 backdrop-blur-xl">
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = it.active(path);
          return (
            <li key={it.key}>
              <Link
                href={it.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'block h-6 w-6 rounded-full transition-all',
                    active ? 'bg-primary/20 shadow-[0_0_18px_hsl(var(--primary)/_0.5)]' : '',
                  )}
                />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * ClassesSyncer — AppShell 的 Classes 统一数据源（纯客户端渲染，不参与 SSR）。
 *
 * 为什么不能直接放在 AppShell 顶层？
 *   Zustand initialUser 在模块加载时同步读 localStorage：SSR 阶段 window=undefined → initialUser=null，
 *   客户端 hydration 阶段 window 存在 → 读到历史登录用户。
 *   这导致 `useQuery({ enabled: !!user })` 在 SSR 时 =false、在 CSR hydration 时 =true，
 *   React Query 在 fiber 上挂的内部状态（fetchStatus/observer flags）两端不一致 → React 抛 hydration mismatch。
 *
 * 解决方案：组件首帧（SSR + CSR hydration）通过 mounted===false 返回 null，不调用任何 hooks，
 *   两端输出完全一致。useEffect 在客户端 mounted 后置 true → 下一帧再渲染真正的 useQuery
 *   （此时已完成 hydration，React 不再比对 SSR HTML），彻底规避水合差异。
 *
 * 为什么要把 classes 查询从 Sidebar 升顶？
 *   Sidebar 用 dynamic ssr:false，异步加载时机不确定（比 StudentsPage/Dashboard 更晚），
 *   在它的 useQuery onSuccess 之前，store.classes 仍是上一个账号残留或空 → 导入兜底
 *   写到旧账号班级 → 几秒后 Sidebar setClasses 覆盖 activeClassId → 写入 A 班查询 B 班。
 *   ClassesSyncer 在 AppShell 顶层、在 Sidebar/页面 children 之前挂载，保证 store.classes
 *   永远是当前账号的真实数据；Sidebar 只负责渲染，不再自己写 setClasses（避免竞争覆盖）。
 */
function ClassesSyncer() {
  const [mounted, setMounted] = React.useState(false);
  const user = useAppStore((s) => s.user);
  const setClasses = useAppStore((s) => s.setClasses);

  useEffect(() => {
    setMounted(true);
  }, []);

  useQuery({
    // 用 mounted+user.id 作 key：两端完全不同，但首帧因为 mounted=false 不执行查询（enabled=false），
    // 不会出现 SSR vs CSR 各自挂不同 fiber 状态的问题。
    queryKey: ['classes', user?.id],
    queryFn: async () => {
      try {
        const list = (await endpoints.classes.list()) as any[];
        setClasses(list); // 唯一写入点：净化 activeClassId + 写 Zustand + localStorage
        return list;
      } catch {
        setClasses([]);
        return [];
      }
    },
    enabled: mounted && !!user,
    refetchOnWindowFocus: false,
  });

  return null;
}
