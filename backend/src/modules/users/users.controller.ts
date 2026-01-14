import { Controller, Get, Post, Patch, Delete, Put, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';
import { Request } from 'express';
import { Req } from '@nestjs/common';

interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @Roles('ADMIN')
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateUserDto, @CurrentUser() currentUser: AuthenticatedUser, @Req() req: Request) {
    const user = await this.usersService.create(dto);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.auditService.log(
      currentUser.id,
      null,
      AuditAction.USER_CREATE,
      { userId: user.id, username: user.username, role: user.role },
      ipAddress,
      userAgent,
    );
    return user;
  }

  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.usersService.changePassword(user.id, dto);
    
    // Log audit event
    // Note: We don't log the password itself
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.auditService.log(
      user.id,
      null,
      AuditAction.USER_UPDATE,
      { action: 'change_password', userId: user.id },
      ipAddress,
      userAgent,
    );

    return { message: 'Password changed successfully' };
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request
  ) {
    const updatedUser = await this.usersService.update(id, dto, user.id);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.auditService.log(
      user.id,
      null,
      AuditAction.USER_UPDATE,
      { targetUserId: id, updates: dto as any },
      ipAddress,
      userAgent,
    );
    return updatedUser;
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.usersService.delete(id, user.id);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.auditService.log(
      user.id,
      null,
      AuditAction.USER_DELETE,
      { targetUserId: id },
      ipAddress,
      userAgent,
    );
    return { message: 'User deleted successfully' };
  }

  @Get(':id/permissions')
  @Roles('ADMIN')
  async getPermissions(@Param('id') id: string) {
    return this.usersService.getPermissions(id);
  }

  @Put(':id/permissions')
  @Roles('ADMIN')
  async setPermissions(@Param('id') id: string, @Body() dto: SetPermissionsDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const result = await this.usersService.setPermissions(id, dto);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.auditService.log(
      user.id,
      null,
      AuditAction.PERMISSION_UPDATE,
      { targetUserId: id, permissions: dto.permissions as any },
      ipAddress,
      userAgent,
    );
    return result;
  }
}
