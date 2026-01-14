import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from '../audit/audit.module';
import { GatewayModule } from '../gateway/gateway.module';
import { CamerasController } from './cameras.controller';
import { CamerasService } from './cameras.service';
import { OnvifService } from './onvif.service';
import { TapoService } from './tapo.service';
import { MediaMtxService } from './mediamtx.service';
import { CameraHealthService } from './camera-health.service';
import { FfmpegService } from './ffmpeg.service';
import { PlaybackService } from '../playback/playback.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot(), AuditModule, forwardRef(() => GatewayModule)],
  controllers: [CamerasController],
  providers: [CamerasService, OnvifService, TapoService, MediaMtxService, CameraHealthService, FfmpegService, PlaybackService],
  exports: [CamerasService, OnvifService, TapoService],
})
export class CamerasModule {}
