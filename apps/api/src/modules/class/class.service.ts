import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEventBus } from '../../common/domain-event/domain-event-bus.service';
import { FeatureService } from '../feature.service.base';
import type { ClassDto, CreateClassRequest, UpdateClassRequest } from '@shared/dto';

@Injectable()
export class ClassService extends FeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {
    super();
  }

  async list(teacherId: string): Promise<ClassDto[]> {
    const rows = await this.prisma.class.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { students: true } } },
    });
    return (rows as any[]).map((c: any) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      subject: c.subject,
      teacherId: c.teacherId,
      studentCount: c._count?.students ?? 0,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async get(id: string, teacherId: string): Promise<ClassDto> {
    const c = await this.prisma.class.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    this.ensureOwnerOr404(c, teacherId);
    return {
      id: c.id,
      name: c.name,
      grade: c.grade,
      subject: c.subject,
      teacherId: c.teacherId,
      studentCount: (c as any)._count?.students ?? 0,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async create(teacherId: string, dto: CreateClassRequest): Promise<ClassDto> {
    const c = await this.prisma.class.create({
      data: { ...dto, teacherId },
      include: { _count: { select: { students: true } } },
    });
    await this.events.publish({
      name: 'class.created',
      aggregateId: c.id,
      payload: c,
      channel: `teacher:${teacherId}`,
    });
    return {
      id: c.id,
      name: c.name,
      grade: c.grade,
      subject: c.subject,
      teacherId: c.teacherId,
      studentCount: 0,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async update(id: string, teacherId: string, dto: UpdateClassRequest): Promise<ClassDto> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    this.ensureOwnerOr404(existing, teacherId);
    const c = await this.prisma.class.update({ where: { id }, data: dto });
    return {
      id: c.id,
      name: c.name,
      grade: c.grade,
      subject: c.subject,
      teacherId: c.teacherId,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async remove(id: string, teacherId: string): Promise<void> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    this.ensureOwnerOr404(existing, teacherId);
    await this.prisma.class.delete({ where: { id } });
  }
}
