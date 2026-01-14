import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SystemSetting } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<SystemSetting[]> {
    return this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async findOne(key: string): Promise<SystemSetting> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key '${key}' not found`);
    }

    return setting;
  }

  async upsert(dto: UpsertSettingDto): Promise<SystemSetting> {
    return this.prisma.systemSetting.upsert({
      where: { key: dto.key },
      update: {
        value: dto.value,
        description: dto.description,
      },
      create: {
        key: dto.key,
        value: dto.value,
        description: dto.description,
      },
    });
  }

  async delete(key: string): Promise<void> {
    await this.findOne(key);
    await this.prisma.systemSetting.delete({
      where: { key },
    });
  }
}
