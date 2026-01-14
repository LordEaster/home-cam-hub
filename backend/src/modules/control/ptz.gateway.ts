import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { TapoService } from '../cameras/tapo.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CameraType } from '@prisma/client';

interface PtzMovePayload {
  cameraId: string;
  direction: 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';
}

interface PtzStopPayload {
  cameraId: string;
}

interface ActivePtzSession {
  cameraId: string;
  cameraIp: string;
  direction: string;
  intervalId: NodeJS.Timeout;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PtzGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PtzGateway.name);
  private activeSessions = new Map<string, ActivePtzSession>();

  // Movement speed (1-10)
  private readonly MOVE_SPEED = 5;
  // Interval between move commands (ms) - must be > 300ms to avoid Tapo rate limiting
  private readonly MOVE_INTERVAL = 500;

  constructor(
    private readonly tapoService: TapoService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.stopAllSessionsForClient(client.id);
  }

  @SubscribeMessage('ptz:move')
  async handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PtzMovePayload,
  ) {
    const { cameraId, direction } = payload;

    // Stop existing session for this client
    this.stopSession(client.id);

    // Get camera IP
    const camera = await this.prisma.camera.findUnique({
      where: { id: cameraId },
    });

    if (!camera) {
      client.emit('ptz:error', { message: 'Camera not found' });
      return;
    }

    if (camera.type !== CameraType.TAPO) {
      // For ONVIF cameras, would need different handling
      client.emit('ptz:error', { message: 'PTZ via WebSocket only supported for Tapo cameras' });
      return;
    }

    // Calculate x, y from direction
    const { x, y } = this.directionToXY(direction);

    // Start continuous movement
    const intervalId = setInterval(async () => {
      try {
        await this.tapoService.movePtz(camera.ip, x, y);
      } catch (error) {
        this.logger.error(`PTZ move error: ${error}`);
        this.stopSession(client.id);
        client.emit('ptz:error', { message: 'PTZ move failed' });
      }
    }, this.MOVE_INTERVAL);

    // Store session
    this.activeSessions.set(client.id, {
      cameraId,
      cameraIp: camera.ip,
      direction,
      intervalId,
    });

    // Initial move
    try {
      await this.tapoService.movePtz(camera.ip, x, y);
      client.emit('ptz:moving', { cameraId, direction });
    } catch (error) {
      this.logger.error(`Initial PTZ move error: ${error}`);
      this.stopSession(client.id);
      client.emit('ptz:error', { message: 'PTZ move failed' });
    }
  }

  @SubscribeMessage('ptz:stop')
  handleStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PtzStopPayload,
  ) {
    this.stopSession(client.id);
    client.emit('ptz:stopped', { cameraId: payload.cameraId });
  }

  private directionToXY(direction: string): { x: number; y: number } {
    const speed = this.MOVE_SPEED;
    switch (direction) {
      case 'up':
        return { x: 0, y: speed };
      case 'down':
        return { x: 0, y: -speed };
      case 'left':
        return { x: -speed, y: 0 };
      case 'right':
        return { x: speed, y: 0 };
      case 'up-left':
        return { x: -speed, y: speed };
      case 'up-right':
        return { x: speed, y: speed };
      case 'down-left':
        return { x: -speed, y: -speed };
      case 'down-right':
        return { x: speed, y: -speed };
      default:
        return { x: 0, y: 0 };
    }
  }

  private stopSession(clientId: string) {
    const session = this.activeSessions.get(clientId);
    if (session) {
      clearInterval(session.intervalId);
      this.activeSessions.delete(clientId);
      this.logger.log(`Stopped PTZ session for client ${clientId}`);
    }
  }

  private stopAllSessionsForClient(clientId: string) {
    this.stopSession(clientId);
  }
}
