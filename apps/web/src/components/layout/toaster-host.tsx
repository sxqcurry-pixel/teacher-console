'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as ToastPrimitive from '../ui/toast';
import { useAppStore } from '@/stores/app-store';

/** Renderer for zustand-managed toast stack, uses Radix Toast primitives. */
export function ToasterHost() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  return (
    <ToastPrimitive.ToastProvider swipeDirection="right" duration={Infinity}>
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <ToastPrimitive.Toast
              variant={t.variant === 'success' ? 'success' : t.variant === 'error' ? 'error' : t.variant === 'warning' ? 'warning' : 'info'}
              onOpenChange={(open: boolean) => !open && removeToast(t.id)}
              forceMount
            >
              <ToastPrimitive.ToastTitle>{t.title}</ToastPrimitive.ToastTitle>
              {t.description ? (
                <ToastPrimitive.ToastDescription>{t.description}</ToastPrimitive.ToastDescription>
              ) : null}
              <ToastPrimitive.ToastClose />
            </ToastPrimitive.Toast>
          </motion.div>
        ))}
      </AnimatePresence>
      <ToastPrimitive.ToastViewport />
    </ToastPrimitive.ToastProvider>
  );
}

