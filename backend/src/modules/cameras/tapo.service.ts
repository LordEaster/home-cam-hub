import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TapoCamera } from 'tapo-camera-client';

interface TapoDeviceInfo {
  deviceId: string;
  model: string;
  hardwareVersion: string;
  firmwareVersion: string;
  nickname: string;
  mac: string;
}

interface TapoConnectionResult {
  success: boolean;
  message: string;
  deviceInfo?: TapoDeviceInfo;
}

@Injectable()
export class TapoService {
  private readonly logger = new Logger(TapoService.name);
  
  // Tapo Cloud Account (for control API - PTZ, LED, privacy mode)
  private readonly cloudEmail: string;
  private readonly cloudPassword: string;
  
  // Camera Account (for RTSP streaming)
  private readonly cameraUsername: string;
  private readonly cameraPassword: string;

  // Cache camera instances to avoid rate limiting
  private cameraCache = new Map<string, { camera: TapoCamera; lastUsed: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    // Tapo Cloud Account credentials (TP-Link account)
    this.cloudEmail = this.configService.get<string>('TAPO_EMAIL', '');
    this.cloudPassword = this.configService.get<string>('TAPO_PASSWORD', '');
    
    // Camera Account credentials (set in Tapo app: Advanced Settings > Camera Account)
    this.cameraUsername = this.configService.get<string>('TAPO_CAMERA_USERNAME', '');
    this.cameraPassword = this.configService.get<string>('TAPO_CAMERA_PASSWORD', '');
  }

  /**
   * Get or create a cached TapoCamera instance
   * Caches camera instances to avoid repeated init() calls that cause rate limiting
   */
  private async getOrCreateCamera(ip: string): Promise<TapoCamera> {
    const cached = this.cameraCache.get(ip);
    const now = Date.now();

    if (cached && (now - cached.lastUsed) < this.CACHE_TTL) {
      cached.lastUsed = now;
      return cached.camera;
    }

    // Create new camera and init
    const camera = new TapoCamera({
      host: ip,
      user: this.cloudEmail,
      password: this.cloudPassword,
      reuseSession: true,
    });

    await camera.init();
    this.cameraCache.set(ip, { camera, lastUsed: now });
    this.logger.log(`Cached Tapo camera connection for ${ip}`);

    return camera;
  }

  /**
   * Create a TapoCamera instance for control API (PTZ, LED, etc)
   * Uses Tapo Cloud Account credentials
   */
  private createCamera(ip: string): TapoCamera {
    return new TapoCamera({
      host: ip,
      user: this.cloudEmail,
      password: this.cloudPassword,
      reuseSession: true,
    });
  }

  /**
   * Get RTSP stream URLs for a Tapo camera
   * Uses Camera Account credentials (NOT cloud account)
   */
  getStreamUrl(ip: string): { mainStream: string; subStream: string } {
    const encodedUsername = encodeURIComponent(this.cameraUsername);
    const encodedPassword = encodeURIComponent(this.cameraPassword);

    return {
      mainStream: `rtsp://${encodedUsername}:${encodedPassword}@${ip}:554/stream1`,
      subStream: `rtsp://${encodedUsername}:${encodedPassword}@${ip}:554/stream2`,
    };
  }

