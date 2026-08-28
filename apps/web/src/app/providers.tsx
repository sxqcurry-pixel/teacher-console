'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Socket, io } from 'socket.io-client';
import type { SyncEnvelope } from '@spark/shared';
import { useAppStore } from '@/stores/app-store';

// ---- TanStack Query client ----
const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (count, err: any) => {
          if (err?.code === 401 || err?.code === 403 || err?.code === 404) return false;
          return count < 2;
        },
      },
      mutations: { onError: () => {} },
    },
  });

// ---- Sync (WebSocket) Context ----
interface SyncCtx {
  socket: Socket | null;
  channels: Set<string>;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  onMessage: (handler: (env: SyncEnvelope) => void) => () => void;
  connected: boolean;
}

const SyncContext = createContext<SyncCtx | null>(null);
export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside AppProviders');
  return ctx;
}

function SyncProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAppStore((s) => s.accessToken);
  const [state, setState] = React.useState<{
    socket: Socket | null;
    connected: boolean;
    channels: Set<string>;
  }>({ socket: null, connected: false, channels: new Set() });
  const handlersRef = useRef(new Set<(env: SyncEnvelope) => void>());
  const invalidateRef = useRef<QueryClient | null>(null);

  const client = useMemo(makeQueryClient, []);
  invalidateRef.current = client;

  // socket lifecycle
  useEffect(() => {
    if (!accessToken) return;
    const url = process.env.NEXT_PUBLIC_WS_URL ?? (typeof window !== 'undefined' ? window.location.origin : '');
    const socket = io(`${url}/ws/sync`, {
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1500,
    });

    socket.on('connect', () => setState((s) => ({ ...s, connected: true })));
    socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));
    socket.on('message', (env: SyncEnvelope) => {
      handlersRef.current.forEach((h) => h(env));
      // optimistic: refetch relevant entity list on DATA_CHANGED
      if (env.type === 'DATA_CHANGED') {
        const entity = env.payload?.entity?.toLowerCase();
        if (entity) {
          const q = invalidateRef.current;
          if (!q) return;
          // Broad invalidation avoids complex key mapping
          q.invalidateQueries({
            predicate: (q) => {
              const key = (q.queryKey[0] as string) ?? '';
              return key.startsWith(entity) || ['students', 'scores', 'points', 'dashboard', 'todos'].includes(key);
            },
          });
        }
      }
    });

    setState({ socket, connected: socket.connected, channels: new Set() });

    return () => {
      socket.disconnect();
      setState({ socket: null, connected: false, channels: new Set() });
    };
  }, [accessToken]);

  // re-subscribe channels on reconnect / change
  useEffect(() => {
    if (!state.socket) return;
    state.channels.forEach((c) => state.socket!.emit('SUBSCRIBE', { channel: c }));
  }, [state.socket, state.connected]);

  const api: SyncCtx = {
    socket: state.socket,
    channels: state.channels,
    connected: state.connected,
    subscribe: (channel) => {
      if (state.channels.has(channel) || !state.socket) return;
      setState((s) => {
        const next = new Set(s.channels);
        next.add(channel);
        return { ...s, channels: next };
      });
      state.socket.emit('SUBSCRIBE', { channel });
    },
    unsubscribe: (channel) => {
      if (!state.channels.has(channel) || !state.socket) return;
      setState((s) => {
        const next = new Set(s.channels);
        next.delete(channel);
        return { ...s, channels: next };
      });
      state.socket.emit('UNSUBSCRIBE', { channel });
    },
    onMessage: (handler) => {
      handlersRef.current.add(handler);
      return () => handlersRef.current.delete(handler);
    },
  };

  return (
    <QueryClientProvider client={client}>
      <SyncContext.Provider value={api}>{children}</SyncContext.Provider>
    </QueryClientProvider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <SyncProvider>{children}</SyncProvider>;
}
