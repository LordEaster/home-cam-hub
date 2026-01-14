import client from './client';
import { API_ENDPOINTS } from '../constants';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
}

export interface LoginResponse {
  message: string;
  user: User;
}

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await client.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, { username, password });
    return response.data;
  },

  async logout(): Promise<void> {
    await client.post(API_ENDPOINTS.AUTH.LOGOUT);
  },

  async refreshToken(): Promise<void> {
    await client.post(API_ENDPOINTS.AUTH.REFRESH);
  },

  async getCurrentUser(): Promise<User> {
    const response = await client.get<User>(API_ENDPOINTS.AUTH.ME);
    return response.data;
  },
};
