import { IsString, IsDateString } from 'class-validator';

export class ExportClipDto {
  @IsString()
  cameraId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}
