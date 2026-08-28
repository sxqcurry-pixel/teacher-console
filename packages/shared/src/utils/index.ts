import type { ApiResponse, PageResult } from '../dto';

/** 创建标准成功响应 */
export function ok<T>(data: T, message = 'ok', code = 0): ApiResponse<T> {
  return {
    code,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

/** 创建标准失败响应 */
export function err<T = null>(
  message: string,
  code = 500,
  data: T | null = null,
): ApiResponse<T | null> {
  return {
    code,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

/** 构造分页结果 */
export function page<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PageResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return { items, total, page, pageSize, totalPages };
}

/** 加权分数计算（阶段测 raw * 0.3） */
export function weightedStageTest(rawScore: number, weight = 0.3): number {
  return round2(rawScore * weight);
}

/** 两位小数四舍五入 */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** 分页偏移 */
export function pageOffset(page: number, pageSize: number): { skip: number; take: number } {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(200, Math.max(1, pageSize));
  return { skip: (safePage - 1) * safeSize, take: safeSize };
}

/** 校验 Email */
export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** CUID 生成（浏览器/Node 通用，不依赖 crypto.randomUUID） */
export function cuidLike(prefix = 'c'): string {
  const base =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  return prefix + base.padEnd(24, '0').slice(0, 24);
}
