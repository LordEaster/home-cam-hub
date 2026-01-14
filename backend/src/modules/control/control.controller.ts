import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ControlService } from './control.service';
import { PtzCommandDto } from './dto/ptz-command.dto';
import { CreatePresetDto } from './dto/create-preset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
}

@Controller('cameras/:cameraId')
@UseGuards(JwtAuthGuard)
export class ControlController {
  constructor(private readonly controlService: ControlService) {}

  @Post('ptz')
  async ptz(
    @Param('cameraId') cameraId: string,
    @Body() dto: PtzCommandDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.controlService.executePtz(cameraId, user.id, user.role, dto, ipAddress);
  }

  @Post('ptz/stop')
  async stopPtz(
    @Param('cameraId') cameraId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.controlService.stopPtz(cameraId, user.id, user.role);
  }

  @Get('presets')
  async listPresets(@Param('cameraId') cameraId: string) {
    return this.controlService.listPresets(cameraId);
  }

  @Post('presets')
  async createPreset(
    @Param('cameraId') cameraId: string,
    @Body() dto: CreatePresetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.controlService.createPreset(cameraId, user.id, user.role, dto);
  }

  @Post('presets/:presetId/goto')
  async goToPreset(
    @Param('cameraId') cameraId: string,
    @Param('presetId') presetId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.controlService.goToPreset(cameraId, presetId, user.id, user.role, ipAddress);
  }
}
