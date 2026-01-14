import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

interface TapoDevice {
  name: string;
  device_type: string;
  ip_addr: string;
}

interface TapoDeviceInfo {
  device_id: string;
  model: string;
  hardware_version: string;
  firmware_version: string;
  nickname: string;
  on_time?: number;
}

@Injectable()
export class TapoClientService {
  private readonly logger = new Logger(TapoClientService.name);
  private readonly tapoServiceUrl: string;
  private sessionToken: string | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.tapoServiceUrl = this.configService.get<string>('TAPO_SERVICE_URL', 'http://tapo-rest:80');
  }

  private async ensureAuth(): Promise<string> {
    if (this.sessionToken) {
      return this.sessionToken;
    }

    const password = this.configService.get<string>('TAPO_API_PASSWORD', 'changeme');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.tapoServiceUrl}/login`, { password })
      );
      this.sessionToken = response.data as string;
      return this.sessionToken;
    } catch (error) {
      this.logger.error('Failed to authenticate with tapo-rest', error);
      throw error;
    }
  }

  private authHeaders(): { Authorization: string } {
    return { Authorization: `Bearer ${this.sessionToken}` };
  }

  async getDevices(): Promise<TapoDevice[]> {
    await this.ensureAuth();
    
    try {
      const response: AxiosResponse<TapoDevice[]> = await firstValueFrom(
        this.httpService.get<TapoDevice[]>(`${this.tapoServiceUrl}/devices`, {
          headers: this.authHeaders(),
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get devices from tapo-rest', error);
      return [];
    }
  }

  async getStreamUrl(ip: string): Promise<{ mainStream: string; subStream: string }> {
    // Tapo cameras use RTSP streams with Camera Account (set in Tapo app)
    // NOT the Tapo cloud account - that's for API access only
    const username = this.configService.get<string>('TAPO_CAMERA_USERNAME', '');
    const password = this.configService.get<string>('TAPO_CAMERA_PASSWORD', '');
    
    // URL encode special characters in credentials
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);
    
    return {
      mainStream: `rtsp://${encodedUsername}:${encodedPassword}@${ip}:554/stream1`,
      subStream: `rtsp://${encodedUsername}:${encodedPassword}@${ip}:554/stream2`,
    };
  }

  async getCameraInfo(deviceName: string): Promise<TapoDeviceInfo | null> {
    await this.ensureAuth();
    
    try {
      const response: AxiosResponse<TapoDeviceInfo> = await firstValueFrom(
        this.httpService.get<TapoDeviceInfo>(`${this.tapoServiceUrl}/device/${deviceName}/info`, {
          headers: this.authHeaders(),
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get camera info for ${deviceName}`, error);
      return null;
    }
  }

  async movePtz(ip: string, pan: number, tilt: number): Promise<void> {
    // Tapo PTZ is controlled via the camera's internal API
    // The tapo-rest service may not support PTZ directly
    // For now, we log and note this is device-specific
    this.logger.warn(`PTZ move requested for ${ip}: pan=${pan}, tilt=${tilt} - requires device-specific API`);
  }

  async goToPreset(ip: string, presetId: string): Promise<void> {
    this.logger.warn(`Preset goto requested for ${ip}: preset=${presetId} - requires device-specific API`);
  }

  async testConnection(ip: string): Promise<{ success: boolean; message: string }> {
    const devices = await this.getDevices();
    const device = devices.find(d => d.ip_addr === ip);
    
    if (device) {
      return { success: true, message: `Found device: ${device.name} (${device.device_type})` };
    }
    
    return { success: false, message: 'Device not found in tapo-rest configuration' };
  }
}
