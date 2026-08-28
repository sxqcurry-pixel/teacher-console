import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MaterialService } from './material.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { MaterialDto } from '@shared/dto';

class CreateMaterialDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() content!: string;
  @IsOptional() @IsArray() tags?: string[];
}

class UpdateMaterialDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsArray() tags?: string[];
}

@ApiTags('Materials')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('materials')
export class MaterialController {
  constructor(private readonly materials: MaterialService) {}

  @Get()
  list(
    @Query('keyword') keyword?: string,
    @Query('tag') tag?: string,
    @CurrentUser() u?: CurrentUserPayload,
  ): Promise<MaterialDto[]> {
    return this.materials.list(u!.id, keyword, tag);
  }

  @Post()
  create(@Body() dto: CreateMaterialDto, @CurrentUser() u: CurrentUserPayload): Promise<MaterialDto> {
    return this.materials.create(u.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<MaterialDto> {
    return this.materials.update(u.id, id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<void> {
    await this.materials.remove(u.id, id);
  }
}
