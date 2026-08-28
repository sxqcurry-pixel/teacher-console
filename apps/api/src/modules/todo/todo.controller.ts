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
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TodoService } from './todo.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { TodoDto } from '@shared/dto';

class TodoFilterDto {
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() dueToday?: boolean;
}

class CreateTodoDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() category?: string;
}

class UpdateTodoDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() dueDate?: string | null;
  @IsOptional() @IsString() category?: string;
}

@ApiTags('Todos')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('todos')
export class TodoController {
  constructor(private readonly todos: TodoService) {}

  @Get()
  list(@Query() filter: TodoFilterDto, @CurrentUser() u: CurrentUserPayload): Promise<TodoDto[]> {
    return this.todos.list(u.id, filter);
  }

  @Post()
  create(@Body() dto: CreateTodoDto, @CurrentUser() u: CurrentUserPayload): Promise<TodoDto> {
    return this.todos.create(u.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<TodoDto> {
    return this.todos.update(u.id, id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<void> {
    await this.todos.remove(u.id, id);
  }
}
