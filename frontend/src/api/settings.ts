import client from './client';

export interface SystemSetting {
  key: string;
  value: any;
  description: string | null;
  updatedAt: string;
}

export interface UpsertSettingDto {
  key: string;
  value: any;
  description?: string;
}

export const settingsApi = {
  getAll: async (): Promise<SystemSetting[]> => {
    const response = await client.get<SystemSetting[]>('/settings');
    return response.data;
  },

  getByKey: async (key: string): Promise<SystemSetting> => {
    const response = await client.get<SystemSetting>(`/settings/${key}`);
    return response.data;
  },

  upsert: async (data: UpsertSettingDto): Promise<SystemSetting> => {
    const response = await client.put<SystemSetting>('/settings', data);
    return response.data;
  },

  delete: async (key: string): Promise<void> => {
    await client.delete(`/settings/${key}`);
  },
};
