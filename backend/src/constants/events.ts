/**
 * WebSocket Event Names
 * Centralized constants for all Socket.IO events
 */

// Camera Events
export const CAMERA_EVENTS = {
  STATUS_CHANGED: 'camera:status',
  HEALTH_UPDATE: 'camera:health',
  STREAM_STARTED: 'camera:stream:started',
  STREAM_STOPPED: 'camera:stream:stopped',
} as const;

// Recording Events
export const RECORDING_EVENTS = {
  STARTED: 'recording:started',
  COMPLETED: 'recording:completed',
  FAILED: 'recording:failed',
  DELETED: 'recording:deleted',
} as const;

// System Events
export const SYSTEM_EVENTS = {
  ALERT: 'system:alert',
  HEALTH_CHECK: 'system:health',
  MAINTENANCE: 'system:maintenance',
} as const;

// Connection Events
export const CONNECTION_EVENTS = {
  CONNECT: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  AUTHENTICATED: 'authenticated',
} as const;

// All events combined
export const SOCKET_EVENTS = {
  ...CAMERA_EVENTS,
  ...RECORDING_EVENTS,
  ...SYSTEM_EVENTS,
  ...CONNECTION_EVENTS,
} as const;

// Type exports
export type CameraEvent = typeof CAMERA_EVENTS[keyof typeof CAMERA_EVENTS];
export type RecordingEvent = typeof RECORDING_EVENTS[keyof typeof RECORDING_EVENTS];
export type SystemEvent = typeof SYSTEM_EVENTS[keyof typeof SYSTEM_EVENTS];
export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
