/**
 * Event Data Transfer Objects
 * Type-safe payloads for WebSocket events
 */

export interface CameraStatusPayload {
  cameraId: string;
  status: 'online' | 'offline';
  timestamp: Date;
}

export interface CameraHealthPayload {
  cameraId: string;
  isHealthy: boolean;
  latency?: number;
  errorMessage?: string;
  timestamp: Date;
}

export interface RecordingStartedPayload {
  recordingId: string;
  cameraId: string;
  startedAt: Date;
}

export interface RecordingCompletedPayload {
  recordingId: string;
  cameraId: string;
  startedAt: Date;
  endedAt: Date;
  fileSize: number;
  filePath: string;
}

export interface RecordingFailedPayload {
  cameraId: string;
  error: string;
  timestamp: Date;
}

export interface SystemAlertPayload {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}
