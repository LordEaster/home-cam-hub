import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

interface MediaMtxPath {
  name: string;
  source?: {
    type: string;
    id: string;
  };
  ready: boolean;
  tracks?: string[];
  bytesReceived?: number;
  bytesSent?: number;
}

interface MediaMtxPathListResponse {
  items: MediaMtxPath[];
}

interface MediaMtxPathConfigAdd {
  name?: string;
  source?: string;
  sourceProtocol?: string;
  record?: boolean;
  recordPath?: string;
  runOnDemand?: string;
  runOnDemandRestart?: boolean;
  runOnDemandStartTimeout?: string;
  runOnDemandCloseAfter?: string;
  runOnInit?: string;
  runOnInitRestart?: boolean;
  runOnReady?: string;
  runOnReadyRestart?: boolean;
  sourceOnDemand?: boolean;
  recordSegmentDuration?: string;
  recordDeleteAfter?: string;
}

@Injectable()
export class MediaMtxService {
  private readonly logger = new Logger(MediaMtxService.name);
  private readonly mediamtxApiUrl: string;
  private readonly mediamtxHlsUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.mediamtxApiUrl = this.configService.get<string>('MEDIAMTX_API_URL', 'http://mediamtx:9997');
    this.mediamtxHlsUrl = this.configService.get<string>('MEDIAMTX_HLS_URL', 'http://mediamtx:8888');
  }

  private async postConfig(pathName: string, config: MediaMtxPathConfigAdd): Promise<void> {
    try {
      // First, try to GET existing config to check if update is needed
      let existingConfig: any = null;
      try {
        const getResponse = await firstValueFrom(
          this.httpService.get(`${this.mediamtxApiUrl}/v3/config/paths/get/${pathName}`)
        );
        existingConfig = getResponse.data;
      } catch (e: any) {
        // Path doesn't exist, will create new
      }

      // Compare configs - only update if different to prevent FFmpeg restart
      if (existingConfig && this.configsAreEqual(existingConfig, config)) {
        this.logger.debug(`Config for ${pathName} unchanged, skipping update`);
        return;
      }

      await firstValueFrom(
        this.httpService.post(`${this.mediamtxApiUrl}/v3/config/paths/add/${pathName}`, config)
      );
      this.logger.log(`Added MediaMTX path: ${pathName}`);
    } catch (error: any) {
      if (error?.response?.status === 400) {
        // Log the detailed error from MediaMTX to understand WHY it failed
        const errorData = JSON.stringify(error?.response?.data || {});
        this.logger.warn(`Failed to add path ${pathName} (400 Bad Request). Response: ${errorData}. Attempting PATCH...`);

        try {
          await firstValueFrom(
            this.httpService.patch(`${this.mediamtxApiUrl}/v3/config/paths/patch/${pathName}`, config)
          );
          this.logger.log(`Updated MediaMTX path: ${pathName}`);
        } catch (patchError: any) {
             const patchErrorData = JSON.stringify(patchError?.response?.data || {});
             this.logger.error(`Failed to update MediaMTX path: ${pathName}. Response: ${patchErrorData}`, patchError);
        }
      } else {
        const status = error?.response?.status;
        const data = JSON.stringify(error?.response?.data || {});
        this.logger.error(`Failed to add MediaMTX path: ${pathName} (Status: ${status}). Response: ${data}`, error);
      }
    }
  }

  // Compare two configs to determine if they are functionally equal
  private configsAreEqual(existing: any, newConfig: MediaMtxPathConfigAdd): boolean {
    // Compare key fields that matter for streaming
    const keysToCompare: (keyof MediaMtxPathConfigAdd)[] = [
      'source', 'sourceOnDemand', 'sourceProtocol', 'record', 
      'runOnReady', 'runOnReadyRestart',
      'runOnDemand', 'runOnDemandRestart', 'runOnDemandStartTimeout', 'runOnDemandCloseAfter'
    ];

    for (const key of keysToCompare) {
      const existingValue = existing[key];
      const newValue = newConfig[key];
      
      // Both undefined/null = equal
      if ((existingValue === undefined || existingValue === null) && 
          (newValue === undefined || newValue === null)) {
        continue;
      }
      
      // One is defined, other is not = different
      if (existingValue !== newValue) {
        return false;
      }
    }

    return true;
  }

  async addPath(pathName: string, rtspSource: string, enableRecording: boolean = false): Promise<void> {
    const aacPathName = `${pathName}_aac`;
    
    // Note: We use 127.0.0.1:8554 to read from the Main Path internally
    const loopbackSource = `rtsp://127.0.0.1:8554/${pathName}`;
    const loopbackDest = `rtsp://127.0.0.1:8554/${aacPathName}`;

    // Debug logging for ffmpeg command
    const ffmpegCommand = `ffmpeg -hide_banner -loglevel error -rtsp_transport tcp -i ${loopbackSource} -c:v copy -c:a aac -b:a 128k -f rtsp -rtsp_transport tcp ${loopbackDest}`;
    this.logger.debug(`Registering AAC path ${aacPathName} with ffmpeg command: ${ffmpegCommand}`);

    // 1. Configure Main Path
    // Strategy depends on whether we are recording this stream:
    
    // CASE A: Recording Enabled (Main Stream)
    // - We need the stream to be ALWAYS ON (`sourceOnDemand: false`).
    // - We use `runOnReady` to start FFmpeg immediately when the camera connects.
    // - This "pushes" the stream to the AAC path.
    
    // CASE B: Recording Disabled (Sub Stream)
    // - We only want to stream when viewed to save resources (`sourceOnDemand: true`).
    // - We use `runOnDemand` on the AAC path to "pull" the stream.
    // - Main Path has NO commands, just provides the RTSP source.

    // 1. Configure Main Path
    const mainConfig: MediaMtxPathConfigAdd = {
      source: rtspSource,
      sourceProtocol: 'automatic',
      record: false, // We record the AAC path
      
      // Standalone FFmpeg Service Strategy:
      // - Main path just provides RTSP source
      // - Recording Enabled: sourceOnDemand=false (Always connected)
      // - Recording Disabled: sourceOnDemand=false (To ensure stream is ready for FFmpeg service)
      sourceOnDemand: false,
    };
    await this.postConfig(pathName, mainConfig);

    // 2. Configure AAC Path
    const aacConfig: MediaMtxPathConfigAdd = {
      source: 'publisher', // Will be published to by our backend FFmpeg process
      sourceOnDemand: false,
      
      // CLEAN CONFIG: No runOnReady/runOnDemand commands
      // The backend FfmpegService will spawn a process that pushes to this path
      
      // Recording Settings
      record: enableRecording,
      recordSegmentDuration: '10m', // Fix segments to 10 minutes
      recordDeleteAfter: '7d', // Keep recordings for 7 days
      // Default record path: /recordings/%path/%Y-%m-%d_%H-%M-%S
    };

    await this.postConfig(aacPathName, aacConfig);
  }

  async isPathConfigured(pathName: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.mediamtxApiUrl}/v3/config/paths/get/${pathName}`)
      );
      return !!response.data;
    } catch (e: any) {
      if (e.response?.status === 404) return false;
      return false; // Default to false on error to be safe, or could throw
    }
  }

  async removePath(pathName: string): Promise<void> {
    const pathsToRemove = [pathName, `${pathName}_aac`];
    
    for (const path of pathsToRemove) {
      try {
        await firstValueFrom(
          this.httpService.delete(`${this.mediamtxApiUrl}/v3/config/paths/delete/${path}`)
        );
        this.logger.log(`Removed MediaMTX path: ${path}`);
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          this.logger.error(`Failed to remove MediaMTX path: ${path}`, error);
        }
      }
    }
  }

  async getHlsUrl(pathName: string): Promise<string> {
    // Return HLS URL for the AAC transcoded path
    // This ensures browsers receive AAC audio which they can play
    // If _aac path is not active/ready, this might take a few seconds to spin up (runOnDemand)
    return `/stream/${pathName}_aac/index.m3u8`;
  }

  async listPaths(): Promise<MediaMtxPath[]> {
    try {
      const response: AxiosResponse<MediaMtxPathListResponse> = await firstValueFrom(
        this.httpService.get<MediaMtxPathListResponse>(`${this.mediamtxApiUrl}/v3/paths/list`)
      );

      return response.data.items || [];
    } catch (error) {
      this.logger.error('Failed to list MediaMTX paths', error);
      return [];
    }
  }

  async isPathActive(pathName: string): Promise<boolean> {
    try {
      const response: AxiosResponse<MediaMtxPath> = await firstValueFrom(
        this.httpService.get<MediaMtxPath>(`${this.mediamtxApiUrl}/v3/paths/get/${pathName}`)
      );

      return response.data.ready;
    } catch {
      return false;
    }
  }

  async startRecording(pathName: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.mediamtxApiUrl}/v3/paths/set/${pathName}`, {
          record: true,
        })
      );

      this.logger.log(`Started recording for path: ${pathName}`);
    } catch (error) {
      this.logger.error(`Failed to start recording for path: ${pathName}`, error);
      throw error;
    }
  }

  async stopRecording(pathName: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.mediamtxApiUrl}/v3/paths/set/${pathName}`, {
          record: false,
        })
      );

      this.logger.log(`Stopped recording for path: ${pathName}`);
    } catch (error) {
      this.logger.error(`Failed to stop recording for path: ${pathName}`, error);
      throw error;
    }
  }
}
