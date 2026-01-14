import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnvifService } from '../cameras/onvif.service';
import { TapoService } from '../cameras/tapo.service';
import { PtzCommandDto } from './dto/ptz-command.dto';
import { CreatePresetDto } from './dto/create-preset.dto';
import { CameraType, UserRole, AuditAction, Prisma } from '@prisma/client';

export interface PresetInfo {
  id: string;
  name: string;
  presetToken: string | null;
}

@Injectable()
export class ControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onvifService: OnvifService,
    private readonly tapoService: TapoService,
  ) {}

  async executePtz(
    cameraId: string,
    userId: string,
    userRole: string,
    dto: PtzCommandDto,
    ipAddress: string,
  ): Promise<{ success: boolean }> {
    const camera = await this.getCamera(cameraId);
    await this.checkControlPermission(userId, userRole, cameraId);

    if (!camera.hasPtz) {
      throw new ForbiddenException('Camera does not support PTZ');
    }

    if (camera.type === CameraType.TAPO) {
      await this.tapoService.movePtz(camera.ip, dto.pan, dto.tilt);
    } else {
      // ONVIF PTZ implementation will go here
      // Using onvif library's ptz.continuousMove
    }

    // Log action
    await this.logAuditEvent(userId, cameraId, AuditAction.PTZ_CONTROL, { pan: dto.pan, tilt: dto.tilt, zoom: dto.zoom }, ipAddress);

    return { success: true };
  }

  async stopPtz(cameraId: string, userId: string, userRole: string): Promise<{ success: boolean }> {
    const camera = await this.getCamera(cameraId);
    await this.checkControlPermission(userId, userRole, cameraId);

    // PTZ stop implementation
    // For ONVIF: ptz.stop

    return { success: true };
  }

  async listPresets(cameraId: string): Promise<PresetInfo[]> {
    await this.getCamera(cameraId);

    const presets = await this.prisma.cameraPreset.findMany({
      where: { cameraId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        presetToken: true,
      },
    });

    return presets;
  }

  async createPreset(
    cameraId: string,
    userId: string,
    userRole: string,
    dto: CreatePresetDto,
  ): Promise<PresetInfo> {
    const camera = await this.getCamera(cameraId);
    await this.checkControlPermission(userId, userRole, cameraId);

    if (!camera.hasPresets) {
      throw new ForbiddenException('Camera does not support presets');
    }

    const preset = await this.prisma.cameraPreset.create({
      data: {
        cameraId,
        name: dto.name,
        presetToken: dto.presetToken,
        pan: dto.pan,
        tilt: dto.tilt,
        zoom: dto.zoom,
      },
      select: {
        id: true,
        name: true,
        presetToken: true,
      },
    });

    return preset;
  }

  async goToPreset(
    cameraId: string,
    presetId: string,
    userId: string,
    userRole: string,
    ipAddress: string,
  ): Promise<{ success: boolean }> {
    const camera = await this.getCamera(cameraId);
    await this.checkControlPermission(userId, userRole, cameraId);

    const preset = await this.prisma.cameraPreset.findFirst({
      where: { id: presetId, cameraId },
    });

    if (!preset) {
      throw new NotFoundException('Preset not found');
    }

    if (camera.type === CameraType.TAPO) {
      await this.tapoService.goToPreset(camera.ip, presetId);
    } else {
      // ONVIF goto preset implementation
    }

    await this.logAuditEvent(userId, cameraId, AuditAction.PRESET_GOTO, { presetId, presetName: preset.name }, ipAddress);

    return { success: true };
  }

  private async getCamera(cameraId: string) {
    const camera = await this.prisma.camera.findUnique({
      where: { id: cameraId },
    });

    if (!camera) {
      throw new NotFoundException('Camera not found');
    }

    return camera;
  }

  private async checkControlPermission(userId: string, userRole: string, cameraId: string): Promise<void> {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    const permission = await this.prisma.permission.findUnique({
      where: {
        userId_cameraId: { userId, cameraId },
      },
    });

    if (!permission?.canControl) {
      throw new ForbiddenException('You do not have permission to control this camera');
    }
  }

  private async logAuditEvent(
    userId: string,
    cameraId: string,
    action: AuditAction,
    details: Prisma.InputJsonValue,
    ipAddress: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        cameraId,
        action,
        details,
        ipAddress,
      },
    });
  }
}
