'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useAppStore } from '@/stores/app-store';
import { useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  const user = useAppStore((s) => s.user);
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
        <div key={path} className="min-h-screen w-full">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen w-full">
      <Sidebar />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-500',
          sidebarOpen ? 'md:pl-72' : 'md:pl-0',
        )}
      >
        <Header />
        <main className="relative flex-1 px-4 py-6 md:px-8 md:py-8 max-w-[1500px] w-full mx-auto">
          {/* 纯 React 渲染：无 AnimatePresence / motion 调度器，避免路由冻结 */}
          <div key={path}>{children}</div>
        </main>

        {/* Mobile bottom nav (<md) */}
        <MobileBottomNav />
      </div>
    </div>
  );
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
