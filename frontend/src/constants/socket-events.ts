/**
 * WebSocket Event Names (Frontend)
 * Must match backend constants
 */

export const SOCKET_EVENTS = {
  // Camera Events
  CAMERA_STATUS: 'camera:status',
  CAMERA_HEALTH: 'camera:health',
  STREAM_STARTED: 'camera:stream:started',
  STREAM_STOPPED: 'camera:stream:stopped',
  
  // Recording Events
  RECORDING_STARTED: 'recording:started',
  RECORDING_COMPLETED: 'recording:completed',
  RECORDING_FAILED: 'recording:failed',
  RECORDING_DELETED: 'recording:deleted',
  
  // System Events
  SYSTEM_ALERT: 'system:alert',
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_MAINTENANCE: 'system:maintenance',
  
  // Connection Events
  AUTHENTICATED: 'authenticated',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
