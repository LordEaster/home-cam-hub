import { Module, forwardRef } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';
import { RecordingCleanupService } from './recording-cleanup.service';

@Module({
  imports: [forwardRef(() => GatewayModule)],
  controllers: [PlaybackController],
  providers: [PlaybackService, RecordingCleanupService],
  exports: [PlaybackService],
})
export class PlaybackModule {}
