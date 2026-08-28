import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway';
import { SyncService } from './sync.service';

@Module({
  providers: [SyncGateway, SyncService],
  exports: [SyncGateway, SyncService],
})
export class SyncModule {}
