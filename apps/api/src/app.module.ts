/**
 * Root module — composes all feature modules, infra modules and global providers.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { appConfig, dbConfig, jwtConfig, redisConfig, s3Config, aiConfig } from './config';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AiModule } from './infrastructure/ai/ai.module';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ClassModule } from './modules/class/class.module';
import { StudentModule } from './modules/student/student.module';
import { ScoreModule } from './modules/score/score.module';
import { PointModule } from './modules/point/point.module';
import { AuctionModule } from './modules/auction/auction.module';
import { WheelModule } from './modules/wheel/wheel.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { TodoModule } from './modules/todo/todo.module';
import { MaterialModule } from './modules/material/material.module';
import { AIChatModule } from './modules/ai/ai.module';
import { SyncModule } from './modules/sync/sync.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // ---- Config ----
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, redisConfig, s3Config, aiConfig],
      envFilePath: ['.env.local', '.env', '../../.env'],
      expandVariables: true,
    }),
    ScheduleModule.forRoot(),

    // ---- Infra & Common ----
    CommonModule,
    PrismaModule,
    RedisModule,
    StorageModule,
    AiModule,
    EventBusModule,

    // ---- Auth / User ----
    AuthModule,
    UserModule,

    // ---- Teaching Core ----
    ClassModule,
    StudentModule,
    ScoreModule,
    PointModule,
    AuctionModule,
    WheelModule,
    CommunicationModule,
    TodoModule,
    MaterialModule,

    // ---- AI & Sync ----
    AIChatModule,
    SyncModule,

    // ---- Dashboard (聚合查询) ----
    DashboardModule,
  ],
})
export class AppModule {}
