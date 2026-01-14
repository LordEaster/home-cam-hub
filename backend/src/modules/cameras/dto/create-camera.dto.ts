import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, IsIP, Min, Max } from 'class-validator';
import { CameraType, RecordingMode } from '@prisma/client';

export class CreateCameraDto {
  @IsString()
  name: string;

  @IsEnum(CameraType)
  type: CameraType;

  @IsString()
  @IsOptional()
  model?: string;

  @IsIP()
  ip: string;

  // Port is optional - not used for Tapo cameras
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  // ONVIF credentials
  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  // Manual RTSP Configuration (for GENERIC type)
  @IsString()
  @IsOptional()
  rtspMainStream?: string;

  @IsString()
  @IsOptional()
  rtspSubStream?: string;

  // Features
  @IsBoolean()
  @IsOptional()
  hasPtz?: boolean;

  @IsBoolean()
  @IsOptional()
  hasAudio?: boolean;

  @IsBoolean()
  @IsOptional()
  hasPresets?: boolean;

  // Recording
  @IsEnum(RecordingMode)
  @IsOptional()
  recordingMode?: RecordingMode;

  @IsBoolean()
  @IsOptional()
  isRecording?: boolean;
}
