/**
 * Domain entity base types (before ORM hydration). Pure TS, no framework coupling.
 */

export interface Entity {
  id: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

/** 加权计算上下文 */
export interface ScoreWeightContext {
  lessonFullScore: number;
  stageTestWeight: number; // 文档规定 0.3
}

/** 积分聚合快照 */
export interface StudentPointSnapshot {
  studentId: string;
  totalScore: number;
  rank: number;
  lastUpdatedAt: string;
}

/** Result pattern — 业务操作的统一返回类型 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export interface DomainEvent<TPayload> {
  id: string;
  name: string;
  payload: TPayload;
  occurredAt: string;
  /** 关联聚合根 ID，例如 classId / studentId */
  aggregateId: string;
}
