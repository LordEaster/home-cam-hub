import client from './client';
import { API_ENDPOINTS } from '../constants';

export interface Camera {
  id: string;
  name: string;
  type: 'TAPO' | 'ONVIF' | 'GENERIC';
  model: string | null;
  ip: string;
  port: number | null;
  hasPtz: boolean;
  hasAudio: boolean;
  hasPresets: boolean;
  isOnline: boolean;
  isRecording: boolean;
  recordingMode: 'CONTINUOUS' | 'MOTION' | 'HYBRID' | 'OFF';
  sortOrder: number | null;
}

export interface CameraStreamUrl {
  hlsUrl: string;
}

export interface CreateCameraDto {
  name: string;
  type: 'TAPO' | 'ONVIF' | 'GENERIC';
  model?: string;
  ip: string;
  port?: number;
  username?: string;
  password?: string;
  rtspMainStream?: string;
  rtspSubStream?: string;
  hasPtz?: boolean;
  hasAudio?: boolean;
  recordingMode?: 'CONTINUOUS' | 'MOTION' | 'HYBRID' | 'OFF';
  isRecording?: boolean;
}

export interface DiscoveredCamera {
  ip: string;
  name: string;
  manufacturer: string;
  model: string;
  hasOnvif: boolean;
}

export const camerasApi = {
  async getAll(): Promise<Camera[]> {
    const response = await client.get<Camera[]>(API_ENDPOINTS.CAMERAS.BASE);
    return response.data;
  },

  async getOne(id: string): Promise<Camera> {
    const response = await client.get<Camera>(API_ENDPOINTS.CAMERAS.BY_ID(id));
    return response.data;
  },

  async create(dto: CreateCameraDto): Promise<Camera> {
    const response = await client.post<Camera>(API_ENDPOINTS.CAMERAS.BASE, dto);
    return response.data;
  },

  async update(id: string, dto: Partial<CreateCameraDto>): Promise<Camera> {
    const response = await client.patch<Camera>(API_ENDPOINTS.CAMERAS.BY_ID(id), dto);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await client.delete(API_ENDPOINTS.CAMERAS.BY_ID(id));
  },

  async discover(): Promise<DiscoveredCamera[]> {
    const response = await client.get<DiscoveredCamera[]>(API_ENDPOINTS.CAMERAS.DISCOVER);
    return response.data;
  },

  async getStreamUrl(id: string, quality: 'hd' | 'sd' = 'hd'): Promise<CameraStreamUrl> {
    const response = await client.get<CameraStreamUrl>(`${API_ENDPOINTS.CAMERAS.STREAM(id)}?quality=${quality}`);
    return response.data;
  },

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const response = await client.post(API_ENDPOINTS.CAMERAS.TEST(id));
    return response.data;
  },

  async executePtz(id: string, pan: number, tilt: number, zoom: number = 0): Promise<void> {
    await client.post(API_ENDPOINTS.CAMERAS.PTZ(id), { pan, tilt, zoom });
  },

  async stopPtz(id: string): Promise<void> {
    await client.post(API_ENDPOINTS.CAMERAS.PTZ_STOP(id));
  },

  async getPresets(id: string): Promise<Array<{ id: string; name: string }>> {
    const response = await client.get(API_ENDPOINTS.CAMERAS.PRESETS(id));
    return response.data;
  },

  async goToPreset(cameraId: string, presetId: string): Promise<void> {
    await client.post(API_ENDPOINTS.CAMERAS.GOTO_PRESET(cameraId, presetId));
  },

  async reorder(cameraIds: string[]): Promise<void> {
    await client.post(`${API_ENDPOINTS.CAMERAS.BASE}/reorder`, { cameraIds });
  },
};
