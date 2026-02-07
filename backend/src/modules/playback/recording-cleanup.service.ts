import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as dayjs from 'dayjs';

@Injectable()
export class RecordingCleanupService {
  private readonly logger = new Logger(RecordingCleanupService.name);
  private readonly recordingsPath: string;
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.recordingsPath = this.configService.get<string>('RECORDINGS_PATH', '/recordings');
    this.retentionDays = this.configService.get<number>('RECORDING_RETENTION_DAYS', 14);
  }

  /**
   * Scheduled cleanup job - runs every day at 2:00 AM
   * Deletes recordings older than the retention period (default 14 days)
   */
  @Cron('0 2 * * *') // Every day at 2:00 AM
  async cleanupOldRecordings(): Promise<void> {
    this.logger.log(`Starting scheduled cleanup of recordings older than ${this.retentionDays} days...`);
    
    const cutoffDate = dayjs().subtract(this.retentionDays, 'day').toDate();
    let deletedFilesCount = 0;
    let deletedDbRecordsCount = 0;
    let freedBytes = 0;

    try {
      // 1. Find old recordings in database
      const oldRecordings = await this.prisma.recording.findMany({
        where: {
          startTime: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Found ${oldRecordings.length} recordings to clean up`);

      // 2. Delete files and database records
      for (const recording of oldRecordings) {
        try {
          const filePath = path.join(this.recordingsPath, recording.filePath);
          
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            freedBytes += stats.size;
            
            fs.unlinkSync(filePath);
            deletedFilesCount++;
          }

          // Delete database record
          await this.prisma.recording.delete({
            where: { id: recording.id },
          });
          deletedDbRecordsCount++;
        } catch (error) {
          this.logger.warn(`Failed to delete recording ${recording.id}: ${error.message}`);
        }
      }

      // 3. Clean up empty directories
      await this.cleanupEmptyDirectories();

      const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
      this.logger.log(`Cleanup completed: ${deletedFilesCount} files deleted, ${deletedDbRecordsCount} DB records removed, ${freedMB} MB freed`);
    } catch (error) {
      this.logger.error(`Cleanup job failed: ${error.message}`);
    }
  }

  /**
   * Clean up empty directories left after file deletion
   * Removes empty day, month, and year folders
   */
  private async cleanupEmptyDirectories(): Promise<void> {
    try {
      const cameraFolders = await fs.promises.readdir(this.recordingsPath);

      for (const cameraFolder of cameraFolders) {
        const cameraPath = path.join(this.recordingsPath, cameraFolder);
        const cameraStat = await fs.promises.stat(cameraPath);
        
        if (!cameraStat.isDirectory()) continue;

        await this.removeEmptyDirsRecursively(cameraPath);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup empty directories: ${error.message}`);
    }
  }

  /**
   * Recursively remove empty directories
   */
  private async removeEmptyDirsRecursively(dirPath: string): Promise<boolean> {
    try {
      const entries = await fs.promises.readdir(dirPath);

      // First, recurse into subdirectories
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const stat = await fs.promises.stat(entryPath);
        
        if (stat.isDirectory()) {
          await this.removeEmptyDirsRecursively(entryPath);
        }
      }

      // Re-check if directory is now empty
      const remainingEntries = await fs.promises.readdir(dirPath);
      
      if (remainingEntries.length === 0) {
        await fs.promises.rmdir(dirPath);
        this.logger.debug(`Removed empty directory: ${dirPath}`);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}
