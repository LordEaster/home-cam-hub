import { IsNumber, Min, Max } from 'class-validator';

export class PtzCommandDto {
  @IsNumber()
  @Min(-1)
  @Max(1)
  pan: number;

  @IsNumber()
  @Min(-1)
  @Max(1)
  tilt: number;

  @IsNumber()
  @Min(-1)
  @Max(1)
  zoom: number = 0;
}
