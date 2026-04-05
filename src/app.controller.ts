import { Controller, Get, HttpStatus, Redirect } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  /** Root URL has no SPA — send people straight to the interactive API page. */
  @Public()
  @Get()
  @Redirect('/docs', HttpStatus.FOUND)
  @ApiExcludeEndpoint()
  redirectToDocs() {
    return;
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness check (no auth).' })
  health() {
    return {
      status: 'ok',
      service: 'zorvyn-financial-backend',
      version: 'Updated V0.9',
      timestamp: new Date().toISOString(),
    };
  }
}
