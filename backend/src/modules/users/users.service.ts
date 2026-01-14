import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User, Permission, UserRole } from '@prisma/client';

type UserWithoutPassword = Omit<User, 'passwordHash'>;

export interface UserPermissions {
  userId: string;
  permissions: Array<{
    cameraId: string;
    cameraName: string;
    canViewLive: boolean;
    canPlayback: boolean;
    canControl: boolean;
    canExport: boolean;
  }>;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserWithoutPassword[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map(({ passwordHash, ...user }) => user);
  }

  async findOne(id: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async create(dto: CreateUserDto): Promise<UserWithoutPassword> {
    // Check if username already exists
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new ConflictException('Username already exists');
    }

    // Check if email already exists
    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        displayName: dto.displayName,
        email: dto.email,
        role: dto.role || UserRole.USER,
        isActive: dto.isActive ?? true,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deactivating yourself
    if (id === currentUserId && dto.isActive === false) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }

    // Check username uniqueness if changing
    if (dto.username && dto.username !== user.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });

      if (existing) {
        throw new ConflictException('Username already exists');
      }
    }

    // Check email uniqueness if changing
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existing) {
        throw new ConflictException('Email already exists');
      }
    }

    const updateData: Record<string, unknown> = {};

    if (dto.username) updateData.username = dto.username;
    if (dto.displayName) updateData.displayName = dto.displayName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.role) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { passwordHash, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new ForbiddenException('Invalid current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }

  async getPermissions(userId: string): Promise<UserPermissions> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { userId },
      include: {
        camera: {
          select: { id: true, name: true },
        },
      },
    });

    return {
      userId,
      permissions: permissions.map((p) => ({
        cameraId: p.cameraId,
        cameraName: p.camera.name,
        canViewLive: p.canViewLive,
        canPlayback: p.canPlayback,
        canControl: p.canControl,
        canExport: p.canExport,
      })),
    };
  }

  async setPermissions(userId: string, dto: SetPermissionsDto): Promise<UserPermissions> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Upsert each permission
    for (const perm of dto.permissions) {
      await this.prisma.permission.upsert({
        where: {
          userId_cameraId: {
            userId,
            cameraId: perm.cameraId,
          },
        },
        update: {
          canViewLive: perm.canViewLive,
          canPlayback: perm.canPlayback,
          canControl: perm.canControl,
          canExport: perm.canExport,
        },
        create: {
          userId,
          cameraId: perm.cameraId,
          canViewLive: perm.canViewLive,
          canPlayback: perm.canPlayback,
          canControl: perm.canControl,
          canExport: perm.canExport,
        },
      });
    }

    return this.getPermissions(userId);
  }
}
