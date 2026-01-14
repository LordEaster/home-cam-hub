import client from './client';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
  isActive: boolean;
}

export interface CreateUserDto {
  username: string;
  password: string;
  displayName: string;
  email?: string;
  role: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const response = await client.get<User[]>('/users');
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await client.get<User>(`/users/${id}`);
    return response.data;
  },

  create: async (data: CreateUserDto): Promise<User> => {
    const response = await client.post<User>('/users', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateUserDto>): Promise<User> => {
    const response = await client.patch<User>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/users/${id}`);
  },

  getPermissions: async (id: string): Promise<{ userId: string; permissions: any[] }> => {
    const response = await client.get(`/users/${id}/permissions`);
    return response.data;
  },

  setPermissions: async (id: string, permissions: any[]): Promise<any> => {
    const response = await client.put(`/users/${id}/permissions`, { permissions });
    return response.data;
  },

  changePassword: async (data: ChangePasswordDto): Promise<void> => {
    await client.post('/users/change-password', data);
  },
};
