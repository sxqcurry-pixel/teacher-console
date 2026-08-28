import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AIChatService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import type { AIChatOption, AIChatRequest } from '@shared/dto';

@ApiTags('AI')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AIChatController {
  constructor(private readonly ai: AIChatService) {}

  @Get('options')
  options(): Promise<AIChatOption[]> {
    return this.ai.optionTemplates();
  }

  @Post('chat')
  chat(
    @Body() req: AIChatRequest,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<{ content: string }> {
    return this.ai.chat(u.id, req);
  }

  /**
   * Streaming chat via chunked text/event-stream.
   * Browser reads with `fetch` + `ReadableStream` reader (EventSource cannot
   * send Authorization header / POST body, so we use fetch instead).
   * Each line: `data: <json|"[DONE]">\n\n`.
   */
  @Post('chat/stream')
  async stream(
    @Body() req: AIChatRequest,
    @CurrentUser() u: CurrentUserPayload,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // flush headers so client starts receiving immediately
    res.flushHeaders?.();

    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      for await (const chunk of this.ai.chatStream(u.id, req)) {
        send({ content: chunk });
      }
      send('[DONE]');
    } catch (e) {
      send({ error: (e as Error).message });
    } finally {
      res.end();
    }
  }
}
