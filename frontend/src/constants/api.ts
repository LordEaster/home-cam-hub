/**
 * API endpoint paths
 * Centralized API definitions for maintainability
 */
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },

  // Users
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    PERMISSIONS: (id: string) => `/users/${id}/permissions`,
  },

  // Cameras
  CAMERAS: {
    BASE: '/cameras',
    BY_ID: (id: string) => `/cameras/${id}`,
    DISCOVER: '/cameras/discover',
    STREAM: (id: string) => `/cameras/${id}/stream`,
    TEST: (id: string) => `/cameras/${id}/test`,
    PTZ: (id: string) => `/cameras/${id}/ptz`,
    PTZ_STOP: (id: string) => `/cameras/${id}/ptz/stop`,
    PRESETS: (id: string) => `/cameras/${id}/presets`,
    GOTO_PRESET: (cameraId: string, presetId: string) =>
      `/cameras/${cameraId}/presets/${presetId}/goto`,
  },

  // Recordings / Playback
  RECORDINGS: {
    BASE: '/recordings',
    BY_ID: (id: string) => `/recordings/${id}`,
    STREAM: (id: string) => `/recordings/${id}/stream`,
    TIMELINE: '/recordings/timeline',
    EXPORT: '/recordings/export',
  },

  // Audit
  AUDIT: {
    BASE: '/audit',
  },
} as const;

/**
 * Storage keys for localStorage/sessionStorage
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'homecam_access_token',
  REFRESH_TOKEN: 'homecam_refresh_token',
  USER: 'homecam_user',
} as const;

/**
 * Query keys for React Query
 */
export const QUERY_KEYS = {
  AUTH: {
    ME: ['auth', 'me'],
  },
  CAMERAS: {
    ALL: ['cameras'],
    BY_ID: (id: string) => ['cameras', id],
    STREAM: (id: string) => ['cameras', id, 'stream'],
    PRESETS: (id: string) => ['cameras', id, 'presets'],
  },
  USERS: {
    ALL: ['users'],
    BY_ID: (id: string) => ['users', id],
    PERMISSIONS: (id: string) => ['users', id, 'permissions'],
  },
  RECORDINGS: {
    ALL: ['recordings'],
    TIMELINE: (cameraId: string, date: string) => ['recordings', 'timeline', cameraId, date],
  },
  AUDIT: {
    ALL: ['audit'],
  },
} as const;
