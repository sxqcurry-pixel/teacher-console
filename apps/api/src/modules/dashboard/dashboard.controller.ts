import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { DashboardStats, RecentActivity } from '@shared/dto';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  stats(@CurrentUser() u: CurrentUserPayload): Promise<DashboardStats> {
    return this.dashboard.getStats(u.id);
  }

  @Get('activity')
  activity(
    @CurrentUser() u: CurrentUserPayload,
    @Query('limit') limit?: string,
  ): Promise<RecentActivity[]> {
    return this.dashboard.recentActivity(u.id, limit ? Number(limit) : 10);
  }
}
