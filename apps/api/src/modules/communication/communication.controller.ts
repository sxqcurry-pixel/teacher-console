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
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { CommunicationDto, PageResult } from '@shared/dto';

class CommQueryDto {
  @IsOptional() @IsNumber() page = 1;
  @IsOptional() @IsNumber() pageSize = 20;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() renewalStatus?: string;
}

class CreateCommDto {
  @IsString() @IsNotEmpty() studentId!: string;
  @IsString() @IsNotEmpty() type!: string;
  @IsString() @IsNotEmpty() content!: string;
  @IsOptional() @IsString() followUp?: string;
  @IsOptional() @IsString() renewalStatus?: string;
}

@ApiTags('Communications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('communications')
export class CommunicationController {
  constructor(private readonly comms: CommunicationService) {}

  @Get()
  list(@Query() q: CommQueryDto, @CurrentUser() u: CurrentUserPayload): Promise<PageResult<CommunicationDto>> {
    return this.comms.list(u.id, q);
  }

  @Post()
  create(@Body() dto: CreateCommDto, @CurrentUser() u: CurrentUserPayload): Promise<CommunicationDto> {
    return this.comms.create(u.id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<void> {
    await this.comms.remove(id, u.id);
  }
}
