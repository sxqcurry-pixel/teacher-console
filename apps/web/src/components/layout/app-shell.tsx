'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useAppStore } from '@/stores/app-store';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * AppShell — responsive PC/Mobile wrapper.
 *
 * - Desktop: Sidebar fixed + Header + motion page container (GSAP camera movement simulated via Motion).
 * - Mobile (<md): Bottom tab nav.
 * - Unauthenticated routes (/login, /register) render minimal.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setToken = useAppStore((s) => s.setAccessToken);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  const isAuthRoute = path === '/login' || path === '/register';

  // Persistent auto-login via stored token + /me
  useEffect(() => {
    (async () => {
      const token =
        typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
      if (!token) return;
      try {
        setToken(token);
        const me = await endpoints.auth.me();
        setUser(me as any);
      } catch {
        setToken(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route guard
  useEffect(() => {
    if (isAuthRoute) return;
    if (!user) {
      const token =
        typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;
      if (!token) router.replace('/login');
    }
  }, [user, isAuthRoute, router]);

  if (isAuthRoute) {
    return (
      <div className="relative z-10 min-h-screen w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={path}
            initial={{ opacity: 0, scale: 0.995, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.995, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
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
          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={{ opacity: 0, filter: 'blur(10px)', y: 18 }}
              animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
              exit={{ opacity: 0, filter: 'blur(6px)', y: -14 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: 'transform, opacity, filter' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
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
