import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ControlController } from './control.controller';
import { ControlService } from './control.service';
import { PtzGateway } from './ptz.gateway';
import { CamerasModule } from '../cameras/cameras.module';

@Module({
  imports: [HttpModule, CamerasModule],
  controllers: [ControlController],
  providers: [ControlService, PtzGateway],
})
export class ControlModule {}
