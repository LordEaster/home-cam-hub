import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SOCKET_EVENTS, CONNECTION_EVENTS } from '../../constants/events';
import {
  CameraStatusPayload,
  CameraHealthPayload,
  RecordingStartedPayload,
  RecordingCompletedPayload,
  SystemAlertPayload,
} from './dto/events.dto';

/**
 * WebSocket Gateway for real-time communication
 * Handles camera status, recordings, and system events
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private authenticatedClients = new Map<string, string>(); // socketId -> userId

  constructor(private jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  /**
   * Handle client connection
   * Reads JWT token from cookies sent by browser
   */
  async handleConnection(client: Socket) {
    // Extract token from cookies (sent automatically with withCredentials: true)
    const cookies = client.handshake.headers.cookie;
    let token: string | undefined;

    // Debug: Log what cookies we received
    this.logger.debug(`Cookies received: ${cookies || 'none'}`);

    if (cookies) {
      // Parse cookies to find accessToken
      const cookieArray = cookies.split(';').map(c => c.trim());
      const accessTokenCookie = cookieArray.find(c => c.startsWith('accessToken='));
      if (accessTokenCookie) {
        token = accessTokenCookie.split('=')[1];
        this.logger.debug(`Found accessToken in cookies`);
      }
    }

    // Fallback: Check auth header if cookie not found (for development/testing)
    if (!token) {
      token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
    }

    if (!token) {
      this.logger.warn(`Client ${client.id} connecting without token`);
      client.disconnect();
      return;
    }

    try {
      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token);
      this.authenticatedClients.set(client.id, payload.sub);
      
      this.logger.log(`Client ${client.id} connected (user: ${payload.sub})`);
      client.emit(CONNECTION_EVENTS.AUTHENTICATED, { userId: payload.sub });
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}`, error);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    const userId = this.authenticatedClients.get(client.id);
    this.authenticatedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected (user: ${userId})`);
  }

  /**
   * Emit camera status change to all connected clients
   */
  emitCameraStatus(payload: CameraStatusPayload) {
    this.server.emit(SOCKET_EVENTS.STATUS_CHANGED, payload);
    this.logger.debug(`Emitted camera status: ${payload.cameraId} - ${payload.status}`);
  }

  /**
   * Emit camera health update
   */
  emitCameraHealth(payload: CameraHealthPayload) {
    this.server.emit(SOCKET_EVENTS.HEALTH_UPDATE, payload);
  }

  /**
   * Emit recording started event
   */
  emitRecordingStarted(payload: RecordingStartedPayload) {
    this.server.emit(SOCKET_EVENTS.STARTED, payload);
    this.logger.debug(`Recording started: ${payload.recordingId}`);
  }

  /**
   * Emit recording completed event
   */
  emitRecordingCompleted(payload: RecordingCompletedPayload) {
    this.server.emit(SOCKET_EVENTS.COMPLETED, payload);
    this.logger.debug(`Recording completed: ${payload.recordingId}`);
  }

  /**
   * Emit system alert to all clients
   */
  emitSystemAlert(payload: SystemAlertPayload) {
    this.server.emit(SOCKET_EVENTS.ALERT, payload);
    this.logger.log(`System alert [${payload.level}]: ${payload.message}`);
  }

  /**
   * Emit to specific user only
   */
  emitToUser(userId: string, event: string, data: any) {
    const socketIds = Array.from(this.authenticatedClients.entries())
      .filter(([_, uid]) => uid === userId)
      .map(([socketId]) => socketId);

    socketIds.forEach((socketId) => {
      this.server.to(socketId).emit(event, data);
    });
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.authenticatedClients.size;
  }
}
