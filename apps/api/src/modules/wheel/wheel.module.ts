import { Module } from '@nestjs/common';
import { WheelController } from './wheel.controller';
import { WheelService } from './wheel.service';

@Module({
  controllers: [WheelController],
  providers: [WheelService],
  exports: [WheelService],
})
export class WheelModule {}
