import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { UserDto } from '@shared/dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserDto> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('用户不存在');
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar ?? null,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async updateProfile(id: string, patch: { name?: string; avatar?: string | null }): Promise<UserDto> {
    const u = await this.prisma.user.update({ where: { id }, data: patch });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar ?? null,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
