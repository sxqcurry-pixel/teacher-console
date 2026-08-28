/**
 * Domain enums — MUST stay in sync with Prisma schema enum definitions.
 */

export enum Role {
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
}

export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TRIAL = 'TRIAL',
}

export enum ScoreType {
  LESSON = 'LESSON',
  STAGE_TEST = 'STAGE_TEST',
}

export enum PointCategory {
  /** 课堂回答 */
  ANSWER = 'ANSWER',
  /** 出门测前三名 */
  TOP3 = 'TOP3',
  /** 作业按时完成 */
  HOMEWORK_ON_TIME = 'HOMEWORK_ON_TIME',
  /** 作业质量优秀 */
  HOMEWORK_QUALITY = 'HOMEWORK_QUALITY',
  /** 笔记质量优秀 */
  NOTE_QUALITY = 'NOTE_QUALITY',
  /** 其他 */
  OTHER = 'OTHER',
}

export enum AuctionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CommType {
  PHONE = 'PHONE',
  WECHAT = 'WECHAT',
  FACE_TO_FACE = 'FACE_TO_FACE',
}

export enum RenewalStatus {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum TodoCategory {
  LESSON_PREP = 'LESSON_PREP',
  FOLLOW_UP = 'FOLLOW_UP',
  RENEWAL = 'RENEWAL',
  ADMIN = 'ADMIN',
}

/** WebSocket 实时广播通道实体类型 */
export enum SyncEntity {
  STUDENT = 'STUDENT',
  SCORE = 'SCORE',
  POINT = 'POINT',
  WHEEL = 'WHEEL',
  AUCTION = 'AUCTION',
  TODO = 'TODO',
}

/** 同步动作 */
export enum SyncAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  BATCH_UPDATED = 'BATCH_UPDATED',
}
