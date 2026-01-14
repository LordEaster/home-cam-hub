import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaMtxService } from '../cameras/mediamtx.service';

@Injectable()
export class CameraHealthService {
  private readonly logger = new Logger(CameraHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaMtxService: MediaMtxService,
  ) {}

  /**
   * Check camera health every 30 seconds by verifying if MediaMTX stream is active
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkCameraHealth(): Promise<void> {
    try {
      const cameras = await this.prisma.camera.findMany();

      for (const camera of cameras) {
        if (!camera.rtspMainStream) {
          continue; // Skip cameras without RTSP stream
        }

        const isActive = await this.mediaMtxService.isPathActive(camera.id);
        
        // Update status if changed
        if (camera.isOnline !== isActive) {
          await this.prisma.camera.update({
            where: { id: camera.id },
            data: {
              isOnline: isActive,
              lastSeenAt: isActive ? new Date() : camera.lastSeenAt,
            },
          });

          this.logger.log(
            `Camera "${camera.name}" (${camera.id}) status changed: ${isActive ? 'ONLINE' : 'OFFLINE'}`
          );
        } else if (isActive) {
          // Update lastSeenAt even if status hasn't changed
          await this.prisma.camera.update({
            where: { id: camera.id },
            data: { lastSeenAt: new Date() },
          });
        }
      }
    } catch (error) {
      this.logger.error('Error checking camera health:', error);
    }
  }

  /**
   * Manual health check for a specific camera
   */
  async checkCameraStatus(cameraId: string): Promise<boolean> {
    try {
      const isActive = await this.mediaMtxService.isPathActive(cameraId);
      
      await this.prisma.camera.update({
        where: { id: cameraId },
        data: {
          isOnline: isActive,
          lastSeenAt: isActive ? new Date() : undefined,
        },
      });

      return isActive;
    } catch (error) {
      this.logger.error(`Error checking camera ${cameraId} status:`, error);
      return false;
    }
  }
}
