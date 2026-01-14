declare module 'onvif' {
  export interface OnvifDevice {
    connect: () => Promise<void>;
    getDeviceInformation: () => Promise<{ manufacturer: string; model: string }>;
    getProfiles: () => Promise<Array<{ token: string; name: string }>>;
    getStreamUri: (options: { protocol: string; profileToken: string }) => Promise<{ uri: string }>;
    ptz?: unknown;
  }

  export class Cam implements OnvifDevice {
    constructor(options: {
      hostname: string;
      port: number;
      username: string;
      password: string;
    });
    connect(): Promise<void>;
    getDeviceInformation(): Promise<{ manufacturer: string; model: string }>;
    getProfiles(): Promise<Array<{ token: string; name: string }>>;
    getStreamUri(options: { protocol: string; profileToken: string }): Promise<{ uri: string }>;
    ptz?: unknown;
  }

  export namespace Discovery {
    function probe(
      callback: (
        err: Error | null,
        cameras: Array<{ hostname: string; port: number; path: string }>
      ) => void
    ): void;
  }
}
