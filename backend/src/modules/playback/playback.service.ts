import { Injectable, NotFoundException, ForbiddenException, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../gateway/gateway.gateway';
import { UserRole, AuditAction, Recording, Prisma } from '@prisma/client';

export interface TimelineEntry {
  startTime: string;
  endTime: string;
  hasMotion: boolean;
}

export interface RecordingWithCamera extends Recording {
  camera: {
    id: string;
    name: string;
  };
}

@Injectable()
export class PlaybackService implements OnModuleInit {
  private readonly logger = new Logger(PlaybackService.name);
  private readonly recordingsPath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {
    this.recordingsPath = this.configService.get<string>('RECORDINGS_PATH', '/recordings');
  }

  async findRecordings(
    userId: string,
    userRole: string,
    cameraId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<RecordingWithCamera[]> {
    // Get cameras the user can playback
    let allowedCameraIds: string[] = [];

    if (userRole === UserRole.ADMIN) {
      if (cameraId) {
        allowedCameraIds = [cameraId];
      } else {
        const cameras = await this.prisma.camera.findMany({ select: { id: true } });
        allowedCameraIds = cameras.map((c) => c.id);
      }
    } else {
      const permissions = await this.prisma.permission.findMany({
        where: {
          userId,
          canPlayback: true,
          ...(cameraId ? { cameraId } : {}),
        },
        select: { cameraId: true },
      });
      allowedCameraIds = permissions.map((p) => p.cameraId);
    }

    if (allowedCameraIds.length === 0) {
      return [];
    }

    const whereClause: Prisma.RecordingWhereInput = {
      cameraId: { in: allowedCameraIds },
    };

    if (startDate) {
      whereClause.startTime = { gte: dayjs(startDate).toDate() };
    }

    if (endDate) {
      whereClause.endTime = { lte: dayjs(endDate).toDate() };
    }

    const recordings = await this.prisma.recording.findMany({
      where: whereClause,
      include: {
        camera: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startTime: 'desc' },
      take: 100,
    });

    return recordings;
  }

  async getTimeline(
    userId: string,
    userRole: string,
    cameraId: string,
    date: string,
  ): Promise<TimelineEntry[]> {
    await this.checkPlaybackPermission(userId, userRole, cameraId);

    const startOfDay = dayjs(date).startOf('day').toDate();
    const endOfDay = dayjs(date).endOf('day').toDate();

    const recordings = await this.prisma.recording.findMany({
      where: {
        cameraId,
        startTime: { gte: startOfDay },
        endTime: { lte: endOfDay },
      },
      orderBy: { startTime: 'asc' },
    });

    return recordings.map((r) => ({
      startTime: r.startTime.toISOString(),
      endTime: r.endTime?.toISOString() || dayjs().toISOString(),
      hasMotion: r.hasMotion,
    }));
  }

  async getStreamUrl(
    recordingId: string,
    userId: string,
    userRole: string,
    ipAddress: string,
  ): Promise<{ url: string }> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    await this.checkPlaybackPermission(userId, userRole, recording.cameraId);

    // Log playback action
    await this.logAuditEvent(userId, recording.cameraId, AuditAction.PLAYBACK, { recordingId }, ipAddress);

    // Return the file path as a stream URL
    // In production, this would be served through nginx or a dedicated streaming endpoint
    // Return url to controller endpoint that serves the file
    return { url: `/api/recordings/${recordingId}/stream` };
  }

  async exportClip(
    userId: string,
    userRole: string,
    cameraId: string,
    startTime: string,
    endTime: string,
    ipAddress: string,
  ): Promise<{ jobId: string; status: string }> {
    await this.checkExportPermission(userId, userRole, cameraId);

    // Log export action
    await this.logAuditEvent(
      userId,
      cameraId,
      AuditAction.EXPORT_CLIP,
      { startTime, endTime },
      ipAddress,
    );

    // In a real implementation, this would queue an FFmpeg job
    // For now, return a mock job ID
    const jobId = `export_${Date.now()}`;

    return { jobId, status: 'queued' };
  }

  private async checkPlaybackPermission(userId: string, userRole: string, cameraId: string): Promise<void> {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    const permission = await this.prisma.permission.findUnique({
      where: {
        userId_cameraId: { userId, cameraId },
      },
    });

    if (!permission?.canPlayback) {
      throw new ForbiddenException('You do not have playback permission for this camera');
    }
  }

  private async checkExportPermission(userId: string, userRole: string, cameraId: string): Promise<void> {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    const permission = await this.prisma.permission.findUnique({
      where: {
        userId_cameraId: { userId, cameraId },
      },
    });

    if (!permission?.canExport) {
      throw new ForbiddenException('You do not have export permission for this camera');
    }
  }

  async onModuleInit() {
    this.syncRecordings(); // Run immediately on startup
    // Schedule sync every 1 minute
    setInterval(() => {
      this.syncRecordings();
    }, 60000);
  }

  private async syncRecordings() {
    this.logger.log('Syncing recordings from disk...');
    try {
      const cameras = await this.prisma.camera.findMany();
      
      for (const camera of cameras) {
        // Recordings are now stored in: /{camera_id}_aac/{YYYY}/{MM}/{DD}/*.mp4
        const cameraDir = path.join(this.recordingsPath, `${camera.id}_aac`);
        
        if (!fs.existsSync(cameraDir)) {
          continue;
        }

        // Recursively scan year/month/day directories
        await this.scanRecordingsRecursively(camera.id, cameraDir, `${camera.id}_aac`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync recordings: ${error.message}`);
    }
  }

  /**
   * Recursively scan directory for MP4 recordings
   */
  private async scanRecordingsRecursively(
    cameraId: string,
    dirPath: string,
    relativePath: string
  ): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const entryRelativePath = `${relativePath}/${entry.name}`;

        if (entry.isDirectory()) {
          // Recurse into subdirectories (year/month/day)
          await this.scanRecordingsRecursively(cameraId, fullPath, entryRelativePath);
        } else if (entry.isFile() && entry.name.endsWith('.mp4')) {
          // Found an MP4 file - import it
          await this.importRecordingFile(cameraId, entry.name, entryRelativePath);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to scan directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Import a single recording file into the database
   */
  private async importRecordingFile(
    cameraId: string,
    fileName: string,
    filePath: string
  ): Promise<void> {
    // Format: YYYY-MM-DD_HH-MM-SS.mp4
    const basename = path.basename(fileName, '.mp4');
    const [datePart, timePart] = basename.split('_');
    if (!datePart || !timePart) return;

    const [hour, minute, second] = timePart.split('-');
    if (!hour || !minute || !second) return;

    const startTime = dayjs(`${datePart}T${hour}:${minute}:${second}`).toDate();
    const endTime = dayjs(startTime).add(5, 'minute').toDate(); // 5-minute segments

    // Check if exists
    const exists = await this.prisma.recording.findFirst({
      where: {
        cameraId,
        startTime,
      },
    });

    if (!exists) {
      const newRecording = await this.prisma.recording.create({
        data: {
          id: uuidv4(),
          cameraId,
          startTime,
          endTime,
          hasMotion: false,
          filePath,
        },
      });

      this.logger.debug(`Imported recording: ${fileName} for camera ${cameraId}`);

      // Emit WebSocket event for new recording
      this.eventsGateway.emitRecordingCompleted({
        recordingId: newRecording.id,
        cameraId,
        startedAt: startTime,
        endedAt: endTime,
        fileSize: 0,
        filePath: newRecording.filePath,
      });
    }
  }

  async getStreamFile(
    recordingId: string,
    userId: string,
    userRole: string,
    ipAddress: string,
    res: any
  ): Promise<void> {
    const recording = await this.prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording) throw new NotFoundException('Recording not found');

    await this.checkPlaybackPermission(userId, userRole, recording.cameraId);
    
    // Log playback audit
    await this.logAuditEvent(userId, recording.cameraId, AuditAction.PLAYBACK, { recordingId }, ipAddress);

    // Construct file path
    // We stored relative path in DB: camera_id/filename.mp4
    // But let's fallback to construction if filePath is missing (for older records if any)
    
    const relativePath = recording.filePath || `${recording.cameraId}/${dayjs(recording.startTime).format('YYYY-MM-DD_HH-mm-ss')}.mp4`;
    const fullPath = path.join(this.recordingsPath, relativePath);

    if (!fs.existsSync(fullPath)) {
        // Try fallback construction if stored path is wrong
       const fallbackPath = path.join(this.recordingsPath, recording.cameraId, `${dayjs(recording.startTime).format('YYYY-MM-DD_HH-mm-ss')}.mp4`);
       if (fs.existsSync(fallbackPath)) {
           res.sendFile(fallbackPath);
           return;
       }
       throw new NotFoundException('Recording file missing on disk');
    }
    
    res.sendFile(fullPath);
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
