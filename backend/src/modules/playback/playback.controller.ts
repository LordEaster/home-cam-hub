import { Controller, Get, Post, Query, Param, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { PlaybackService } from './playback.service';
import { ExportClipDto } from './dto/export-clip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
}

@Controller('recordings')
@UseGuards(JwtAuthGuard)
export class PlaybackController {
  constructor(private readonly playbackService: PlaybackService) {}

  @Get()
  async findRecordings(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cameraId') cameraId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.playbackService.findRecordings(user.id, user.role, cameraId, startDate, endDate);
  }

  @Get('timeline')
  async getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cameraId') cameraId: string,
    @Query('date') date: string,
  ) {
    return this.playbackService.getTimeline(user.id, user.role, cameraId, date);
  }

  @Get(':id/stream')
  async getStreamUrl(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    // const url = await this.playbackService.getStreamUrl(id, user.id, user.role, ipAddress);
    // return url; 
    // Wait, service.getStreamUrl returns { url: ... } pointing here?
    // No, service.getStreamUrl returned `/api/recordings/.../stream`.
    // So the frontend calls THIS endpoint.
    // So this endpoint should call service.getStreamFile(id, res).
    
    // Check permission first? 
    // service.getStreamFile should check permission.
    // But checking permission usually requires userId. 
    // Let's modify service.getStreamFile to accept userId.
    
    await this.playbackService.getStreamFile(id, user.id, user.role, ipAddress, res);
  }

  @Post('export')
  async exportClip(
    @Body() dto: ExportClipDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    return this.playbackService.exportClip(
      user.id,
      user.role,
      dto.cameraId,
      dto.startTime,
      dto.endTime,
      ipAddress,
    );
  }
}
