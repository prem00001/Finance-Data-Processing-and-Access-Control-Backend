import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/permissions';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current profile (any authenticated user).' })
  me(@CurrentUser() user: JwtPayload) {
    return this.users.findOne(user.sub);
  }

  @Get()
  @RequirePermissions(Permission.UsersRead)
  @ApiOperation({ summary: 'List all users (admin).' })
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.UsersRead)
  @ApiOperation({ summary: 'Get user by id (admin).' })
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.UsersManage)
  @ApiOperation({ summary: 'Create a user (admin).' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.UsersManage)
  @ApiOperation({ summary: 'Update a user (admin).' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}
