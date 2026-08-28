import { Module } from '@nestjs/common';
import { AIChatController } from './ai.controller';
import { AIChatService } from './ai.service';

@Module({
  controllers: [AIChatController],
  providers: [AIChatService],
  exports: [AIChatService],
})
export class AIChatModule {}
