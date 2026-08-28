/**
 * Development-only type stub for @prisma/client when Prisma Client has NOT
 * been generated yet (requires network for engine download + PostgreSQL).
 *
 * REMOVED AUTOMATICALLY after `prisma generate` succeeds: real types live at
 *   <@prisma/client>/index.d.ts → '.prisma/client/default'
 *
 * This file MUST NOT ship to npm / production build; it is only used to pass
 * `tsc --noEmit` offline. Keep field names in sync with prisma/schema.prisma.
 * ------------------------------------------------------------------ */
/* eslint-disable */
declare module '@prisma/client' {
  // ------- Enums -------------------------------------------------------------
  export const Prisma: {
    PrismaClientKnownRequestError: typeof Error;
    PrismaClientValidationError: typeof Error;
    // Where / orderby input shapes for feature modules
    ScoreWhereInput: any;
    ScoreOrderByWithRelationInput: any;
    ScoreCreateInput: any;
    ScoreUpdateInput: any;
    PointWhereInput: any;
    PointOrderByWithRelationInput: any;
    PointCreateInput: any;
    TodoWhereInput: any;
    TodoOrderByWithRelationInput: any;
    TodoCreateInput: any;
    TodoUpdateInput: any;
    CommunicationWhereInput: any;
    CommunicationOrderByWithRelationInput: any;
    StudentWhereInput: any;
    ClassWhereInput: any;
    PrismaPromise: any;
    [k: string]: any;
  };
  // Allow `Prisma.XxxWhereInput` to be used as namespace via `typeof Prisma['ScoreWhereInput']`
  type _PrismaNs = typeof Prisma;
  namespace Prisma {
    export type ScoreWhereInput = _PrismaNs extends { ScoreWhereInput: infer T } ? T : any;
    export type ScoreOrderByWithRelationInput = _PrismaNs extends { ScoreOrderByWithRelationInput: infer T } ? T : any;
    export type ScoreCreateInput = _PrismaNs extends { ScoreCreateInput: infer T } ? T : any;
    export type ScoreUpdateInput = _PrismaNs extends { ScoreUpdateInput: infer T } ? T : any;
    export type PointWhereInput = _PrismaNs extends { PointWhereInput: infer T } ? T : any;
    export type PointOrderByWithRelationInput = _PrismaNs extends { PointOrderByWithRelationInput: infer T } ? T : any;
    export type TodoWhereInput = _PrismaNs extends { TodoWhereInput: infer T } ? T : any;
    export type TodoOrderByWithRelationInput = _PrismaNs extends { TodoOrderByWithRelationInput: infer T } ? T : any;
    export type TodoCreateInput = _PrismaNs extends { TodoCreateInput: infer T } ? T : any;
    export type TodoUpdateInput = _PrismaNs extends { TodoUpdateInput: infer T } ? T : any;
    export type CommunicationWhereInput = _PrismaNs extends { CommunicationWhereInput: infer T } ? T : any;
    export type CommunicationOrderByWithRelationInput = _PrismaNs extends { CommunicationOrderByWithRelationInput: infer T } ? T : any;
    export type StudentWhereInput = _PrismaNs extends { StudentWhereInput: infer T } ? T : any;
    export type ClassWhereInput = _PrismaNs extends { ClassWhereInput: infer T } ? T : any;
    export type PrismaPromise<T> = Promise<T>;
  }
  export type Role = 'TEACHER' | 'ADMIN';
  export const Role: { TEACHER: 'TEACHER'; ADMIN: 'ADMIN' };
  export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'TRIAL';
  export const StudentStatus: { ACTIVE: 'ACTIVE'; INACTIVE: 'INACTIVE'; TRIAL: 'TRIAL' };
  export type ScoreType = 'LESSON' | 'STAGE_TEST';
  export const ScoreType: { LESSON: 'LESSON'; STAGE_TEST: 'STAGE_TEST' };
  export type PointCategory = 'ANSWER' | 'TOP3' | 'HOMEWORK_ON_TIME' | 'HOMEWORK_QUALITY' | 'NOTE_QUALITY' | 'OTHER';
  export const PointCategory: { [k in PointCategory]: k };
  export type AuctionStatus = 'OPEN' | 'CLOSED';
  export const AuctionStatus: { OPEN: 'OPEN'; CLOSED: 'CLOSED' };
  export type CommType = 'PHONE' | 'WECHAT' | 'FACE_TO_FACE';
  export const CommType: { [k in CommType]: k };
  export type RenewalStatus = 'HIGH' | 'MEDIUM' | 'LOW';
  export const RenewalStatus: { [k in RenewalStatus]: k };
  export type TodoCategory = 'LESSON_PREP' | 'FOLLOW_UP' | 'RENEWAL' | 'ADMIN';
  export const TodoCategory: { [k in TodoCategory]: k };

  // ------- Re-exports --------------------------------------------------------
  export type PrismaPromise<T> = Promise<T> & any;

  export class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: { target?: unknown };
  }
  export class PrismaClientValidationError extends Error {}

  export class PrismaClient {
    constructor(options?: any);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $transaction(input: any | any[], options?: any): Promise<any>;
    $queryRaw<T = any>(template: TemplateStringsArray, ...values: any[]): Promise<T>;
    $queryRawUnsafe<T = any>(query: string, ...values: any[]): Promise<T>;
    $executeRaw(template: TemplateStringsArray, ...values: any[]): Promise<number>;
    $use(fn: any): void;
    $on(event: any, cb: any): void;
    user: any;
    class: any;
    student: any;
    lesson: any;
    score: any;
    point: any;
    auction: any;
    auctionBid: any;
    communication: any;
    todo: any;
    material: any;
    wheelSpin: any;
  }
}
