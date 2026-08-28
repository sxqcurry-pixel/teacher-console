import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Controller param decorator — returns the currently-authenticated user
 * (as attached by JwtAuthGuard). Usage:
 *
 *   @Get('me')
 *   me(@CurrentUser() user: CurrentUser) { return user; }
 */
export interface CurrentUserPayload {
  id: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as CurrentUserPayload;
  },
);
