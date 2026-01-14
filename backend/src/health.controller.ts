import { Controller, Get } from '@nestjs/common';

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
