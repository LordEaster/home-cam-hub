import { Injectable, Logger } from '@nestjs/common';

interface DiscoveredCamera {
  ip: string;
  name: string;
  manufacturer: string;
  model: string;
  hasOnvif: boolean;
}

interface StreamUrls {
  mainStream: string | null;
  subStream: string | null;
}

// ONVIF library types
interface OnvifDevice {
  connect: () => Promise<void>;
  getDeviceInformation: () => Promise<{ manufacturer: string; model: string }>;
  getProfiles: () => Promise<Array<{ token: string; name: string }>>;
  getStreamUri: (options: { protocol: string; profileToken: string }) => Promise<{ uri: string }>;
}

@Injectable()
export class OnvifService {
  private readonly logger = new Logger(OnvifService.name);

  async discoverCameras(): Promise<DiscoveredCamera[]> {
    const discovered: DiscoveredCamera[] = [];

    try {
      // Using onvif library for WS-Discovery
      const onvif = await import('onvif');

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(discovered);
        }, 5000);

        onvif.Discovery.probe((err: Error | null, cams: Array<{ hostname: string; port: number; path: string }>) => {
          clearTimeout(timeout);

          if (err) {
            this.logger.error('ONVIF discovery error:', err);
            resolve(discovered);
            return;
          }

          for (const cam of cams) {
            discovered.push({
              ip: cam.hostname,
              name: `ONVIF Camera (${cam.hostname})`,
              manufacturer: 'Unknown',
              model: 'Unknown',
              hasOnvif: true,
            });
          }

          resolve(discovered);
        });
      });
    } catch (error) {
      this.logger.error('Failed to run ONVIF discovery:', error);
      return [];
    }
  }

  async getStreamUrls(ip: string, port: number, username: string, password: string): Promise<StreamUrls> {
    try {
      const onvif = await import('onvif');

      const device: OnvifDevice = new onvif.Cam({
        hostname: ip,
        port,
        username,
        password,
      });

      await device.connect();

      const profiles = await device.getProfiles();

      let mainStream: string | null = null;
      let subStream: string | null = null;

      if (profiles.length > 0) {
        const mainUri = await device.getStreamUri({
          protocol: 'RTSP',
          profileToken: profiles[0].token,
        });
        mainStream = mainUri.uri;

        if (profiles.length > 1) {
          const subUri = await device.getStreamUri({
            protocol: 'RTSP',
            profileToken: profiles[1].token,
          });
          subStream = subUri.uri;
        }
      }

      return { mainStream, subStream };
    } catch (error) {
      this.logger.error(`Failed to get ONVIF stream URLs for ${ip}:`, error);
      return { mainStream: null, subStream: null };
    }
  }

  async testConnection(ip: string, port: number, username: string, password: string): Promise<void> {
    const onvif = await import('onvif');

    const device: OnvifDevice = new onvif.Cam({
      hostname: ip,
      port,
      username,
      password,
    });

    await device.connect();
    await device.getDeviceInformation();
  }

  async getPtzCapabilities(ip: string, port: number, username: string, password: string): Promise<boolean> {
    try {
      const onvif = await import('onvif');

      const device = new onvif.Cam({
        hostname: ip,
        port,
        username,
        password,
      });

      await device.connect();

      // Check if PTZ service is available
      return !!device.ptz;
    } catch {
      return false;
    }
  }
}
