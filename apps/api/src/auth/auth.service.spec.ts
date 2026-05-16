import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: { findUnique: jest.fn() },
    userRole: { findMany: jest.fn() },
    rolePermission: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key.includes('Expires') ? '15m' : 'secret')) },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('getMeProfile', () => {
    it('returns sorted permission codes for the tenant', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@test.local',
        displayName: 'Admin',
      });
      prisma.userRole.findMany.mockResolvedValue([
        { roleId: 'role-1', role: { tenantId: 'tenant-1' } },
        { roleId: 'role-2', role: { tenantId: 'other' } },
      ]);
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { code: 'sales.write' } },
        { permission: { code: 'audit.read' } },
        { permission: { code: 'sales.read' } },
      ]);

      const profile = await service.getMeProfile('user-1', 'tenant-1');

      expect(profile.permissions).toEqual(['audit.read', 'sales.read', 'sales.write']);
      expect(profile.email).toBe('a@test.local');
      expect(profile.tenantId).toBe('tenant-1');
    });

    it('throws when user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMeProfile('missing', 'tenant-1')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
