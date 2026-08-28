import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { WheelService } from './wheel.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { WheelHistoryDto, WheelSegment, WheelSpinResult } from '@shared/dto';

class WheelSpinDto {
  @IsString() @IsNotEmpty() classId!: string;
  @IsArray() @ArrayNotEmpty() segments!: Array<Record<string, unknown>>;
  @IsIn(['STUDENT', 'PRIZE']) mode!: 'STUDENT' | 'PRIZE';
  @IsOptional() @IsBoolean() enableElimination?: boolean;
}

@ApiTags('Wheel')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('wheel')
export class WheelController {
  constructor(private readonly wheel: WheelService) {}

  @Get('segments/students/:classId')
  segments(
    @Param('classId') classId: string,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<WheelSegment[]> {
    return this.wheel.generateStudentSegments(classId, u.id);
  }

  @Post('spin')
  spin(@Body() dto: WheelSpinDto, @CurrentUser() u: CurrentUserPayload): Promise<WheelSpinResult> {
    return this.wheel.spin(u.id, dto as any);
  }

  @Get('history')
  history(
    @Query('classId') classId: string,
    @Query('limit') limit?: string,
    @CurrentUser() u?: CurrentUserPayload,
  ): Promise<WheelHistoryDto[]> {
    return this.wheel.history(u!.id, classId, limit ? Number(limit) : 50);
  }
}
