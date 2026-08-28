import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClassService } from './class.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { ClassDto } from '@shared/dto';

class CreateClassDto {
  @IsString() @IsNotEmpty() @MaxLength(50) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(20) grade!: string;
  @IsString() @IsNotEmpty() @MaxLength(20) subject!: string;
}

class UpdateClassDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsString() @MaxLength(20) grade?: string;
  @IsOptional() @IsString() @MaxLength(20) subject?: string;
}

@ApiTags('Classes')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassController {
  constructor(private readonly classes: ClassService) {}

  @Get()
  list(@CurrentUser() u: CurrentUserPayload): Promise<ClassDto[]> {
    return this.classes.list(u.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<ClassDto> {
    // IDs are generated as cuid(), keep Param string (no UUID validation).
    return this.classes.get(id, u.id);
  }

  @Post()
  create(@Body() dto: CreateClassDto, @CurrentUser() u: CurrentUserPayload): Promise<ClassDto> {
    return this.classes.create(u.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<ClassDto> {
    return this.classes.update(id, u.id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<void> {
    await this.classes.remove(id, u.id);
  }
}
