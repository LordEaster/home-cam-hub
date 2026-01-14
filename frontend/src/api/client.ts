import axios, { AxiosError } from 'axios';
import { ROUTES } from '../constants';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
});

// Response interceptor for error handling
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && originalRequest && !originalRequest.headers['X-Retry']) {
      try {
        // Try to refresh token
        await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        
        // Retry original request
        originalRequest.headers['X-Retry'] = 'true';
        return client(originalRequest);
      } catch {
        // Refresh failed, redirect to login
        window.location.href = ROUTES.LOGIN;
      }
    }
    return Promise.reject(error);
  }
);

export default client;
