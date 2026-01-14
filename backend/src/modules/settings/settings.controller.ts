import { Controller, Get, Put, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client'; // Note: You might need to add SYSTEM_SETTING_UPDATE to AuditAction enum if not present, using default for now or generic UPDATE.
// Since AuditAction doesn't have SETTING_UPDATE, we might misuse another or just log as generic if available. 
// However, looking at the schema, there isn't a SETTING_UPDATE. 
// We will use USER_UPDATE logic or similar, but wait, let's see available actions.
// Available: LOGIN, LOGOUT, ..., CAMERA_*, USER_*, PERMISSION_UPDATE.
// We should probably add SETTING_UPDATE to schema but that requires migration. 
// For now we will skip audit log for settings or map to closest, but effectively we should just not log or use a generic one if possible.
// Actually, let's just create the controller without audit logging for this specific action to avoid schema changes in this task, or proceed without it. 
// Wait, the plan says "System Settings". It is important. 
// Let's use `details` in AuditLog to specify it was a setting change, and maybe use USER_UPDATE since it's an admin update? No that's for users.
// We will omit audit logging for settings for now to strictly follow the schema or just not break it.

// Re-evaluating: The instructions didn't explicitly demand schema migration for AuditAction. 
// I'll skip AuditService integration for *this specific controller* to avoid breaking changes or migration needs, 
// as the user didn't ask for it in the plan's "Proposed Changes" for Backend.

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  async findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Put()
  async upsert(@Body() dto: UpsertSettingDto) {
    return this.settingsService.upsert(dto);
  }

  @Delete(':key')
  async delete(@Param('key') key: string) {
    return this.settingsService.delete(key);
  }
}
