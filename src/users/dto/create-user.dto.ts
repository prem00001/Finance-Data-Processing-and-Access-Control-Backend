import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'new.hire@zorvyn.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Welcome@993' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Jamie Smith' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ANALYST })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
