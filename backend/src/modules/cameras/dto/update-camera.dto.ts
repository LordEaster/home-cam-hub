import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { RecordingMode } from '@prisma/client';

export class UpdateCameraDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsBoolean()
  @IsOptional()
  hasPtz?: boolean;

  @IsBoolean()
  @IsOptional()
  hasAudio?: boolean;

  @IsBoolean()
  @IsOptional()
  hasPresets?: boolean;

  @IsEnum(RecordingMode)
  @IsOptional()
  recordingMode?: RecordingMode;

  @IsBoolean()
  @IsOptional()
  isRecording?: boolean;
}