  /**
   * Test connection to a Tapo camera and get device info
   */
  async testConnection(ip: string): Promise<TapoConnectionResult> {
    try {
      const camera = this.createCamera(ip);
      await camera.init();
      const basicInfo = await camera.getBasicInfo();
      const info = basicInfo.device_info.basic_info;

      return {
        success: true,
        message: `Connected to ${info.device_alias || info.device_model}`,
        deviceInfo: {
          deviceId: info.dev_id,
          model: info.device_model,
          hardwareVersion: info.hw_version,
          firmwareVersion: info.sw_version,
          nickname: info.device_alias,
          mac: info.mac,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      this.logger.error(`Failed to connect to Tapo camera at ${ip}`, error);
      return { success: false, message };
    }
  }

  /**
   * Get device information from a Tapo camera
   */
  async getDeviceInfo(ip: string): Promise<TapoDeviceInfo | null> {
    try {
      const camera = this.createCamera(ip);
      await camera.init();
      const basicInfo = await camera.getBasicInfo();
      const info = basicInfo.device_info.basic_info;

      return {
        deviceId: info.dev_id,
        model: info.device_model,
        hardwareVersion: info.hw_version,
        firmwareVersion: info.sw_version,
        nickname: info.device_alias,
        mac: info.mac,
      };
    } catch (error) {
      this.logger.error(`Failed to get device info for ${ip}`, error);
      return null;
    }
  }

  /**
   * Move camera PTZ
   * @param ip Camera IP address
   * @param x Horizontal movement (-10 to 10, negative = left, positive = right)
   * @param y Vertical movement (-10 to 10, negative = down, positive = up)
   */
  async movePtz(ip: string, x: number, y: number): Promise<void> {
    try {
      const camera = await this.getOrCreateCamera(ip);
      await camera.moveMotor(x, y);
      // Log only occasionally to reduce spam
    } catch (error) {
      this.logger.error(`Failed to move PTZ for ${ip}`, error);
      // Clear cache on error so next attempt reinitializes
      this.cameraCache.delete(ip);
      throw error;
    }
  }

  /**
   * Move camera to a preset position
   */
  async goToPreset(ip: string, presetId: string): Promise<void> {
    try {
      const camera = this.createCamera(ip);
      await camera.init();
      const presets = await camera.getPresets();

      // Find preset by ID or name
      const presetName = Object.keys(presets).find(
        (key) => key === presetId || presets[key] === presetId,
      );

      if (!presetName) {
        throw new Error(`Preset ${presetId} not found`);
      }

      // Note: tapo-camera-client doesn't have direct goToPreset
      // We would need to store preset positions and use moveMotor
      this.logger.warn(`Preset navigation not fully supported yet for ${ip}`);
    } catch (error) {
      this.logger.error(`Failed to go to preset for ${ip}`, error);
      throw error;
    }
  }

  /**
   * Get available presets for a camera
   */
  async getPresets(ip: string): Promise<Record<string, string>> {
    try {
      const camera = this.createCamera(ip);
      await camera.init();
      return await camera.getPresets();
    } catch (error) {
      this.logger.error(`Failed to get presets for ${ip}`, error);
      return {};
    }
  }

  /**
   * Set privacy mode (lens mask)
   */
  async setPrivacyMode(ip: string, enabled: boolean): Promise<void> {
    try {
      const camera = this.createCamera(ip);
      await camera.init();
      await camera.setPrivacyMode(enabled ? 'on' : 'off');
      this.logger.log(`Privacy mode ${enabled ? 'enabled' : 'disabled'} for ${ip}`);
    } catch (error) {
      this.logger.error(`Failed to set privacy mode for ${ip}`, error);
      throw error;
    }
  }

  /**
   * Get privacy mode status
   */
  async getPrivacyMode(ip: string): Promise<boolean> {
    try {
      const camera = this.createCamera(ip);
      await camera.init();
      const status = await camera.getPrivacyMode();
      return status === 'on';
    } catch (error) {
      this.logger.error(`Failed to get privacy mode for ${ip}`, error);
      return false;
    }
  }

  /**
   * Set LED status
   */
  async setLED(ip: string, enabled: boolean): Promise<void> {
    try {
      const camera = this.createCamera(ip);
      await camera.init();
      await camera.setLEDEnabled(enabled ? 'on' : 'off');
      this.logger.log(`LED ${enabled ? 'enabled' : 'disabled'} for ${ip}`);
    } catch (error) {
      this.logger.error(`Failed to set LED for ${ip}`, error);
      throw error;
    }
  }

  /**
   * Get LED status
   */
  async getLED(ip: string): Promise<boolean> {
    try {
      const camera = this.createCamera(ip);
      await camera.init();
      const led = await camera.getLED();
      return led.enabled === 'on';
    } catch (error) {
      this.logger.error(`Failed to get LED status for ${ip}`, error);
      return true;
    }
  }
}
