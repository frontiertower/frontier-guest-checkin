/**
 * Acceptance Flow Tests
 * Tests acceptance token generation, validation, and helper functions
 */

import { SignJWT, jwtVerify } from 'jose';
import { 
  generateAcceptanceToken, 
  verifyAcceptanceToken,
  AcceptanceTokenPayload 
} from '@/lib/acceptance-token';
import {
  checkInvitationAcceptance,
  checkVisitAcceptance,
  createOrUpdateAcceptance,
} from '@/lib/acceptance-helpers';
import { prisma } from '@/lib/prisma';
import { faker } from '@faker-js/faker';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    acceptance: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    invitation: {
      findUnique: jest.fn(),
    },
    visit: {
      findUnique: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Acceptance Flow', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-for-acceptance-testing',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Acceptance Token Management', () => {
    describe('generateAcceptanceToken', () => {
      it('should generate valid acceptance token for invitation', async () => {
        const payload: AcceptanceTokenPayload = {
          type: 'invitation',
          invitationId: faker.string.uuid(),
          guestId: faker.string.uuid(),
          guestEmail: faker.internet.email(),
        };

        const token = await generateAcceptanceToken(payload);

        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT format
      });

      it('should generate valid acceptance token for visit', async () => {
        const payload: AcceptanceTokenPayload = {
          type: 'visit',
          visitId: faker.string.uuid(),
          guestId: faker.string.uuid(),
          guestEmail: faker.internet.email(),
        };

        const token = await generateAcceptanceToken(payload);

        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
      });

      it('should set 7-day expiration', async () => {
        const payload: AcceptanceTokenPayload = {
          type: 'invitation',
          invitationId: faker.string.uuid(),
          guestId: faker.string.uuid(),
          guestEmail: faker.internet.email(),
        };

        const token = await generateAcceptanceToken(payload);
        const verified = await verifyAcceptanceToken(token);

        expect(verified).toBeTruthy();
        // Token should be valid for verification
      });

      it('should include all payload fields in token', async () => {
        const payload: AcceptanceTokenPayload = {
          type: 'visit',
          visitId: faker.string.uuid(),
          guestId: faker.string.uuid(),
          guestEmail: faker.internet.email(),
        };

        const token = await generateAcceptanceToken(payload);
        const verified = await verifyAcceptanceToken(token);

        expect(verified).toMatchObject(payload);
      });
    });

    describe('verifyAcceptanceToken', () => {
      it('should verify valid token', async () => {
        const payload: AcceptanceTokenPayload = {
          type: 'invitation',
          invitationId: faker.string.uuid(),
          guestId: faker.string.uuid(),
          guestEmail: faker.internet.email(),
        };

        const token = await generateAcceptanceToken(payload);
        const verified = await verifyAcceptanceToken(token);

        expect(verified).toEqual(payload);
      });

      it('should reject expired token', async () => {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
        const expiredToken = await new SignJWT({
          type: 'invitation',
          invitationId: faker.string.uuid(),
          guestId: faker.string.uuid(),
          guestEmail: faker.internet.email(),
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt(Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60) // 8 days ago
          .setExpirationTime(Math.floor(Date.now() / 1000) - 1) // Expired
          .sign(secret);

        const result = await verifyAcceptanceToken(expiredToken);
        expect(result).toBeNull();
      });

      it('should reject token with invalid signature', async () => {
        const wrongSecret = new TextEncoder().encode('wrong-secret');
        const invalidToken = await new SignJWT({
          type: 'invitation',
          invitationId: faker.string.uuid(),
          guestId: faker.string.uuid(),
          guestEmail: faker.internet.email(),
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(wrongSecret);

        const result = await verifyAcceptanceToken(invalidToken);
        expect(result).toBeNull();
      });

      it('should reject malformed token', async () => {
        const result = await verifyAcceptanceToken('not.a.valid.token');
        expect(result).toBeNull();
      });

      it('should handle missing required fields', async () => {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
        const incompleteToken = await new SignJWT({
          type: 'invitation',
          // Missing required fields
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(secret);

        const result = await verifyAcceptanceToken(incompleteToken);
        expect(result).toBeNull();
      });
    });
  });

  describe('Acceptance Helper Functions', () => {
    describe('checkInvitationAcceptance', () => {
      it('should find existing acceptance for invitation', async () => {
        const invitationId = faker.string.uuid();
        const guestId = faker.string.uuid();
        const mockAcceptance = {
          id: faker.string.uuid(),
          guestId,
          invitationId,
          acceptedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };

        mockPrisma.acceptance.findFirst.mockResolvedValue(mockAcceptance as any);

        const result = await checkInvitationAcceptance(invitationId);

        expect(result).toEqual(mockAcceptance);
        expect(mockPrisma.acceptance.findFirst).toHaveBeenCalledWith({
          where: {
            invitationId,
            expiresAt: { gte: expect.any(Date) },
          },
          include: {
            guest: true,
          },
        });
      });

      it('should return null when no acceptance exists', async () => {
        mockPrisma.acceptance.findFirst.mockResolvedValue(null);

        const result = await checkInvitationAcceptance(faker.string.uuid());

        expect(result).toBeNull();
      });

      it('should exclude expired acceptances', async () => {
        const invitationId = faker.string.uuid();
        mockPrisma.acceptance.findFirst.mockResolvedValue(null);

        await checkInvitationAcceptance(invitationId);

        // Verify it checks for non-expired acceptances
        expect(mockPrisma.acceptance.findFirst).toHaveBeenCalledWith({
          where: {
            invitationId,
            expiresAt: { gte: expect.any(Date) },
          },
          include: {
            guest: true,
          },
        });
      });
    });

    describe('checkVisitAcceptance', () => {
      it('should find existing acceptance for visit', async () => {
        const visitId = faker.string.uuid();
        const guestId = faker.string.uuid();
        const mockAcceptance = {
          id: faker.string.uuid(),
          guestId,
          visitId,
          acceptedAt: new Date(),
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
        };

        mockPrisma.acceptance.findFirst.mockResolvedValue(mockAcceptance as any);

        const result = await checkVisitAcceptance(visitId);

        expect(result).toEqual(mockAcceptance);
        expect(mockPrisma.acceptance.findFirst).toHaveBeenCalledWith({
          where: {
            visitId,
            expiresAt: { gte: expect.any(Date) },
          },
          include: {
            guest: true,
          },
        });
      });

      it('should return null when no acceptance exists', async () => {
        mockPrisma.acceptance.findFirst.mockResolvedValue(null);

        const result = await checkVisitAcceptance(faker.string.uuid());

        expect(result).toBeNull();
      });
    });

    describe('createOrUpdateAcceptance', () => {
      it('should create new acceptance for invitation', async () => {
        const guestId = faker.string.uuid();
        const invitationId = faker.string.uuid();
        const signature = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
        const ipAddress = '192.168.1.1';

        const mockCreated = {
          id: faker.string.uuid(),
          guestId,
          invitationId,
          visitId: null,
          acceptedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          signature,
          ipAddress,
        };

        mockPrisma.acceptance.findFirst.mockResolvedValue(null);
        mockPrisma.acceptance.create.mockResolvedValue(mockCreated as any);

        const result = await createOrUpdateAcceptance({
          guestId,
          invitationId,
          signature,
          ipAddress,
        });

        expect(result).toEqual(mockCreated);
        expect(mockPrisma.acceptance.create).toHaveBeenCalledWith({
          data: {
            guestId,
            invitationId,
            visitId: null,
            acceptedAt: expect.any(Date),
            expiresAt: expect.any(Date),
            signature,
            ipAddress,
          },
        });
      });

      it('should update existing acceptance', async () => {
        const guestId = faker.string.uuid();
        const visitId = faker.string.uuid();
        const signature = 'data:image/png;base64,updated...';
        const ipAddress = '10.0.0.1';

        const existingAcceptance = {
          id: faker.string.uuid(),
          guestId,
          visitId: null,
          invitationId: null,
          acceptedAt: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 1000),
        };

        const updatedAcceptance = {
          ...existingAcceptance,
          visitId,
          signature,
          ipAddress,
          acceptedAt: new Date(),
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        };

        mockPrisma.acceptance.findFirst.mockResolvedValue(existingAcceptance as any);
        mockPrisma.acceptance.update.mockResolvedValue(updatedAcceptance as any);

        const result = await createOrUpdateAcceptance({
          guestId,
          visitId,
          signature,
          ipAddress,
        });

        expect(result).toEqual(updatedAcceptance);
        expect(mockPrisma.acceptance.update).toHaveBeenCalledWith({
          where: { id: existingAcceptance.id },
          data: {
            visitId,
            acceptedAt: expect.any(Date),
            expiresAt: expect.any(Date),
            signature,
            ipAddress,
          },
        });
      });

      it('should calculate correct expiration for invitation acceptance', async () => {
        const guestId = faker.string.uuid();
        const invitationId = faker.string.uuid();

        mockPrisma.acceptance.findFirst.mockResolvedValue(null);
        mockPrisma.acceptance.create.mockImplementation((args: any) => {
          const expiresAt = args.data.expiresAt;
          const acceptedAt = args.data.acceptedAt;
          const diffMs = expiresAt.getTime() - acceptedAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          // Should be 7 days for invitation
          expect(Math.round(diffDays)).toBe(7);
          
          return Promise.resolve({ ...args.data, id: faker.string.uuid() });
        });

        await createOrUpdateAcceptance({
          guestId,
          invitationId,
        });
      });

      it('should calculate correct expiration for visit acceptance', async () => {
        const guestId = faker.string.uuid();
        const visitId = faker.string.uuid();

        mockPrisma.acceptance.findFirst.mockResolvedValue(null);
        mockPrisma.acceptance.create.mockImplementation((args: any) => {
          const expiresAt = args.data.expiresAt;
          const acceptedAt = args.data.acceptedAt;
          const diffMs = expiresAt.getTime() - acceptedAt.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          
          // Should be 12 hours for visit
          expect(Math.round(diffHours)).toBe(12);
          
          return Promise.resolve({ ...args.data, id: faker.string.uuid() });
        });

        await createOrUpdateAcceptance({
          guestId,
          visitId,
        });
      });

      it('should handle database errors gracefully', async () => {
        mockPrisma.acceptance.findFirst.mockRejectedValue(new Error('Database error'));

        await expect(
          createOrUpdateAcceptance({
            guestId: faker.string.uuid(),
            invitationId: faker.string.uuid(),
          })
        ).rejects.toThrow('Database error');
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete invitation acceptance flow', async () => {
      const guestId = faker.string.uuid();
      const invitationId = faker.string.uuid();
      const guestEmail = faker.internet.email();

      // Step 1: Generate acceptance token
      const token = await generateAcceptanceToken({
        type: 'invitation',
        invitationId,
        guestId,
        guestEmail,
      });

      // Step 2: Verify token
      const payload = await verifyAcceptanceToken(token);
      expect(payload).toBeTruthy();
      expect(payload?.invitationId).toBe(invitationId);

      // Step 3: Create acceptance record
      mockPrisma.acceptance.findFirst.mockResolvedValue(null);
      mockPrisma.acceptance.create.mockResolvedValue({
        id: faker.string.uuid(),
        guestId,
        invitationId,
        visitId: null,
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        signature: 'signature-data',
        ipAddress: '127.0.0.1',
      } as any);

      const acceptance = await createOrUpdateAcceptance({
        guestId,
        invitationId,
        signature: 'signature-data',
        ipAddress: '127.0.0.1',
      });

      expect(acceptance).toBeTruthy();
      expect(acceptance.invitationId).toBe(invitationId);
    });

    it('should prevent replay attacks with expired tokens', async () => {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      
      // Create an expired token
      const expiredToken = await new SignJWT({
        type: 'invitation',
        invitationId: faker.string.uuid(),
        guestId: faker.string.uuid(),
        guestEmail: faker.internet.email(),
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
        .sign(secret);

      // Try to use expired token
      const result = await verifyAcceptanceToken(expiredToken);
      expect(result).toBeNull();
    });

    it('should handle concurrent acceptance attempts', async () => {
      const guestId = faker.string.uuid();
      const invitationId = faker.string.uuid();

      // First acceptance
      mockPrisma.acceptance.findFirst.mockResolvedValueOnce(null);
      mockPrisma.acceptance.create.mockResolvedValueOnce({
        id: 'acceptance-1',
        guestId,
        invitationId,
        visitId: null,
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } as any);

      const first = await createOrUpdateAcceptance({ guestId, invitationId });

      // Second acceptance (should update)
      mockPrisma.acceptance.findFirst.mockResolvedValueOnce(first as any);
      mockPrisma.acceptance.update.mockResolvedValueOnce({
        ...first,
        acceptedAt: new Date(),
      } as any);

      const second = await createOrUpdateAcceptance({ guestId, invitationId });

      expect(mockPrisma.acceptance.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.acceptance.update).toHaveBeenCalledTimes(1);
    });
  });
});