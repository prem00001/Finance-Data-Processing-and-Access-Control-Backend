import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, roleHasPermission } from '../permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user?.sub) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Authentication required.',
        },
      });
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { status: true, role: true },
    });

    if (!dbUser || dbUser.status === UserStatus.INACTIVE) {
      throw new ForbiddenException({
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'This account is inactive or no longer exists.',
        },
      });
    }

    const allowed = required.every((p) => roleHasPermission(dbUser.role, p));
    if (!allowed) {
      throw new ForbiddenException({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to perform this action.',
          details: { required },
        },
      });
    }

    return true;
  }
}
