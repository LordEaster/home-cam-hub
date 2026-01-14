import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Logger, Query } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
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

@Controller('cameras')
@UseGuards(JwtAuthGuard)
export class CamerasController {
  private readonly logger = new Logger(CamerasController.name);

  constructor(
    private readonly camerasService: CamerasService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const cameras = await this.camerasService.findAll(user.id, user.role);
    this.logger.log(`API GET /cameras: Returning ${cameras.length} cameras for user ${user.username}`);
    return cameras;
  }

  @Get('discover')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async discover() {
    return this.camerasService.discover();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.camerasService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(@Body() dto: CreateCameraDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const camera = await this.camerasService.create(dto);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.auditService.log(
      user.id,
      camera.id,
      AuditAction.CAMERA_CREATE,
      { name: camera.name, ip: camera.ip },
      ipAddress,
      userAgent,
    );

    return camera;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateCameraDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const camera = await this.camerasService.update(id, dto);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.auditService.log(
      user.id,
      camera.id,
      AuditAction.CAMERA_UPDATE,
      dto as any,
      ipAddress,
      userAgent,
    );

    return camera;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    // Log audit BEFORE delete (while camera still exists)
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Get camera info for audit before deletion
    const camera = await this.camerasService.findOne(id);

    await this.auditService.log(
      user.id,
      id,
      AuditAction.CAMERA_DELETE,
      { name: camera.name, ip: camera.ip },
      ipAddress,
      userAgent,
    );

    await this.camerasService.delete(id);

    return { message: 'Camera deleted successfully' };
  }

  @Get(':id/stream')
  @UseGuards(JwtAuthGuard)
  async getStreamUrl(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('quality') quality: 'hd' | 'sd' = 'hd',
  ) {
    return this.camerasService.getStreamUrl(id, user.id, user.role, quality);
  }

  @Post(':id/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async testConnection(@Param('id') id: string) {
    return this.camerasService.testConnection(id);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reorder(
    @Body() body: { cameraIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.camerasService.reorderCameras(body.cameraIds);
    
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await this.auditService.log(
      user.id,
      null,
      AuditAction.CAMERA_UPDATE,
      { action: 'reorder', cameraIds: body.cameraIds },
      ipAddress,
      userAgent,
    );

    return { message: 'Cameras reordered successfully' };
  }
}
