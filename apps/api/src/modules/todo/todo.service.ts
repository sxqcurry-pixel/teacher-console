import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FeatureService } from '../feature.service.base';
import type { CreateTodoRequest, TodoDto, UpdateTodoRequest } from '@shared/dto';

@Injectable()
export class TodoService extends FeatureService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(userId: string, filter?: { completed?: boolean; category?: string; dueToday?: boolean }): Promise<TodoDto[]> {
    const today = new Date();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const where: Prisma.TodoWhereInput = {
      userId,
      ...(filter?.completed !== undefined ? { completed: filter.completed } : {}),
      ...(filter?.category ? { category: filter.category as any } : {}),
      ...(filter?.dueToday ? { dueDate: { gte: today, lte: end } } : {}),
    };
    const rows = await this.prisma.todo.findMany({
      where,
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    return (rows as any[]).map(this.map.bind(this));
  }

  async create(userId: string, dto: CreateTodoRequest): Promise<TodoDto> {
    const t = await this.prisma.todo.create({
      data: {
        userId,
        title: dto.title.trim(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        category: (dto.category as any) ?? 'ADMIN',
      },
    });
    return this.map(t);
  }

  async update(userId: string, id: string, dto: UpdateTodoRequest): Promise<TodoDto> {
    const existing = await this.prisma.todo.findUnique({ where: { id } });
    this.ensureOwnerOr404(existing, userId);
    const patch: Prisma.TodoUpdateInput = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.completed !== undefined) patch.completed = dto.completed;
    if (dto.category !== undefined) patch.category = dto.category as any;
    if (dto.dueDate !== undefined) {
      patch.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    const t = await this.prisma.todo.update({ where: { id }, data: patch });
    return this.map(t);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.todo.findUnique({ where: { id } });
    this.ensureOwnerOr404(existing, userId);
    await this.prisma.todo.delete({ where: { id } });
  }

  private map(t: any): TodoDto {
    return {
      id: t.id,
      userId: t.userId,
      title: t.title,
      completed: t.completed,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      category: t.category,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
