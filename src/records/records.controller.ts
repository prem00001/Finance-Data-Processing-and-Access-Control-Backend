import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreateRecordDto } from './dto/create-record.dto';
import { QueryRecordsDto } from './dto/query-records.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { RecordsService } from './records.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';

@ApiTags('Financial records')
@ApiBearerAuth('JWT')
@Controller('records')
@UseGuards(PermissionsGuard)
export class RecordsController {
  constructor(private records: RecordsService) {}

  @Get()
  @RequirePermissions(Permission.RecordsRead)
  @ApiOperation({ summary: 'List records with filters and pagination.' })
  findAll(@Query() query: QueryRecordsDto, @CurrentUser() user: JwtPayload) {
    return this.records.findMany(query, user.sub, user.role as UserRole);
  }

  @Get(':id')
  @RequirePermissions(Permission.RecordsRead)
  @ApiOperation({ summary: 'Get one record by id.' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.records.findOne(id, user.sub, user.role as UserRole);
  }

  @Post()
  @RequirePermissions(Permission.RecordsCreate)
  @ApiOperation({ summary: 'Create a financial record.' })
  create(@Body() dto: CreateRecordDto, @CurrentUser() user: JwtPayload) {
    return this.records.create(dto, user.sub, user.role as UserRole);
  }

  @Patch(':id')
  @RequirePermissions(Permission.RecordsUpdate)
  @ApiOperation({ summary: 'Update a financial record.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRecordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.records.update(id, dto, user.sub, user.role as UserRole);
  }

  @Delete(':id')
  @RequirePermissions(Permission.RecordsDelete)
  @ApiOperation({ summary: 'Soft-delete a financial record.' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.records.remove(id, user.sub, user.role as UserRole);
  }
}
