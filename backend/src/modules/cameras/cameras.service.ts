import { Injectable, NotFoundException, ConflictException, BadRequestException, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnvifService } from './onvif.service';
import { TapoService } from './tapo.service';
import { MediaMtxService } from './mediamtx.service';
import { FfmpegService } from './ffmpeg.service';
import { EventsGateway } from '../gateway/gateway.gateway';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { Camera, CameraType, UserRole } from '@prisma/client';

interface CameraWithStreamUrl extends Camera {
  streamUrl?: string;
}

export interface DiscoveredCamera {
  ip: string;
  name: string;
  manufacturer: string;
  model: string;
  hasOnvif: boolean;
}

@Injectable()
export class CamerasService implements OnModuleInit {
  private readonly logger = new Logger(CamerasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly onvifService: OnvifService,
    private readonly tapoService: TapoService,
    private readonly mediaMtxService: MediaMtxService,
    private readonly ffmpegService: FfmpegService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  async onModuleInit() {
    await this.syncCamerasToMediaMtx();
  }

  /**
   * Sync all cameras from database to MediaMTX on startup
   */
  private async syncCamerasToMediaMtx(): Promise<void> {
    this.logger.log('Syncing cameras to MediaMTX...');
    
    try {
      const cameras = await this.prisma.camera.findMany({});

      this.logger.log(`Found ${cameras.length} cameras to sync`);

      for (const camera of cameras) {
        // Sync Main Stream
        if (camera.rtspMainStream) {
          try {
            const shouldRecord = camera.recordingMode !== 'OFF' && camera.isRecording;
            await this.mediaMtxService.addPath(camera.id, camera.rtspMainStream, shouldRecord);
            // Start Standalone FFmpeg transcoding for main stream
            await this.ffmpegService.startTranscoding(camera.id, camera.id);
            this.logger.log(`Synced camera main stream: ${camera.name} (${camera.id}) - Recording: ${shouldRecord}`);
          } catch (error) {
            this.logger.warn(`Failed to sync camera ${camera.name}: ${error.message}`);
          }
        } else {
          this.logger.warn(`Skipping camera ${camera.name} (${camera.id}): No RTSP stream configured`);
        }

        // Sync Sub Stream (if available)
        if (camera.rtspSubStream) {
          try {
            // Never record sub-stream, only main stream (as requested)
            const shouldRecordSub = false; 
            const subPath = `${camera.id}_sub`;
            await this.mediaMtxService.addPath(subPath, camera.rtspSubStream, shouldRecordSub);
            // Start Standalone FFmpeg transcoding for sub stream
            await this.ffmpegService.startTranscoding(camera.id, subPath);
            this.logger.log(`Synced camera sub stream: ${camera.name} (${camera.id}) - Recording: ${shouldRecordSub}`);
          } catch (error) {
            this.logger.warn(`Failed to sync camera sub stream ${camera.name}: ${error.message}`);
          }
        }
      }

      this.logger.log('Camera sync to MediaMTX completed');
    } catch (error) {
      this.logger.error(`Failed to sync cameras to MediaMTX: ${error.message}`);
    }
  }

  async findAll(userId: string, userRole: string): Promise<Camera[]> {
    // Admin sees all cameras
    if (userRole === UserRole.ADMIN) {
      return this.prisma.camera.findMany({
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      });
    }

    // Regular users only see cameras they have permission to view
    const permissions = await this.prisma.permission.findMany({
      where: {
        userId,
        canViewLive: true,
      },
      select: { cameraId: true },
    });

    const cameraIds = permissions.map((p) => p.cameraId);

    return this.prisma.camera.findMany({
      where: { id: { in: cameraIds } },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string): Promise<Camera> {
    const camera = await this.prisma.camera.findUnique({
      where: { id },
    });

    if (!camera) {
      throw new NotFoundException('Camera not found');
    }

    return camera;
  }

  async create(dto: CreateCameraDto): Promise<Camera> {
    // For Tapo cameras, model (device_type) is required
    if (dto.type === CameraType.TAPO && !dto.model) {
      throw new BadRequestException('Model (device type like C200, C210) is required for TAPO cameras');
    }

    // For Tapo cameras, port is optional (uses default internally)
    const port = dto.type === CameraType.TAPO ? null : (dto.port || 554);

    // Check for duplicate IP (for ONVIF with port, or any Tapo)
    if (dto.type === CameraType.ONVIF && port) {
      const existing = await this.prisma.camera.findFirst({
        where: { ip: dto.ip, port },
      });
      if (existing) {
        throw new ConflictException('Camera with this IP and port already exists');
      }
    } else {
      const existing = await this.prisma.camera.findFirst({
        where: { ip: dto.ip, type: CameraType.TAPO },
      });
      if (existing) {
        throw new ConflictException('Tapo camera with this IP already exists');
      }
    }

    // Get RTSP stream URLs based on camera type
    let rtspMainStream: string | null = null;
    let rtspSubStream: string | null = null;

    if (dto.type === CameraType.TAPO) {
      const streamInfo = this.tapoService.getStreamUrl(dto.ip);
      rtspMainStream = streamInfo.mainStream;
      rtspSubStream = streamInfo.subStream;
    } else if (dto.type === CameraType.ONVIF) {
      const streamInfo = await this.onvifService.getStreamUrls(
        dto.ip,
        port as number,
        dto.username || 'admin',
        dto.password || '',
      );
      rtspMainStream = streamInfo.mainStream;
      rtspSubStream = streamInfo.subStream;
    } else if (dto.type === CameraType.GENERIC) {
      // Use manually provided streams
      rtspMainStream = dto.rtspMainStream || null;
      rtspSubStream = dto.rtspSubStream || null;
      
      if (!rtspMainStream) {
        throw new BadRequestException('Main Stream RTSP URL is required for Generic cameras');
      }
    }

    const camera = await this.prisma.camera.create({
      data: {
        name: dto.name,
        type: dto.type,
        model: dto.model,
        ip: dto.ip,
        port,
        username: dto.username,
        password: dto.password,
        rtspMainStream,
        rtspSubStream,
        hasPtz: dto.hasPtz ?? false,
        hasAudio: dto.hasAudio ?? false,
        hasPresets: dto.hasPresets ?? false,
        recordingMode: dto.recordingMode,
        isRecording: dto.isRecording ?? true,
      },
    });

    // Register stream with MediaMTX and start transcoding
    const shouldRecord = camera.recordingMode !== 'OFF' && camera.isRecording;
    if (rtspMainStream) {
      await this.mediaMtxService.addPath(camera.id, rtspMainStream, shouldRecord);
      // Start Standalone FFmpeg transcoding for main stream
      await this.ffmpegService.startTranscoding(camera.id, camera.id);
    }
    if (rtspSubStream) {
      // Sub-stream never records
      await this.mediaMtxService.addPath(`${camera.id}_sub`, rtspSubStream, false);
      // Start Standalone FFmpeg transcoding for sub stream
      await this.ffmpegService.startTranscoding(camera.id, `${camera.id}_sub`);
    }

    return camera;
  }

  async update(id: string, dto: UpdateCameraDto): Promise<Camera> {
    const camera = await this.findOne(id);

    const updateData: Partial<Camera> = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.model) updateData.model = dto.model;
    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.password !== undefined) updateData.password = dto.password;
    if (dto.hasPtz !== undefined) updateData.hasPtz = dto.hasPtz;
    if (dto.hasAudio !== undefined) updateData.hasAudio = dto.hasAudio;
    if (dto.hasPresets !== undefined) updateData.hasPresets = dto.hasPresets;
    if (dto.recordingMode) updateData.recordingMode = dto.recordingMode;
    if (dto.isRecording !== undefined) updateData.isRecording = dto.isRecording;

    const updated = await this.prisma.camera.update({
      where: { id },
      data: updateData,
    });

    // Update MediaMTX recording settings if recording mode or status changed
    if (dto.recordingMode !== undefined || dto.isRecording !== undefined) {
      const shouldRecord = 
        (dto.recordingMode !== undefined ? dto.recordingMode : camera.recordingMode) !== 'OFF' &&
        (dto.isRecording !== undefined ? dto.isRecording : camera.isRecording);

      try {
        const aacPath = `${id}_aac`;
        
        // Ensure FFmpeg is running (idempotent)
        await this.ffmpegService.startTranscoding(id, id);
        
        if (shouldRecord) {
          await this.mediaMtxService.startRecording(aacPath);
          this.logger.log(`Started recording for camera ${id} (${updated.name})`);
        } else {
          await this.mediaMtxService.stopRecording(aacPath);
          this.logger.log(`Stopped recording for camera ${id} (${updated.name})`);
        }
      } catch (error) {
        this.logger.error(`Failed to update recording for camera ${id}`, error);
        // Don't fail the entire update if MediaMTX update fails
      }
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);

    // Remove from MediaMTX
    await this.mediaMtxService.removePath(id);

    await this.prisma.camera.delete({
      where: { id },
    });
  }

  async discover(): Promise<DiscoveredCamera[]> {
    return this.onvifService.discoverCameras();
  }

  async getStreamUrl(id: string, userId: string, userRole: string, quality: 'hd' | 'sd' = 'hd'): Promise<{ hlsUrl: string }> {
    const camera = await this.findOne(id);

    // Check permission (unless admin)
    if (userRole !== UserRole.ADMIN) {
      const permission = await this.prisma.permission.findUnique({
        where: {
          userId_cameraId: { userId, cameraId: id },
        },
      });

      if (!permission?.canViewLive) {
        throw new NotFoundException('Camera not found or access denied');
      }
    }

    // Determine which stream to use
    const useSubStream = quality === 'sd' && !!camera.rtspSubStream;
    const streamPath = useSubStream ? `${id}_sub` : id;
    const rtspUrl = useSubStream ? camera.rtspSubStream : camera.rtspMainStream;

    if (!rtspUrl) {
      this.logger.warn(`Camera ${id} (${quality}) requested but has no RTSP stream configured`);
      throw new BadRequestException('Camera has no stream URL configured');
    }

    // Self-healing: Ensure path CONFIGURATION exists in MediaMTX.
    // PREVIOUS BUG: We checked `isPathActive` (aka is Ready). If camera was connecting (Ready=False),
    // we would call `addPath` again, which resets the connection, causing an infinite "Connecting..." loop.
    // FIX: Check if the path is CONFIGURED. If yes, leave it alone and let it connect.
    
    // Check if Main Path exists in config
    const isMainConfigured = await this.mediaMtxService.isPathConfigured(streamPath);
    
    if (!isMainConfigured) {
      this.logger.log(`Stream path '${streamPath}' for camera ${id} missing config. registering...`);
      try {
        // Only record on main stream (quality != 'sd' or !useSubStream)
        const shouldRecord = !useSubStream && camera.recordingMode !== 'OFF' && camera.isRecording;
        await this.mediaMtxService.addPath(streamPath, rtspUrl, shouldRecord);
      } catch (e) {
        this.logger.error(`Failed to register stream path for ${id}`, e);
      }
    } else {
        // Config exists. Do nothing.
        // We assume that if it's configured, it will eventually connect.
        // We also assume recording settings are correct (unless we want to force-update them, 
        // but that requires reading the config first to compare, which is overkill for now).
        // If the user Toggles recording, that calls a separate method (updateCamera) which should update the path.
    }

    // Return HLS URL from MediaMTX (which now points to _aac path)
    const hlsUrl = await this.mediaMtxService.getHlsUrl(streamPath);
    return { hlsUrl };
  }

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await this.prisma.camera.update({
      where: { id },
      data: {
        isOnline,
        lastSeenAt: isOnline ? new Date() : undefined,
      },
    });

    // Emit WebSocket event for real-time status update
    this.eventsGateway.emitCameraStatus({
      cameraId: id,
      status: isOnline ? 'online' : 'offline',
      timestamp: new Date(),
    });
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const camera = await this.findOne(id);

    try {
      if (camera.type === CameraType.TAPO) {
        const result = await this.tapoService.testConnection(camera.ip);
        if (!result.success) {
          throw new Error(result.message);
        }
      } else {
        await this.onvifService.testConnection(
          camera.ip,
          camera.port || 554,
          camera.username || 'admin',
          camera.password || '',
        );
      }

      await this.updateOnlineStatus(id, true);
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      return { success: false, message };
    }
  }

  async reorderCameras(cameraIds: string[]): Promise<void> {
    // Update sortOrder for each camera based on its position in the array
    const updates = cameraIds.map((id, index) =>
      this.prisma.camera.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    );

    await this.prisma.$transaction(updates);
  }
}
