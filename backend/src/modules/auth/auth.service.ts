import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuditAction, Prisma } from '@prisma/client';

interface TokenPayload {
  sub: string;
  username: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress: string, userAgent: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user || !user.isActive) {
      await this.logAuditEvent(null, AuditAction.LOGIN_FAILED, { username: dto.username }, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.logAuditEvent(user.id, AuditAction.LOGIN_FAILED, {}, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.username, user.role);

    // Log successful login
    await this.logAuditEvent(user.id, AuditAction.LOGIN, {}, ipAddress, userAgent);

    return tokens;
  }

  async logout(userId: string, refreshToken: string, ipAddress: string, userAgent: string): Promise<void> {
    // Revoke refresh token
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        token: refreshToken,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.logAuditEvent(userId, AuditAction.LOGOUT, {}, ipAddress, userAgent);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Revoke old refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    return this.generateTokens(storedToken.user.id, storedToken.user.username, storedToken.user.role);
  }

  async getCurrentUser(userId: string): Promise<UserInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async validateUser(userId: string): Promise<UserInfo | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
      },
    });

    return user;
  }

  async getCurrentUserFromToken(accessToken: string): Promise<UserInfo> {
    try {
      const payload = this.jwtService.verify(accessToken) as { sub: string };
      return this.getCurrentUser(payload.sub);
    } catch {
      throw new Error('Invalid token');
    }
  }

  private async generateTokens(userId: string, username: string, role: string): Promise<AuthTokens> {
    const payload: TokenPayload = { sub: userId, username, role };

    const accessToken = this.jwtService.sign(payload);

    const refreshTokenValue = uuidv4();
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = dayjs().add(parseInt(refreshExpiresIn), 'day').toDate();

    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  private async logAuditEvent(
    userId: string | null,
    action: AuditAction,
    details: Prisma.InputJsonValue,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress,
        userAgent,
      },
    });
  }
}
