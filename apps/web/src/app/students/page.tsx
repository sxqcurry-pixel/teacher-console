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
import { labelOf, resultColor } from '@/lib/utils';
import type { BulkImportResult, PageResult, StudentDto } from '@spark/shared';

export default function StudentsPage() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const classes = useAppStore((s) => s.classes);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const qc = useQueryClient();
  const push = useAppStore((s) => s.pushToast);

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
    mutationFn: (d: any) => endpoints.students.create({ classId: activeClassId!, ...d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['classes'] });
      push({ variant: 'success', title: '学生已添加' });
    },
    onError: (e: any) => push({ variant: 'error', title: '添加失败', description: e.message }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => endpoints.students.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
    onError: (e: any) => push({ variant: 'error', title: '删除失败', description: e.message }),
  });

  const importMut = useMutation({
    // 【防御】localStorage 里可能残留旧的/已删除的 activeClassId（如 cls-demo-1），
    // 直接传给后端会被 ensureOwnerOr404 拦成『目标不存在』。
    // 这里在发请求前校验：如果 activeClassId 不在真实班级列表里，自动兜底用第一个班级。
    mutationFn: (file: File) => {
      const validClassId =
        activeClassId && classes.some((c) => c.id === activeClassId)
          ? activeClassId
          : classes[0]?.id;
      if (!validClassId) {
        throw new Error('请先创建班级后再导入学生');
      }
      return endpoints.students.bulkImport(file, validClassId) as Promise<BulkImportResult>;
    },
    onSuccess: (r: BulkImportResult) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      push({
        variant: r.failCount ? 'warning' : 'success',
        title: `导入完成：成功 ${r.successCount}，失败 ${r.failCount}`,
        description: r.errors.slice(0, 3).map((e) => `第${e.row}行：${e.message}`).join('；'),
      });
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
      <Tabs defaultValue="roster">
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
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4" /> 批量导入
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> 批量导入学生</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    支持 <span className="text-primary font-medium">.xlsx / .xls / .csv</span>。
                    Excel 第一行读取中文列名：<b>序号</b> / <b>姓名</b> / <b>备注</b> / <b>状态</b>。若没有序号会自动分配。
                  </p>
                  <Label className="spark-eyebrow">选择文件</Label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="block w-full text-sm file:mr-4 file:h-9 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer hover:file:brightness-110"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importMut.mutateAsync(f);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">💡 你也可以在学生中心 / 成绩登记页继续快速手动录入单条。</p>
                </div>
                <DialogFooter>
                  <Link href="/scores" className="text-xs text-primary hover:underline mr-auto">
                    去成绩登记 →
                  </Link>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={exportCsv} disabled={!data?.items.length}>
              <Download className="h-4 w-4" /> 导出 Excel
            </Button>
            <StudentCreateDialog onSubmit={(d) => createMut.mutateAsync(d)}>
              <Button>
                <UserPlus className="h-4 w-4" /> 新增学生
              </Button>
            </StudentCreateDialog>
          </div>
        </div>

        <TabsContent value="roster">
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
