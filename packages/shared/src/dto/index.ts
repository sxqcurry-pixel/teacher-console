/**
 * Generic API response envelope — every REST endpoint returns this shape.
 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PageQuery {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  keyword?: string;
}

/** ---------- Auth ---------- */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: CurrentUser;
}

/** ---------- User ---------- */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: string;
  createdAt: string;
}

/** ---------- Class ---------- */
export interface ClassDto {
  id: string;
  name: string;
  grade: string;
  subject: string;
  teacherId: string;
  studentCount?: number;
  createdAt?: string;
}

export interface CreateClassRequest {
  name: string;
  grade: string;
  subject: string;
}

export interface UpdateClassRequest {
  name?: string;
  grade?: string;
  subject?: string;
}

/** ---------- Student ---------- */
export interface StudentDto {
  id: string;
  serialNo: number;
  name: string;
  remark?: string | null;
  status: string;
  classId: string;
  className?: string;
  totalPoints?: number;
  avgScore?: number;
  rank?: number;
}

export interface CreateStudentRequest {
  serialNo?: number;
  name: string;
  remark?: string;
  status?: string;
  classId: string;
}

export interface UpdateStudentRequest {
  serialNo?: number;
  name?: string;
  remark?: string;
  status?: string;
}

export interface StudentQuery extends PageQuery {
  classId?: string;
  status?: string;
}

export interface BulkImportResult {
  successCount: number;
  failCount: number;
  errors: Array<{ row: number; message: string }>;
  jobId: string;
}

/** ---------- Lesson ---------- */
export interface LessonDto {
  id: string;
  index: number;
  title: string;
  fullScore: number;
  classId: string;
}

export interface CreateLessonRequest {
  index: number;
  title: string;
  fullScore?: number;
  classId: string;
}

/** ---------- Score ---------- */
export interface ScoreDto {
  id: string;
  studentId: string;
  studentName?: string;
  lessonId?: string | null;
  lessonIndex?: number | null;
  type: string;
  rawScore?: number | null;
  weightedScore?: number | null;
  rank?: number | null;
  result?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface ScoreBatchItem {
  studentId: string;
  rawScore: number;
  remark?: string;
}

export interface CreateScoresBatchRequest {
  classId: string;
  lessonId?: string;
  type: string;
  scores: ScoreBatchItem[];
}

export interface ScoreQuery extends PageQuery {
  classId?: string;
  lessonId?: string;
  studentId?: string;
  type?: string;
}

/** ---------- Point ---------- */
export interface PointDto {
  id: string;
  studentId: string;
  studentName?: string;
  lessonId?: string | null;
  lessonIndex?: number | null;
  category: string;
  score: number;
  reason?: string | null;
  createdAt: string;
}

export interface CreatePointRequest {
  studentId: string;
  lessonId?: string;
  category: string;
  score: number;
  reason?: string;
}

export interface PointRankingDto {
  studentId: string;
  studentName: string;
  serialNo: number;
  totalScore: number;
  rank: number;
}

export interface PointQuery extends PageQuery {
  classId?: string;
  studentId?: string;
  category?: string;
}

/** ---------- Auction ---------- */
export interface AuctionDto {
  id: string;
  title: string;
  description?: string | null;
  startingPrice: number;
  currentPrice: number;
  winnerId?: string | null;
  winnerName?: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreateAuctionRequest {
  title: string;
  description?: string;
  startingPrice: number;
  expiresAt: string;
}

export interface PlaceBidRequest {
  auctionId: string;
  price: number;
}

/** ---------- Communication ---------- */
export interface CommunicationDto {
  id: string;
  studentId: string;
  studentName?: string;
  type: string;
  content: string;
  followUp?: string | null;
  renewalStatus?: string | null;
  createdAt: string;
}

export interface CreateCommunicationRequest {
  studentId: string;
  type: string;
  content: string;
  followUp?: string;
  renewalStatus?: string;
}

/** ---------- Todo ---------- */
export interface TodoDto {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  dueDate?: string | null;
  category: string;
  createdAt?: string;
}

export interface CreateTodoRequest {
  title: string;
  dueDate?: string;
  category?: string;
}

export interface UpdateTodoRequest {
  title?: string;
  completed?: boolean;
  dueDate?: string | null;
  category?: string;
}

/** ---------- Wheel ---------- */
export interface WheelSegment {
  id: string;
  label: string;
  color?: string;
  weight: number;
  /** 学生 ID（点名模式）或空（奖项模式） */
  studentId?: string;
  /** 若为 true，抽中后从池中移除（淘汰模式） */
  eliminateOnWin?: boolean;
  eliminated?: boolean;
}

export interface WheelSpinRequest {
  classId: string;
  segments: WheelSegment[];
  mode: 'STUDENT' | 'PRIZE';
  enableElimination?: boolean;
}

export interface WheelSpinResult {
  spinId: string;
  winner: WheelSegment;
  finalRotation: number;
  segments: WheelSegment[];
}

export interface WheelHistoryDto {
  id: string;
  classId: string;
  mode: string;
  winnerLabel: string;
  winnerStudentId?: string | null;
  createdAt: string;
}

/** ---------- AI ---------- */
export type AITemplateType =
  | 'STUDENT_LEARNING_ADVICE'
  | 'TEACHER_TEACHING_ADVICE'
  | 'PARENT_MESSAGE'
  | 'LESSON_PLAN_IDEA'
  | 'CUSTOM';

export interface AIChatOption {
  id: string;
  label: string;
  template: AITemplateType;
  icon?: string;
  /** 模板需要的参数字段名，例如 ['studentId','weakTags'] */
  requiredParams?: string[];
}

export interface AIChatRequest {
  template: AITemplateType;
  studentId?: string;
  classId?: string;
  context?: Record<string, unknown>;
  prompt?: string;
  stream?: boolean;
}

export interface AIMessageChunk {
  done: boolean;
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

/** ---------- Material ---------- */
export interface MaterialDto {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

/** ---------- Dashboard ---------- */
export interface DashboardStats {
  totalStudents: number;
  activeClasses: number;
  avgScoreLastLesson: number | null;
  totalPointsGiven: number;
  upcomingTodosCount: number;
  renewalFollowUpCount: number;
}

export interface RecentActivity {
  id: string;
  type: 'SCORE' | 'POINT' | 'COMM' | 'TODO';
  title: string;
  subtitle?: string;
  timestamp: string;
}

/** ---------- Real-time Sync ---------- */
export interface SyncEnvelope<T = unknown> {
  type: 'DATA_CHANGED' | 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'ERROR' | 'PING';
  channel?: string;
  payload?: SyncPayload<T>;
}

export interface SyncPayload<T> {
  entity: string; // SyncEntity
  action: string; // SyncAction
  data: T;
  /** 触发者用户 ID，用于乐观更新回退判断 */
  issuerId?: string;
  timestamp: string;
}
