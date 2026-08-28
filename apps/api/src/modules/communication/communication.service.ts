import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FeatureService } from '../feature.service.base';
import { page, pageOffset } from '@shared/utils';
import type {
  CommunicationDto,
  CreateCommunicationRequest,
  PageResult,
} from '@shared/dto';

@Injectable()
export class CommunicationService extends FeatureService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(
    teacherId: string,
    q: { page: number; pageSize: number; studentId?: string; classId?: string; renewalStatus?: string },
  ): Promise<PageResult<CommunicationDto>> {
    const { skip, take } = pageOffset(q.page || 1, q.pageSize || 20);
    const where: Prisma.CommunicationWhereInput = {
      student: { class: { teacherId } },
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(q.classId ? { student: { classId: q.classId } } : {}),
      ...(q.renewalStatus ? { renewalStatus: q.renewalStatus as any } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { student: { select: { name: true } } },
      }),
      this.prisma.communication.count({ where }),
    ]);
    return page(
      (rows as any[]).map((c) => ({
        id: c.id,
        studentId: c.studentId,
        studentName: c.student?.name,
        type: c.type,
        content: c.content,
        followUp: c.followUp ?? null,
        renewalStatus: c.renewalStatus ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      q.page || 1,
      q.pageSize || 20,
    );
  }

  async create(teacherId: string, dto: CreateCommunicationRequest): Promise<CommunicationDto> {
    const s = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      include: { class: { select: { teacherId: true } } },
    });
    if (!s || s.class.teacherId !== teacherId) throw new NotFoundException('学生不存在');
    const c = await this.prisma.communication.create({
      data: {
        studentId: dto.studentId,
        type: dto.type as any,
        content: dto.content,
        followUp: dto.followUp ?? null,
        renewalStatus: (dto.renewalStatus as any) ?? null,
      },
      include: { student: { select: { name: true } } },
    });
    return {
      id: c.id,
      studentId: c.studentId,
      studentName: c.student.name,
      type: c.type,
      content: c.content,
      followUp: c.followUp ?? null,
      renewalStatus: c.renewalStatus ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async remove(id: string, teacherId: string): Promise<void> {
    const c = await this.prisma.communication.findUnique({
      where: { id },
      include: { student: { include: { class: { select: { teacherId: true } } } } },
    });
    if (!c || c.student.class.teacherId !== teacherId) throw new NotFoundException('记录不存在');
    await this.prisma.communication.delete({ where: { id } });
  }
}
