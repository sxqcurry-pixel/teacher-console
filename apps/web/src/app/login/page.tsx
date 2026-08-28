'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap, Mail, Lock, User2, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { endpoints } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import type { ClassDto, CurrentUser } from '@spark/shared';

const DEMO_USER: CurrentUser = {
  id: 'demo-teacher',
  email: 'teacher@spark.dev',
  name: '演示教师',
  role: 'TEACHER',
  avatar: null,
};
const DEMO_CLASSES: ClassDto[] = [
  { id: 'cls-demo-1', name: '初三冲刺A班', grade: '初三', subject: '数学', teacherId: 'demo-teacher', studentCount: 28, createdAt: new Date().toISOString() },
  { id: 'cls-demo-2', name: '初二培优B班', grade: '初二', subject: '数学', teacherId: 'demo-teacher', studentCount: 22, createdAt: new Date().toISOString() },
];

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱'),
  password: z.string().min(6, '密码至少 6 位'),
});
const registerSchema = loginSchema.and(
  z.object({ name: z.string().min(2, '请输入姓名') }),
);

type Mode = 'login' | 'register';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const setToken = useAppStore((s) => s.setAccessToken);
  const setClasses = useAppStore((s) => s.setClasses);
  const pushToast = useAppStore((s) => s.pushToast);
  const [loading, setLoading] = useState(false);

  function enterDemo() {
    setToken('demo-token');
    setUser(DEMO_USER);
    setClasses(DEMO_CLASSES);
    pushToast({
      variant: 'info',
      title: '已进入演示模式',
      description: 'UI 可自由浏览，数据为占位；启动后端并 seed 后可用真实接口',
    });
    router.replace('/dashboard');
  }

  const schema = mode === 'login' ? loginSchema : registerSchema;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema as any), mode: 'onTouched' });

  const onSubmit = handleSubmit(async (values: any) => {
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await endpoints.auth.login({ email: values.email, password: values.password })
          : await endpoints.auth.register({
              email: values.email,
              password: values.password,
              name: values.name,
            });
      const typed = res as any;
      setToken(typed.tokens.accessToken);
      setUser(typed.user);
      pushToast({
        variant: 'success',
        title: mode === 'login' ? '欢迎回来' : '注册成功',
        description: `${typed.user.name}，已准备好进入工作台`,
      });
      router.replace('/dashboard');
    } catch (e: any) {
      pushToast({
        variant: 'error',
        title: mode === 'login' ? '登录失败' : '注册失败',
        description: e?.message ?? '请检查邮箱或密码',
      });
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div
        className="absolute inset-0 bg-grid-dark bg-grid opacity-60"
        aria-hidden
        style={{ maskImage: 'radial-gradient(circle at 50% 30%, #000 0%, transparent 70%)' }}
      />
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl animate-float" />
      <div className="pointer-events-none absolute top-24 right-10 h-72 w-72 rounded-full bg-[hsl(45_93%_55%_/_0.25)] blur-3xl animate-float [animation-delay:-2s]" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-2">
        {/* Left — marketing */}
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-7"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-primary/60 rounded-2xl" />
              <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(45_93%_55%)] text-background shadow-glow-lg">
                <GraduationCap className="h-7 w-7" />
              </div>
            </div>
            <div>
              <div className="spark-h1">
                <span className="text-gradient-brand">星火</span>教师工作台
              </div>
              <div className="text-sm text-muted-foreground tracking-widest uppercase">
                Spark Teacher Hub · 初中数学冲刺版
              </div>
            </div>
          </div>

          <p className="spark-h3 text-foreground/90 leading-relaxed max-w-xl">
            把 Excel 里东拼西凑的数据、课堂上散落的互动工具、回家还在想的家校话术，
            <span className="text-primary font-semibold"> 收进一个入口。</span>
          </p>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['数据驱动', '讲次测×阶段测加权排名，自动算积分'],
              ['课堂互动', '权重转盘 × 淘汰模式 × GSAP 运镜'],
              ['AI 辅助', '一键生成学习建议 / 家长话术 / 备课灵感'],
              ['双端同步', '手机电脑互通，WebSocket 实时广播'],
            ].map(([t, d], i) => (
              <motion.li
                key={t}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.06 }}
                className="spark-glass spark-card-hover p-4 space-y-1"
              >
                <Badge variant="gold" className="mb-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t}
                </Badge>
                <div className="font-medium">{d}</div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Right — auth card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <Card className="mx-auto max-w-md p-7 spark-glass !bg-card/70 shadow-glow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="spark-h2">
                  {mode === 'login' ? '登录工作台' : '创建教师账号'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === 'login'
                    ? '首次使用？选择"注册"创建账号'
                    : '已有账号？切换回"登录"'}
                </p>
              </div>
              <Badge variant="gold" className="gap-1">
                <Sparkles className="h-3 w-3" /> BETA
              </Badge>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">姓名</Label>
                  <div className="relative">
                    <User2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="name" className="pl-9" placeholder="星火数学老师" {...register('name')} />
                  </div>
                  {errors.name && (
                    <p className="text-xs text-error">{(errors.name as any).message}</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="pl-9"
                    placeholder="teacher@spark.dev"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-error">{(errors.email as any).message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="pl-9"
                    placeholder="至少 8 位"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-error">{(errors.password as any).message}</p>
                )}
              </div>

              <Button type="submit" size="lg" className="w-full mt-2 group" disabled={loading}>
                {mode === 'login' ? '进入工作台' : '创建并进入'}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Button>
            </form>

            <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-primary hover:underline"
              >
                {mode === 'login' ? '还没有账号？立即注册 →' : '已有账号？返回登录 →'}
              </button>
              <Link
                href="/dashboard"
                onClick={(e) => { e.preventDefault(); enterDemo(); }}
                className="underline-offset-2 hover:underline hover:text-foreground"
              >
                Demo 跳过
              </Link>
            </div>

            <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
              💡 演示账号（启动后端并执行 seed 后可用）：
              <span className="text-foreground font-medium"> teacher@spark.dev </span>
              / Spark@123456
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
