import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string, expiresIn: number) {
    // Access token - shorter expiry
    res.cookie('access_token', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: expiresIn * 1000, // Convert to milliseconds
    });

    // Refresh token - longer expiry (7 days)
    res.cookie('refresh_token', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearTokenCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const tokens = await this.authService.login(dto, ipAddress, userAgent);
    
    // Set cookies
    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);

    // Return user info immediately after login
    const user = await this.authService.getCurrentUserFromToken(tokens.accessToken);

    return { 
      message: 'Login successful',
      user,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      await this.authService.logout(user.id, refreshToken, ipAddress, userAgent);
    }

    this.clearTokenCookies(res);

    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      this.clearTokenCookies(res);
      return { message: 'No refresh token' };
    }

    try {
      const tokens = await this.authService.refreshTokens(refreshToken);
      this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);

      return { message: 'Tokens refreshed' };
    } catch {
      this.clearTokenCookies(res);
      throw new Error('Invalid refresh token');
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.id);
  }
}
