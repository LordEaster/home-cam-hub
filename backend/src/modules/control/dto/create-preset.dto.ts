import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreatePresetDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  presetToken?: string;

  @IsNumber()
  @IsOptional()
  pan?: number;

  @IsNumber()
  @IsOptional()
  tilt?: number;

  @IsNumber()
  @IsOptional()
  zoom?: number;
}
