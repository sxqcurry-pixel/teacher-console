import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { UserDto } from '@shared/dto';

class UpdateProfileDto {
  @IsString() @IsOptional() @MaxLength(50) name?: string;
  @IsOptional() avatar?: string | null;
}

@ApiTags('User')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get('profile')
  profile(@CurrentUser() u: CurrentUserPayload): Promise<UserDto> {
    return this.users.findById(u.id);
  }

  @Patch('profile')
  update(@CurrentUser() u: CurrentUserPayload, @Body() dto: UpdateProfileDto): Promise<UserDto> {
    return this.users.updateProfile(u.id, dto);
  }
}
