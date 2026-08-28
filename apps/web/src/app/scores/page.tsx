'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  GraduationCap,
  Save,
  Plus,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { endpoints } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import { labelOf, resultColor } from '@/lib/utils';
import { ScoreType as ScoreTypeEnum } from '@spark/shared';
import type { ScoreDto, StudentDto, PageResult } from '@spark/shared';

const FULL_SCORE_STAGE = 100;
const STAGE_WEIGHT = 0.3;

type ScoreTypeLocal = typeof ScoreTypeEnum.LESSON | typeof ScoreTypeEnum.STAGE_TEST;

export default function ScoresPage() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const classes = useAppStore((s) => s.classes);
  const push = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();
  const [type, setType] = useState<ScoreTypeLocal>(ScoreTypeEnum.LESSON);
  const [lessonIndex, setLessonIndex] = useState<string>('1');
  const fullScore = type === ScoreTypeEnum.LESSON ? 30 : FULL_SCORE_STAGE;

  // 获取班级学生（左侧输入）
  const rosterQuery = useQuery<PageResult<StudentDto>>({
    queryKey: ['students', 'roster', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return { items: [], total: 0, page: 1, pageSize: 300, totalPages: 0 };
      return endpoints.students.query({
        classId: activeClassId,
        page: 1,
        pageSize: 300,
        status: 'ACTIVE',
      }) as Promise<PageResult<StudentDto>>;
    },
    enabled: !!activeClassId,
  });

  // 获取已保存的成绩回显
  const scoresQuery = useQuery<ScoreDto[]>({
    queryKey: ['scores', activeClassId, type, lessonIndex],
    queryFn: async () => {
      if (!activeClassId) return [];
      const res = (await endpoints.scores.query({
        classId: activeClassId,
        type,
        page: 1,
        pageSize: 300,
      })) as PageResult<ScoreDto>;
      return res.items;
    },
    enabled: !!activeClassId,
  });

  // 分数本地编辑态：{studentId -> string}
  const [draft, setDraft] = useState<Record<string, string>>({});
  const scoresMap = useMemo(() => {
    const m = new Map<string, ScoreDto>();
    scoresQuery.data?.forEach((s) => s.studentId && m.set(s.studentId, s));
    return m;
  }, [scoresQuery.data]);

  const list = rosterQuery.data?.items ?? [];
  const rows = list.map((s) => {
    const rawDraft = draft[s.id] ?? scoresMap.get(s.id)?.rawScore?.toString() ?? '';
    const parsed = rawDraft === '' ? null : Number(rawDraft);
    const valid = parsed !== null && !Number.isNaN(parsed);
    const weighted = valid ? (type === ScoreTypeEnum.STAGE_TEST ? round2((parsed as number) * STAGE_WEIGHT) : round2(parsed as number)) : null;
    const label = valid ? labelScore(parsed as number, fullScore) : '—';
    return { s, rawDraft, parsed, valid, weighted, label, saved: scoresMap.get(s.id) };
  });

  const stats = useMemo(() => {
    const valids = rows.filter((r) => r.valid).map((r) => r.weighted as number);
    if (!valids.length) return { filled: 0, total: rows.length, avg: null, pass: 0, excellent: 0 };
    const avg = valids.reduce((a, b) => a + b, 0) / valids.length;
    const pass = valids.filter((v) => v >= (type === ScoreTypeEnum.LESSON ? 18 : 60)).length;
    const excellent = valids.filter((v) => v >= (type === ScoreTypeEnum.LESSON ? 27 : 90)).length;
    return { filled: valids.length, total: rows.length, avg: round2(avg), pass, excellent };
  }, [rows, type]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!activeClassId) throw new Error('请先选择班级');
      const scores = rows
        .filter((r) => r.valid)
        .map((r) => ({ studentId: r.s.id, rawScore: r.parsed as number, remark: undefined }));
      return endpoints.scores.batch({ classId: activeClassId, type, scores });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scores'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      push({ variant: 'success', title: '成绩已保存', description: `已更新 ${stats.filled} 条，均分 ${stats.avg ?? '—'}` });
    },
    onError: (e: any) => push({ variant: 'error', title: '保存失败', description: e.message }),
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="entry">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="entry">成绩录入</TabsTrigger>
            <TabsTrigger value="history">历史</TabsTrigger>
            <TabsTrigger value="summary">汇总分析</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <GraduationCap className="h-3 w-3 mr-1" />
              {activeClassId ? classes.find((c) => c.id === activeClassId)?.name ?? '选择班级' : '请先选择班级'}
            </Badge>
            <ScoreTypeSwitcher value={type} onChange={setType} />
            {type === ScoreTypeEnum.LESSON ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">讲次</span>
                <Input
                  type="number"
                  className="w-20 text-center"
                  value={lessonIndex}
                  onChange={(e) => setLessonIndex(e.target.value)}
                  min={1}
                />
                <span className="text-xs text-muted-foreground">满分 {fullScore}</span>
              </div>
            ) : (
              <Badge variant="gold">阶段测 · 满分 100 · ×0.3 折算 · 与讲次分加总</Badge>
            )}
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!rows.some((r) => r.valid) || saveMut.isPending}
            >
              <Save className="h-4 w-4" /> 保存并算排名
            </Button>
          </div>
        </div>

        <TabsContent value="entry">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {[
              { k: '已录入', v: `${stats.filled}/${stats.total}`, tone: 'text-primary', icon: <RefreshCw className="h-4 w-4" /> },
              { k: '加权均分', v: stats.avg?.toFixed(1) ?? '—', tone: 'text-info', icon: <Calculator className="h-4 w-4" /> },
              { k: '及格 / 优秀', v: `${stats.pass} / ${stats.excellent}`, tone: 'text-success', icon: <BarChart3 className="h-4 w-4" /> },
            ].map((c, i) => (
              <Card key={c.k}>
                <CardContent className="p-5">
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">{c.icon} {c.k}</div>
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 opacity-70">
                      <Link href="/students"><Plus className="h-3.5 w-3.5" /></Link>
                    </Button>
                  </motion.div>
                  <div className={`mt-2 text-3xl tabular font-semibold ${c.tone}`}>{c.v}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="w-14 py-3 px-4 text-left">#</th>
                      <th className="py-3 px-4 text-left">学生</th>
                      <th className="py-3 px-4 w-56">原始分 / {fullScore}</th>
                      <th className="py-3 px-4 w-40 text-right tabular">加权</th>
                      <th className="py-3 px-4 w-32 text-right">结果</th>
                      <th className="py-3 px-4 w-28 text-right">班级排名</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <motion.tr
                        key={r.s.id}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.01 }}
                        className="border-t border-border hover:bg-white/[0.02]"
                      >
                        <td className="py-3 px-4 tabular text-muted-foreground">{r.s.serialNo}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary font-semibold">
                              {r.s.name[0]}
                            </div>
                            <div className="leading-tight">
                              <div className="font-medium">{r.s.name}</div>
                              {r.s.remark && <div className="text-[11px] text-muted-foreground max-w-[30ch] truncate">{r.s.remark}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="tabular"
                              step={type === ScoreTypeEnum.LESSON ? 1 : 0.5}
                              placeholder={r.saved ? undefined : `0 - ${fullScore}`}
                              value={r.rawDraft}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, [r.s.id]: e.target.value }))
                              }
                            />
                            {r.valid && (r.parsed as number) > fullScore && (
                              <Badge variant="destructive">超分</Badge>
                            )}
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-right tabular font-semibold text-lg ${resultColor(r.label)}`}>
                          {r.weighted !== null ? r.weighted.toFixed(1) : '—'}
                          {r.valid && <span className="text-[10px] text-muted-foreground ml-1">/ {type === ScoreTypeEnum.LESSON ? 30 : 30}</span>}
                        </td>
                        <td className="py-3 px-4 text-right"><Badge variant={r.label === '优秀' ? 'gold' : r.label === '及格' ? 'success' : r.label === '待提升' ? 'destructive' : 'outline'}>{r.label}</Badge></td>
                        <td className="py-3 px-4 text-right tabular font-semibold">
                          {r.saved?.rank ? `#${r.saved.rank}` : <span className="text-muted-foreground text-xs">保存后计算</span>}
                        </td>
                      </motion.tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-muted-foreground">
                          当前班级无在读学生。<Link href="/students" className="text-primary hover:underline">去学生中心导入名册 →</Link>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <HistoryTable />
        </TabsContent>

        <TabsContent value="summary">
          <SummaryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreTypeSwitcher({ value, onChange }: { value: ScoreTypeLocal; onChange: (v: ScoreTypeLocal) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1">
      {([ScoreTypeEnum.LESSON, ScoreTypeEnum.STAGE_TEST] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            value === t
              ? 'bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-glow'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {labelOf('ScoreType', t)}
        </button>
      ))}
    </div>
  );
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}
function labelScore(raw: number, full: number) {
  const pct = raw / Math.max(1, full);
  if (pct >= 0.9) return '优秀';
  if (pct >= 0.6) return '及格';
  return '待提升';
}

