import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { MaterialDto } from '@shared/dto';

@Injectable()
export class MaterialService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, keyword?: string, tag?: string): Promise<MaterialDto[]> {
    const rows = await this.prisma.material.findMany({
      where: {
        userId,
        ...(keyword
          ? {
              OR: [{ title: { contains: keyword } }, { content: { contains: keyword } }],
            }
          : {}),
        ...(tag ? { tags: { has: tag } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return (rows as any[]).map((m: any) => ({
      id: m.id,
      userId: m.userId,
      title: m.title,
      content: m.content,
      tags: m.tags,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async create(
    userId: string,
    dto: { title: string; content: string; tags?: string[] },
  ): Promise<MaterialDto> {
    const m = await this.prisma.material.create({
      data: { userId, title: dto.title, content: dto.content, tags: dto.tags ?? [] },
    });
    return {
      id: m.id,
      userId: m.userId,
      title: m.title,
      content: m.content,
      tags: m.tags,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: { title?: string; content?: string; tags?: string[] },
  ): Promise<MaterialDto> {
    const exist = await this.prisma.material.findUnique({ where: { id } });
    if (!exist || exist.userId !== userId) throw new NotFoundException('素材不存在');
    const m = await this.prisma.material.update({ where: { id }, data: dto });
    return {
      id: m.id,
      userId: m.userId,
      title: m.title,
      content: m.content,
      tags: m.tags,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const exist = await this.prisma.material.findUnique({ where: { id } });
    if (!exist || exist.userId !== userId) throw new NotFoundException('素材不存在');
    await this.prisma.material.delete({ where: { id } });
  }
}
