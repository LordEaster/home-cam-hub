import { Injectable } from '@nestjs/common';
import * as dayjs from 'dayjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, AuditLog, Prisma } from '@prisma/client';

interface AuditQuery {
  userId?: string;
  cameraId?: string;
  action?: AuditAction;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogWithRelations extends AuditLog {
  user: { id: string; username: string; displayName: string } | null;
  camera: { id: string; name: string } | null;
}

export interface PaginatedAuditLogs {
  items: AuditLogWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AuditQuery): Promise<PaginatedAuditLogs> {
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.cameraId) {
      where.cameraId = query.cameraId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = dayjs(query.startDate).toDate();
      }
      if (query.endDate) {
        where.createdAt.lte = dayjs(query.endDate).toDate();
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, displayName: true },
          },
          camera: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async log(
    userId: string | null,
    cameraId: string | null,
    action: AuditAction,
    details: Prisma.InputJsonValue,
    ipAddress: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        cameraId,
        action,
        details,
        ipAddress,
        userAgent,
      },
    });
  }
}
