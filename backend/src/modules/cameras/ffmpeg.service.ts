import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn } from 'child_process';
import { join } from 'path';

interface FFmpegProcess {
  process: ChildProcess;
  cameraId: string;
  pathName: string;
  restartCount: number;
  lastRestart: number;
  isStopping: boolean;
}

@Injectable()
export class FfmpegService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FfmpegService.name);
  private processes: Map<string, FFmpegProcess> = new Map();
  private readonly RESTART_DELAY = 1000; // 1 second (was 5000)
  private readonly MAX_RESTARTS_PER_MINUTE = 5;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.logger.log('FFmpeg Service initialized');
  }

  onModuleDestroy() {
    this.stopAllProcesses();
  }

  /**
   * Start FFmpeg transcoding process for a camera
   * Reads from MediaMTX (RTSP) and publishes back to MediaMTX (RTSP to AAC path)
   */
  async startTranscoding(cameraId: string, pathName: string): Promise<void> {
    if (this.processes.has(pathName) && !this.processes.get(pathName)?.isStopping) {
      this.logger.debug(`FFmpeg process for ${pathName} already running`);
      return;
    }

    const mediamtxHost = this.configService.get<string>('MEDIAMTX_HOST', 'mediamtx');
    const mediamtxPort = this.configService.get<string>('MEDIAMTX_RTSP_PORT', '8554');
    
    // RTSP URLs
    // Source: Main stream from MediaMTX
    const inputUrl = `rtsp://${mediamtxHost}:${mediamtxPort}/${pathName}`;
    // Destination: AAC stream back to MediaMTX
    const outputUrl = `rtsp://${mediamtxHost}:${mediamtxPort}/${pathName}_aac`;

    // FFmpeg arguments
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      // Timeout if RTSP stream hangs (5 seconds)
      '-timeout', '5000000',
      '-rtsp_transport', 'tcp',
      '-i', inputUrl,
      // Map first video and first audio stream explicitly
      // This prevents issues if camera sends multiple tracks or tracks change order
      '-map', '0:v:0?', // ? means optional (if no video, don't fail)
      '-map', '0:a:0?', // ? means optional (if no audio, don't fail immediately, though we expect it)
      '-c:v', 'copy',       // Copy video stream (no re-encoding)
      '-c:a', 'aac',        // Transcode audio to AAC
      '-b:a', '128k',       // Audio bitrate
      '-ar', '44100',       // Resample to 44.1kHz (standard for HLS/AAC compatibility)
      '-ac', '2',           // Force stereo to avoid channel issues
      '-f', 'rtsp',
      '-rtsp_transport', 'tcp',
      outputUrl
    ];

    this.logger.log(`Starting FFmpeg for ${pathName}`);
    
    // Spawn process
    const process = spawn('ffmpeg', args);
    const ffmpegProc: FFmpegProcess = {
      process,
      cameraId,
      pathName,
      restartCount: 0,
      lastRestart: Date.now(),
      isStopping: false
    };

    this.setupProcessListeners(ffmpegProc);
    this.processes.set(pathName, ffmpegProc);
  }

  /**
   * Stop transcoding for a specific path
   */
  stopTranscoding(pathName: string): void {
    const processInfo = this.processes.get(pathName);
    if (processInfo && !processInfo.isStopping) {
      this.logger.log(`Stopping FFmpeg for ${pathName}`);
      processInfo.isStopping = true;
      processInfo.process.kill('SIGTERM');
      
      // Force kill after timeout
      setTimeout(() => {
        if (this.processes.has(pathName)) {
           try {
             processInfo.process.kill('SIGKILL'); 
           } catch (e) {}
           this.processes.delete(pathName);
        }
      }, 5000);
    }
  }

  private stopAllProcesses() {
    this.processes.forEach((proc, pathName) => {
      this.stopTranscoding(pathName);
    });
  }

  private setupProcessListeners(procInfo: FFmpegProcess) {
    const { process, pathName } = procInfo;

    process.stdout?.on('data', (data) => {
      // this.logger.debug(`[FFmpeg ${pathName}] ${data}`);
    });

    process.stderr?.on('data', (data) => {
       // Filter out common harmless warnings if needed
       const msg = data.toString();
       if (!msg.includes('frame=') && !msg.includes('fps=')) {
         this.logger.warn(`[FFmpeg ${pathName}] ${msg}`);
       }
    });

    process.on('close', (code) => {
      if (procInfo.isStopping) {
        this.logger.log(`FFmpeg process for ${pathName} stopped gracefully`);
        this.processes.delete(pathName);
        return;
      }

      this.logger.warn(`FFmpeg process for ${pathName} exited unexpectedly with code ${code}`);
      this.handleRestart(procInfo);
    });

    process.on('error', (err) => {
      this.logger.error(`FFmpeg process error for ${pathName}: ${err.message}`);
    });
  }

  private handleRestart(procInfo: FFmpegProcess) {
    if (procInfo.isStopping) return;

    // Reset restart count if last restart was a while ago
    if (Date.now() - procInfo.lastRestart > 60000) {
      procInfo.restartCount = 0;
    }

    procInfo.restartCount++;

    if (procInfo.restartCount <= this.MAX_RESTARTS_PER_MINUTE) {
      this.logger.log(`Restarting FFmpeg for ${procInfo.pathName} in ${this.RESTART_DELAY}ms... (Attempt ${procInfo.restartCount})`);
      setTimeout(() => {
        if (!procInfo.isStopping) {
          // Remove old process object -> logic in startTranscoding will create new one
          this.processes.delete(procInfo.pathName);
          this.startTranscoding(procInfo.cameraId, procInfo.pathName).catch(err => 
            this.logger.error(`Failed to restart FFmpeg for ${procInfo.pathName}`, err)
          );
        }
      }, this.RESTART_DELAY);
    } else {
      this.logger.warn(`Too many FFmpeg restarts for ${procInfo.pathName}. Cooling down for 60 seconds...`);
      
      // Infinite Retry Strategy:
      // Instead of giving up, we wait 60 seconds and then try again.
      // This ensures 24/7 operation even if camera is offline for hours.
      setTimeout(() => {
        if (!procInfo.isStopping) {
          procInfo.restartCount = 0; // Reset counter
          this.logger.log(`Cool down finished for ${procInfo.pathName}. Resuming restart attempts.`);
          
          this.processes.delete(procInfo.pathName);
          this.startTranscoding(procInfo.cameraId, procInfo.pathName).catch(err => 
            this.logger.error(`Failed to resume FFmpeg for ${procInfo.pathName}`, err)
          );
        }
      }, 60000); // Wait 1 minute
    }
  }
}
