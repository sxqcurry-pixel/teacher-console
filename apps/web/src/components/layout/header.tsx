'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BellRing, Search, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/app-store';
import { useSync } from '@/app/providers';

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: '总览仪表盘', sub: '今日课堂 · 数据 · 快捷入口' },
  '/dashboard': { title: '总览仪表盘', sub: '今日课堂 · 数据 · 快捷入口' },
  '/students': { title: '学生名册', sub: '批量导入 · 查询 · 导出' },
  '/scores': { title: '成绩登记', sub: '讲次成绩 / 阶段测折算 / 加权排名' },
  '/points': { title: '积分档案', sub: '明细 · 排行榜 · 竞拍市场' },
  '/wheel': { title: '转盘互动', sub: '课堂点名 / 抽答 · 权重 · 淘汰模式' },
  '/ai': { title: 'AI 工作台', sub: '学生建议 · 教学建议 · 备课灵感' },
  '/communications': { title: '家校沟通', sub: '记录 · 消息模板 · 续费跟进' },
  '/todos': { title: '教师待办', sub: '备课 · 跟进 · 续费 · 行政' },
};

export function Header() {
  const path = usePathname();
  const user = useAppStore((s) => s.user);
  const push = useAppStore((s) => s.pushToast);
  const sync = useSync();

  const meta = Object.entries(PAGE_TITLES).find(([p]) => path.startsWith(p))?.[1] ?? {
    title: '星火教师工作台',
    sub: '',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/60 px-4 backdrop-blur-xl md:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* 移除 framer-motion，用 key 强制重渲染 + CSS transition 淡入 */}
          <span
            key={meta.title}
            className="spark-h2 md:text-[22px] transition-opacity duration-150"
          >
            {meta.title}
          </span>
          {sync.connected ? (
            <Badge variant="success" className="gap-1"><Wifi className="h-3 w-3" /> 实时同步</Badge>
          ) : user ? (
            <Badge variant="warning" className="gap-1"><WifiOff className="h-3 w-3" /> 未连接</Badge>
          ) : null}
        </div>
        {meta.sub && (
          <div className="text-xs text-muted-foreground mt-0.5">{meta.sub}</div>
        )}
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索学生 / 成绩 / 素材…（⌘K）"
            className="pl-9 pr-16 bg-muted/40 border-input"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        <Link href="/todos">
          <Button
            variant="ghost"
            size="icon"
            aria-label="通知"
            onClick={() => push({ variant: 'info', title: '消息中心', description: '系统通知功能开发中…' })}
          >
            <BellRing className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
