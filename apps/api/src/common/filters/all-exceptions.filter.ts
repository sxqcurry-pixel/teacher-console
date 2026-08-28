import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/**
 * Last-resort safety net. Transforms every thrown value into the
 * standard ApiResponse envelope with code != 0.
 *
 * Handles:
 *   - HttpException (code = http status)
 *   - Prisma client validation errors (400)
 *   - Zod validation errors (400)
 *   - Everything else (500)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost?: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const httpAdapter =
      this.httpAdapterHost?.httpAdapter ?? (ctx.getResponse() as any);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = HttpStatus.INTERNAL_SERVER_ERROR;

    try {
      if (exception instanceof HttpException) {
        status = exception.getStatus();
        code = status;
        const res = exception.getResponse();
        if (typeof res === 'string') {
          message = res;
        } else if (res && typeof res === 'object' && 'message' in res) {
          const raw = (res as { message: unknown }).message;
          message = Array.isArray(raw) ? raw.join('; ') : String(raw);
        } else {
          message = (exception as unknown as { message?: string }).message || message;
        }
      } else if (exception instanceof (Prisma.PrismaClientKnownRequestError as unknown as typeof Error)) {
        const e = exception as any;
        status = HttpStatus.BAD_REQUEST;
        code = status;
        switch (e.code) {
          case 'P2002':
            message = `记录已存在（唯一约束冲突）: ${JSON.stringify(e.meta?.target ?? {})}`;
            break;
          case 'P2025':
            status = HttpStatus.NOT_FOUND;
            code = status;
            message = '目标记录不存在';
            break;
          case 'P2003':
            message = '外键约束失败，关联记录不存在';
            break;
          default:
            message = `数据库错误 [${e.code}]`;
        }
      } else if (exception instanceof (Prisma.PrismaClientValidationError as unknown as typeof Error)) {
        status = HttpStatus.BAD_REQUEST;
        code = status;
        message = '数据校验失败，请检查字段格式';
      } else if (
        exception &&
        typeof exception === 'object' &&
        'issues' in exception &&
        (exception as { name?: string }).name === 'ZodError'
      ) {
        status = HttpStatus.BAD_REQUEST;
        code = status;
        const issues = (exception as { issues: Array<{ message: string }> }).issues;
        message = issues.map((i) => i.message).join('; ');
      } else if (exception instanceof Error) {
        message = exception.message || message;
        this.logger.error(exception.stack || exception.message);
      } else {
        this.logger.error(`Unknown exception type: ${JSON.stringify(exception)}`);
      }
    } catch (e) {
      this.logger.error('Exception filter itself crashed', e as Error);
    }

    const body = {
      code,
      message,
      data: null,
      timestamp: new Date().toISOString(),
    };

    if (typeof httpAdapter.reply === 'function') {
      httpAdapter.reply(ctx.getResponse(), body, status);
    } else {
      const res = ctx.getResponse() as any;
      if (res && typeof res.status === 'function') {
        res.status(status).json(body);
      }
    }
  }
}
