'use client';

import { create } from 'zustand';
import type { ClassDto, CurrentUser } from '@spark/shared';

interface AppState {
  // ---- Sidebar layout ----
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  // ---- Active class context ----
  activeClassId: string | null;
  classes: ClassDto[];
  setClasses: (c: ClassDto[]) => void;
  setActiveClassId: (id: string | null) => void;
  // ---- Auth ----
  user: CurrentUser | null;
  setUser: (u: CurrentUser | null) => void;
  accessToken: string | null;
  setAccessToken: (t: string | null) => void;
  /**
   * 登出：清理本地状态 + QueryClient 缓存 + 【单点跳转到 /login】。
   * —— redirect 必须由 logout 内部单点完成，不能由调用方再 router.push/replace，
   *    否则会出现 sidebar push + useEffect guard replace 的双调用竞态 → App Router 路由冻结（URL/内容都不变）。
   */
  logout: () => void;
  // ---- Toast stack ----
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id' | 'createdAt'>) => void;
  removeToast: (id: string) => void;
  // ---- Page-level UI filters (communications etc.) ----
  commFilter: { keyword?: string; renewal?: string; type?: string };
  setCommFilter: (f: Partial<{ keyword: string; renewal: string; type: string }>) => void;
  // ---- Internal runtime injections (由 AppShell 在 boot 后注入) ----
  __router?: { replace: (url: string) => void };
  __queryClient?: { clear: () => void; reset: () => void };
}

export interface Toast {
  id: string;
  variant: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  createdAt: number;
  /** auto-dismiss after ms; 0 = never */
  duration?: number;
}

const STORAGE_KEYS = { USER: 'spark.user', TOKEN: 'spark.token', CLASS: 'spark.class' };

const initialToken = (typeof window !== 'undefined' && window.localStorage.getItem('accessToken')) || null;
const initialUser = (() => {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
})();

export const useAppStore = create<AppState>((set, get) => ({
  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: typeof v === 'function' ? v(get().sidebarOpen) : v }),

  activeClassId: (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEYS.CLASS)) || null,
  classes: [],
  setClasses: (classes) => {
    const current = get().activeClassId;
    const first = classes[0]?.id ?? null;
    const active = classes.some((c) => c.id === current) ? current : first;
    if (active && typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEYS.CLASS, active);
    set({ classes, activeClassId: active });
  },
  setActiveClassId: (id) => {
    if (id && typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEYS.CLASS, id);
    set({ activeClassId: id });
  },

  user: initialUser,
  setUser: (u) => {
    if (typeof window !== 'undefined') {
      if (u) window.localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(u));
      else window.localStorage.removeItem(STORAGE_KEYS.USER);
    }
    set({ user: u });
  },
  accessToken: initialToken,
  setAccessToken: (t) => {
    if (typeof window !== 'undefined') {
      if (t) {
        window.localStorage.setItem('accessToken', t);
      } else {
        window.localStorage.removeItem('accessToken');
      }
    }
    set({ accessToken: t });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('accessToken');
      window.localStorage.removeItem(STORAGE_KEYS.USER);
      window.localStorage.removeItem(STORAGE_KEYS.CLASS);
    }
    try { get().__queryClient?.clear(); } catch {}
    set({ user: null, accessToken: null, activeClassId: null });
    // 【单点跳转】登出后必走这一条，禁止 sidebar / 守卫再额外 push/replace，
    // 否则双重 redirect 竞争会让 App Router 卡死。
    const r = get().__router;
    if (r && typeof window !== 'undefined') {
      try { window.location.assign('/login'); } catch { r.replace('/login'); }
    }
  },

  toasts: [],
  pushToast: (t) => {
    const id =
      't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const toast: Toast = { id, createdAt: Date.now(), duration: 3200, ...t };
    set({ toasts: [...get().toasts, toast] });
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => get().removeToast(id), toast.duration);
    }
  },
  removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  commFilter: { keyword: '', renewal: 'ALL', type: 'ALL' },
  setCommFilter: (f) => set({ commFilter: { ...get().commFilter, ...f } }),
}));
