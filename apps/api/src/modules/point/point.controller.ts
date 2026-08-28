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
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PointService } from './point.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { PageResult, PointDto, PointRankingDto } from '@shared/dto';

class PointQueryDto {
  @IsOptional() @IsNumber() page = 1;
  @IsOptional() @IsNumber() pageSize = 50;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() category?: string;
}

class CreatePointDto {
  @IsString() @IsNotEmpty() studentId!: string;
  @IsOptional() @IsString() lessonId?: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsInt() score!: number;
  @IsOptional() @IsString() reason?: string;
}

@ApiTags('Points')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('points')
export class PointController {
  constructor(private readonly points: PointService) {}

  @Get()
  list(
    @Query() q: PointQueryDto,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<PageResult<PointDto>> {
    return this.points.query(u.id, q);
  }

  @Get('ranking')
  ranking(
    @Query('classId') classId: string,
    @Query('limit') limit?: string,
    @CurrentUser() u?: CurrentUserPayload,
  ): Promise<PointRankingDto[]> {
    return this.points.ranking(u!.id, classId, limit ? Math.min(200, Number(limit)) : 50);
  }

  @Post()
  create(@Body() dto: CreatePointDto, @CurrentUser() u: CurrentUserPayload): Promise<PointDto> {
    return this.points.add(u.id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<void> {
    await this.points.remove(id, u.id);
  }
}
