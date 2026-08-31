'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import {
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  MoreHorizontal,
  UserCog,
  UserPlus,
  Trash2,
  Edit,
  FileSpreadsheet,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { endpoints } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import { cn, labelOf, resultColor } from '@/lib/utils';
import type { BulkImportResult, PageResult, StudentDto } from '@spark/shared';

export default function StudentsPage() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const classes = useAppStore((s) => s.classes);
  // activeClassId 合法性由 setActiveClassId / setClasses 源头保证：
  //   有值 → 一定在 classes 里（真实班级）；无值 → 还没班级，不发请求。
  // 不再在这里做 classes.some 冗余判断，避免时序竞态（Sidebar ClassesSyncer 异步加载时 classes 读成旧值）。
  // queryKey 和 mutation 都统一用 activeClassId，单一真实源。
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const qc = useQueryClient();
  const push = useAppStore((s) => s.pushToast);

  // —— 批量导入 Dialog + Tabs 受控状态（用户要求：导入中按钮可见 Loading/进度，导入完关 Dialog 跳学生名册 Tab）
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [tab, setTab] = React.useState<'roster' | 'insights'>('roster');
  const [importingFile, setImportingFile] = React.useState<File | null>(null); // 用来显示"正在导入 XXX.xlsx"
  const [progress, setProgress] = React.useState(0); // 0~100，近似进度条
  const rosterSectionRef = React.useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<PageResult<StudentDto>>({
    queryKey: ['students', activeClassId, keyword, status],
    queryFn: async () => {
      if (!activeClassId) return { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 };
      return endpoints.students.query({
        classId: activeClassId,
        page: 1,
        pageSize: 200,
        keyword,
        status,
      }) as Promise<PageResult<StudentDto>>;
    },
    enabled: true,
  });

  const createMut = useMutation({
    mutationFn: async (d: any) => {
      // activeClassId 源头保证合法（在 classes 里或 null），直接信任。
      if (!activeClassId) {
        throw new Error(classes.length ? '班级正在加载，请稍后再试' : '请先创建班级后再添加学生');
      }
      return endpoints.students.create({ classId: activeClassId, ...d });
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ['students'] });
      await qc.refetchQueries({ queryKey: ['classes'] });
      push({ variant: 'success', title: '学生已添加' });
    },
    onError: (e: any) => push({ variant: 'error', title: '添加失败', description: e.message }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => endpoints.students.remove(id),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ['students'] });
      await qc.refetchQueries({ queryKey: ['classes'] });
    },
    onError: (e: any) => push({ variant: 'error', title: '删除失败', description: e.message }),
  });

  // 近似进度推进：bulkImport 是单次请求，没流式进度，给用户一个"系统真在干活"的感知。
  // 0~60% 匀速（上传 + 后端解析），停在 60% 等请求回包，成功了立刻到 100%。
  const runProgressTimer = () => {
    let p = 0;
    setProgress(0);
    const id = window.setInterval(() => {
      p = Math.min(p + 6, 60); // 10 个 tick，~1s 到 60%
      setProgress(p);
      if (p >= 60) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  };

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      if (!activeClassId) {
        throw new Error('请先创建班级后再导入学生');
      }
      const stopTimer = runProgressTimer();
      try {
        const r = (await endpoints.students.bulkImport(
          file,
          activeClassId,
        )) as BulkImportResult;
        // 上传/解析完成，剩下最后 DB 写入 → 推到 90%，等 onSuccess 再到 100%
        setProgress(90);
        return r;
      } finally {
        stopTimer();
      }
    },
    onMutate: (file) => {
      setImportingFile(file);
    },
    onSuccess: async (r: BulkImportResult) => {
      setProgress(100);
      // 1) 强制拉取最新 21 条学生数据
      await qc.refetchQueries({ queryKey: ['students'] });
      await qc.refetchQueries({ queryKey: ['classes'] });
      // 2) 用户要求：导入成功后立刻显示学生列表
      setTab('roster');
      setImportDialogOpen(false);
      // 3) 滚动到学生名册卡片顶部，让用户第一眼看到刚导入的 21 条数据
      requestAnimationFrame(() => {
        rosterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      push({
        variant: r.failCount ? 'warning' : 'success',
        title: `导入完成：成功 ${r.successCount}，失败 ${r.failCount}`,
        description: r.errors.slice(0, 3).map((e) => `第${e.row}行：${e.message}`).join('；'),
      });
    },
    onSettled: () => {
      // 无论成功失败，1s 后清空进度和文件名，下次选文件重头开始
      setTimeout(() => {
        setImportingFile(null);
        setProgress(0);
      }, 800);
    },
    onError: (e: any) => push({ variant: 'error', title: '导入失败', description: e.message }),
  });

  const exportCsv = () => {
    if (!data?.items.length) return;
    const rows = data.items.map((s) => ({
      序号: s.serialNo,
      姓名: s.name,
      状态: labelOf('StudentStatus', s.status),
      积分: s.totalPoints ?? 0,
      均分: s.avgScore ?? '—',
      班级排名: s.rank ?? '—',
      备注: s.remark ?? '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '学生名册');
    XLSX.writeFile(wb, `学生名册_${new Date().toISOString().slice(0, 10)}.xlsx`);
    push({ variant: 'success', title: '已导出 Excel' });
  };

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="roster">学生名册</TabsTrigger>
            <TabsTrigger value="insights">画像分析</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9"
                placeholder="按姓名 / 备注搜索"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="状态筛选"><Filter className="h-3.5 w-3.5 mr-2" /> {status ? labelOf('StudentStatus', status) : '全部状态'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="ACTIVE">在读</SelectItem>
                <SelectItem value="TRIAL">试听</SelectItem>
                <SelectItem value="INACTIVE">退班</SelectItem>
              </SelectContent>
            </Select>

            {/* —— 批量导入：按钮本身显示导入中进度（spinner + 文案 + 进度条）—— */}
            <Dialog open={importDialogOpen} onOpenChange={(v) => !importMut.isPending && setImportDialogOpen(v)}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={importMut.isPending} className="min-w-[140px]">
                  {importMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      正在导入…
                      <span className="ml-1 text-[10px] text-muted-foreground tabular">{progress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> 批量导入
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent onInteractOutside={(e) => importMut.isPending && e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> 批量导入学生</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    支持 <span className="text-primary font-medium">.xlsx / .xls / .csv</span>。
                    Excel 第一行读取中文列名：<b>序号</b> / <b>姓名</b> / <b>备注</b> / <b>状态</b>。若没有序号会自动分配。
                  </p>

                  {/* 导入中进度信息卡（选中文件后立即出现） */}
                  {(importMut.isPending || progress > 0) && importingFile && (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                          <span className="font-medium truncate">正在导入：{importingFile.name}</span>
                          <span className="ml-auto tabular text-xs text-muted-foreground">
                            {(importingFile.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-[width] duration-100 ease-linear"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular">
                          {progress < 100
                            ? `${progress}% — 上传并解析 Excel…请稍等，不要关闭此窗口`
                            : `✓ 完成（100%）— 正在同步列表…`}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-2">
                    <Label className="spark-eyebrow">选择文件</Label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      disabled={importMut.isPending}
                      className={cn(
                        'block w-full text-sm file:mr-4 file:h-9 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:brightness-110',
                        importMut.isPending ? 'opacity-60 cursor-not-allowed file:cursor-not-allowed' : 'file:cursor-pointer',
                      )}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (!activeClassId) {
                            push({ variant: 'error', title: '请先创建班级', description: '去左侧⚙管理班级新建一个班。' });
                            return;
                          }
                          // 用 mutate 而非 mutateAsync：mutationFn throw 时走 onError（toast 提示），
                          // 不会变成 Unhandled Runtime Error 把整页炸红。
                          importMut.mutate(f);
                          // 清空 input value，允许用户下次重新选择同一个文件再次导入
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">💡 你也可以在学生中心 / 成绩登记页继续快速手动录入单条。</p>
                </div>
                <DialogFooter className="!justify-between">
                  <Link href="/scores" className="text-xs text-primary hover:underline">
                    去成绩登记 →
                  </Link>
                  {importMut.isPending && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground tabular">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      导入中… {progress}%
                    </div>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={exportCsv} disabled={!data?.items.length}>
              <Download className="h-4 w-4" /> 导出 Excel
            </Button>
            <StudentCreateDialog onSubmit={(d) => createMut.mutateAsync(d)}>
              <Button disabled={!activeClassId || createMut.isPending}>
                <UserPlus className="h-4 w-4" /> 新增学生
              </Button>
            </StudentCreateDialog>
          </div>
        </div>

        <TabsContent value="roster" ref={rosterSectionRef}>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-4 w-14">#</th>
                      <th className="text-left py-3 px-4">姓名</th>
                      <th className="text-left py-3 px-4">状态</th>
                      <th className="text-right py-3 px-4 tabular">累计积分</th>
                      <th className="text-right py-3 px-4 tabular">讲次均分</th>
                      <th className="text-right py-3 px-4 tabular">班级排名</th>
                      <th className="text-left py-3 px-4 hidden md:table-cell">备注</th>
                      <th className="text-right py-3 px-4 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading &&
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-t border-border">
                          {Array.from({ length: 8 }).map((__, j) => (
                            <td key={j} className="py-3 px-4"><Skeleton className="h-5 w-16" /></td>
                          ))}
                        </tr>
                      ))}
                    {!isLoading && !data?.items.length && (
                      <EmptyStudentsState />
                    )}
                    {data?.items.map((s, i) => (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.02 }}
                        className="border-t border-border hover:bg-white/[0.02]"
                      >
                        <td className="py-3 px-4 tabular text-muted-foreground">{s.serialNo}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary font-semibold">
                              {s.name[0]}
                            </div>
                            <div className="leading-tight">
                              <div className="font-medium">{s.name}</div>
                              <div className="text-[11px] text-muted-foreground">{s.className}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={s.status === 'ACTIVE' ? 'default' : s.status === 'TRIAL' ? 'warning' : 'secondary'}>
                            {labelOf('StudentStatus', s.status)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right tabular font-semibold text-primary">{s.totalPoints ?? 0}</td>
                        <td className={`py-3 px-4 text-right tabular font-medium ${resultColor(s.avgScore != null && s.avgScore >= 24 ? '优秀' : s.avgScore != null && s.avgScore >= 18 ? '及格' : '待提升')}`}>
                          {s.avgScore?.toFixed(1) ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-right tabular font-semibold">
                          {s.rank ? `#${s.rank}` : '—'}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell text-muted-foreground max-w-[260px] truncate">{s.remark ?? '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/scores?studentId=${s.id}`}>
                                  <UserCog className="h-4 w-4 mr-2" /> 查看成绩
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/points?studentId=${s.id}`}>
                                  <Sparkles className="h-4 w-4 mr-2" /> 积分明细
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => removeMut.mutate(s.id)} className="text-error focus:text-error cursor-pointer">
                                <Trash2 className="h-4 w-4 mr-2" /> 删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(data?.items ?? []).slice(0, 9).map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary text-lg font-semibold spark-glow">
                      {s.name[0]}
                    </div>
                    <div>
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        序号 {s.serialNo} · {labelOf('StudentStatus', s.status)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-center pt-0">
                  <div>
                    <div className="text-[11px] text-muted-foreground">积分</div>
                    <div className="text-lg font-semibold tabular text-primary">{s.totalPoints ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">均分</div>
                    <div className="text-lg font-semibold tabular">{s.avgScore?.toFixed(1) ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">排名</div>
                    <div className="text-lg font-semibold tabular">{s.rank ? `#${s.rank}` : '—'}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!data?.items.length && (
              <Card><CardContent className="p-10 text-center text-muted-foreground">暂无学生，请先选择班级或导入。</CardContent></Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyStudentsState() {
  return (
    <tr>
      <td colSpan={8} className="py-16">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 spark-glow mb-4">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <div className="spark-h3 mb-1">班级里还没有学生</div>
          <div className="text-sm text-muted-foreground mb-5">
            可以一键批量导入 Excel 名单，或先手动添加几名学生看看效果。
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline"><Link href="/scores"><Plus className="h-4 w-4" /> 去成绩登记快速录入</Link></Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function StudentCreateDialog({
  children,
  onSubmit,
}: {
  children: React.ReactNode;
  onSubmit: (d: { name: string; serialNo?: number; remark?: string; status?: string }) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [remark, setRemark] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>新增学生</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2">
            <Label>姓名 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：陈一诺" />
          </div>
          <div className="space-y-1.5">
            <Label>序号（留空自动分配）</Label>
            <Input type="number" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">在读</SelectItem>
                <SelectItem value="TRIAL">试听</SelectItem>
                <SelectItem value="INACTIVE">退班</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>备注（薄弱点 / 性格 / 家庭）</Label>
            <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="计算易粗心，建议每次多做 2 道验算题" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button
            onClick={async () => {
              if (!name.trim()) return;
              await onSubmit({
                name: name.trim(),
                serialNo: serialNo ? Number(serialNo) : undefined,
                remark: remark || undefined,
                status,
              });
              setOpen(false);
            }}
          >创建并保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
