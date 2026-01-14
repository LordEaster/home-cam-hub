/**
 * WebSocket Event Payload Types (Frontend)
 */

export interface CameraStatusPayload {
  cameraId: string;
  status: 'online' | 'offline';
  timestamp: string;
}

export interface CameraHealthPayload {
  cameraId: string;
  isHealthy: boolean;
  latency?: number;
  errorMessage?: string;
  timestamp: string;
}

export interface RecordingStartedPayload {
  recordingId: string;
  cameraId: string;
  startedAt: string;
}

export interface RecordingCompletedPayload {
  recordingId: string;
  cameraId: string;
  startedAt: string;
  endedAt: string;
  fileSize: number;
  filePath: string;
}

export interface RecordingFailedPayload {
  cameraId: string;
  error: string;
  timestamp: string;
}

export interface SystemAlertPayload {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}
