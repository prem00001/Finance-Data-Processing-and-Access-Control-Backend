import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@Controller('dashboard')
@UseGuards(PermissionsGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermissions(Permission.DashboardRead)
  @ApiOperation({
    summary: 'Aggregated dashboard: totals, categories, trends, recent activity.',
  })
  summary(@Query() query: DashboardQueryDto) {
    return this.dashboard.getSummary(query);
  }
}