function HistoryTable() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const { data, isLoading } = useQuery<ScoreDto[]>({
    queryKey: ['scores', 'history', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return [];
      const res = (await endpoints.scores.query({ classId: activeClassId, page: 1, pageSize: 100 })) as PageResult<ScoreDto>;
      return res.items;
    },
    enabled: !!activeClassId,
  });
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="py-3 px-4 text-left">学生</th>
                <th className="py-3 px-4 text-left">类型</th>
                <th className="py-3 px-4 text-left">讲次</th>
                <th className="py-3 px-4 text-right tabular">原始</th>
                <th className="py-3 px-4 text-right tabular">加权</th>
                <th className="py-3 px-4 text-right tabular">排名</th>
                <th className="py-3 px-4 text-right">时间</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))}
              {(data ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-white/[0.02]">
                  <td className="py-3 px-4">{s.studentName ?? s.studentId.slice(-6)}</td>
                  <td className="py-3 px-4"><Badge variant="outline">{labelOf('ScoreType', s.type)}</Badge></td>
                  <td className="py-3 px-4">{s.lessonIndex ? `第 ${s.lessonIndex} 讲` : '—'}</td>
                  <td className="py-3 px-4 text-right tabular">{s.rawScore}</td>
                  <td className={`py-3 px-4 text-right tabular font-medium ${resultColor(s.result ?? '')}`}>{s.weightedScore}</td>
                  <td className="py-3 px-4 text-right tabular font-semibold">{s.rank ? `#${s.rank}` : '—'}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground tabular text-xs">
                    {new Date(s.createdAt).toLocaleString('zh-CN', { hour12: false })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryPanel() {
  const activeClassId = useAppStore((s) => s.activeClassId);
  const { data = [] } = useQuery<ScoreDto[]>({
    queryKey: ['scores', 'summary', activeClassId],
    queryFn: async () => {
      if (!activeClassId) return [];
      const res = (await endpoints.scores.query({ classId: activeClassId, page: 1, pageSize: 300 })) as PageResult<ScoreDto>;
      return res.items;
    },
  });
  const byLesson = new Map<string, { name: string; sum: number; count: number; excellent: number; pass: number }>();
  data
    .filter((s) => s.type === ScoreTypeEnum.LESSON && s.weightedScore != null)
    .forEach((s) => {
      const key = `第${s.lessonIndex ?? '?'}讲`;
      const cur = byLesson.get(key) ?? { name: key, sum: 0, count: 0, excellent: 0, pass: 0 };
      cur.sum += s.weightedScore as number;
      cur.count += 1;
      if ((s.weightedScore as number) >= 27) cur.excellent += 1;
      if ((s.weightedScore as number) >= 18) cur.pass += 1;
      byLesson.set(key, cur);
    });
  const arr = Array.from(byLesson.values());
  return (
    <Card>
      <CardHeader>
        <span className="spark-eyebrow"><BarChart3 className="h-3 w-3" /> SUMMARY</span>
        <CardTitle className="mt-1">讲次汇总</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {arr.length === 0
            ? <div className="col-span-full p-10 text-center text-muted-foreground">暂无汇总数据，先去成绩登记录入若干讲次。</div>
            : arr.map((r) => (
                <Card key={r.name} className="spark-card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{r.name}</div>
                      <Badge variant="gold">{r.count}人</Badge>
                    </div>
                    <div className="mt-3 text-3xl tabular font-semibold text-primary">
                      {r.count ? (r.sum / r.count).toFixed(1) : '—'}
                      <span className="text-sm text-muted-foreground font-normal ml-2">均分</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="text-muted-foreground">优秀 (≥27)</div>
                        <div className="tabular text-xl font-semibold text-success">{r.excellent}</div>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="text-muted-foreground">及格 (≥18)</div>
                        <div className="tabular text-xl font-semibold text-info">{r.pass}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </CardContent>
    </Card>
  );
}
