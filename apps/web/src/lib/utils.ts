import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind + clsx class merging — shadcn standard helper. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Shorthand for Date formatting (中文友好). */
export function formatDate(d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}

export function formatRelative(d: string | Date) {
  const t = typeof d === 'string' ? new Date(d).getTime() : d.getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return formatDate(d, { year: undefined });
}

/** 中文枚举标签映射（对应后端 enum） */
export const enumLabels: Record<string, Record<string, string>> = {
  StudentStatus: { ACTIVE: '在读', INACTIVE: '退班', TRIAL: '试听' },
  ScoreType: { LESSON: '讲次测', STAGE_TEST: '阶段测' },
  PointCategory: {
    ANSWER: '课堂回答',
    TOP3: '出门测前三',
    HOMEWORK_ON_TIME: '作业按时',
    HOMEWORK_QUALITY: '作业优质',
    NOTE_QUALITY: '笔记优质',
    OTHER: '其他',
  },
  CommType: { PHONE: '电话', WECHAT: '微信', FACE_TO_FACE: '面谈' },
  RenewalStatus: { HIGH: '续费意向高', MEDIUM: '跟进中', LOW: '待激活' },
  TodoCategory: { LESSON_PREP: '备课', FOLLOW_UP: '跟进', RENEWAL: '续费', ADMIN: '行政' },
  AuctionStatus: { OPEN: '竞拍中', CLOSED: '已结束' },
};

export function labelOf(group: string, key?: string | null) {
  if (!key) return '—';
  return enumLabels[group]?.[key] ?? key;
}

/** 结果标签颜色 */
export function resultColor(result: string | null | undefined) {
  switch (result) {
    case '优秀':
      return 'text-success';
    case '及格':
      return 'text-info';
    case '待提升':
      return 'text-error';
    default:
      return 'text-muted-foreground';
  }
}

/** 奖牌图标（积分排名金银铜） */
export function rankMedal(rank: number | undefined | null): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}
