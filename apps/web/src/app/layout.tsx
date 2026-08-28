import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from './providers';
import { AppShell } from '@/components/layout/app-shell';
import { ToasterHost } from '@/components/layout/toaster-host';

export const metadata: Metadata = {
  title: '星火教师工作台 · 教学管理 · 课堂互动 · AI 辅助',
  description:
    '中山星火教育初中数学教师个人工作台。学生名册、成绩/积分、转盘点名、家校沟通、AI 备课建议，电脑手机双端实时同步。',
  keywords: ['星火教育', '教师工作台', '初中数学', '课堂互动', '成绩管理', '积分系统'],
  themeColor: '#0f0f11',
  openGraph: {
    title: '星火教师工作台',
    description: '高级质感 · 流畅动效 · 数据驱动 · 教学闭环',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="dark">
      <body className="theme-premium min-h-screen antialiased selection:bg-primary/40 selection:text-white">
        <AppProviders>
          <AppShell>{children}</AppShell>
          <ToasterHost />
        </AppProviders>
        <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
      </body>
    </html>
  );
}
