import { IsArray, ValidateNested, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class PermissionEntry {
  @IsString()
  cameraId: string;

  @IsBoolean()
  canViewLive: boolean;

  @IsBoolean()
  canPlayback: boolean;

  @IsBoolean()
  canControl: boolean;

  @IsBoolean()
  canExport: boolean;
}

export class SetPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntry)
  permissions: PermissionEntry[];
}
