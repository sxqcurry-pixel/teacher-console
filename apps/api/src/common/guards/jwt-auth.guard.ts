import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { jwtConfig } from '../../config/jwt.config';

/**
 * Stateless JWT guard — verifies Authorization: Bearer <token>.
 * Decoded payload is attached to req.user as { id, email, role }.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('缺少访问令牌');
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.cfg.secret,
      });
      (req as any).user = {
        id: payload.sub || payload.id,
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch (e) {
      throw new UnauthorizedException('令牌无效或已过期');
    }
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    const q = (req.query as Record<string, unknown>)?.token;
    if (typeof q === 'string') return q;
    const cookie = (req as any).cookies?.access_token;
    if (typeof cookie === 'string') return cookie;
    return null;
  }
}
