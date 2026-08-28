import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { jwtConfig } from '../../config/jwt.config';
import { DomainEventBus } from '../../common/domain-event/domain-event-bus.service';
import { isEmail } from '@shared/utils';
import type { AuthResponse, AuthTokens, CurrentUser } from '@shared/dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
    private readonly events: DomainEventBus,
  ) {}

  async register(input: { email: string; password: string; name: string }): Promise<AuthResponse> {
    if (!isEmail(input.email)) throw new BadRequestException('邮箱格式不正确');
    if (input.password.length < 8) throw new BadRequestException('密码至少 8 位');
    if (!input.name.trim()) throw new BadRequestException('姓名不能为空');

    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('该邮箱已被注册');

    const password = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: { email: input.email, name: input.name.trim(), password, role: 'TEACHER' },
    });

    await this.events.publish({
      name: 'user.created',
      aggregateId: user.id,
      payload: { id: user.id, email: user.email },
      channel: `user:${user.id}`,
    });

    return this.buildAuthResponse(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedException('账号或密码错误');
    const ok = await bcrypt.compare(input.password, user.password);
    if (!ok) throw new UnauthorizedException('账号或密码错误');
    return this.buildAuthResponse(user);
  }

  async me(id: string): Promise<CurrentUser> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new UnauthorizedException('用户不存在');
    return { id: u.id, email: u.email, name: u.name, avatar: u.avatar, role: u.role };
  }

  refresh(_refreshToken: string): AuthTokens {
    // TODO: issue refresh token + persistence — for now re-use access flow
    throw new UnauthorizedException('Refresh token flow to be implemented');
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    name: string;
    avatar?: string | null;
    role: string;
  }): Promise<AuthResponse> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.cfg.secret,
      expiresIn: this.cfg.accessTtl,
    });
    // 15 min in ms
    const expiresIn = 15 * 60;
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.cfg.secret,
      expiresIn: this.cfg.refreshTtl,
    });
    return {
      tokens: { accessToken, refreshToken, expiresIn },
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role: user.role },
    };
  }
}
