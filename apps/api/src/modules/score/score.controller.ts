import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ScoreService } from './score.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { PageResult, ScoreDto } from '@shared/dto';

class ScoreQueryDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() lessonId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() type?: string;
}

class ScoreBatchItemDto {
  @IsString() @IsNotEmpty() studentId!: string;
  @IsNumber() rawScore!: number;
  @IsOptional() @IsString() remark?: string;
}

class ScoreBatchDto {
  @IsString() @IsNotEmpty() classId!: string;
  @IsOptional() @IsString() lessonId?: string;
  @IsString() @IsNotEmpty() type!: string;
  @IsArray() @IsInt({ each: false }) scores!: ScoreBatchItemDto[];
}

@ApiTags('Scores')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('scores')
export class ScoreController {
  constructor(private readonly scores: ScoreService) {}

  @Get()
  list(
    @Query() q: ScoreQueryDto,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<PageResult<ScoreDto>> {
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(500, parseInt(q.pageSize ?? '50', 10) || 50));
    return this.scores.query(u.id, { ...q, page, pageSize });
  }

  @Post('batch')
  batch(
    @Body() dto: ScoreBatchDto,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<{ updated: number; classId: string }> {
    return this.scores.batchUpsert(u.id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<void> {
    await this.scores.remove(id, u.id);
  }
}
