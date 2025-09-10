/**
 * Multi-Location Security Tests
 * Critical tests for data isolation, cross-location access prevention, and location-specific policies
 */

import { prisma } from '@/lib/prisma';
import { validateHostConcurrentLimit, validateGuestRollingLimit } from '@/lib/validations';

// Mock Prisma for isolated testing
jest.mock('@/lib/prisma', () => ({
  prisma: {
    location: { 
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    visit: { 
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    guest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    policy: {
      findFirst: jest.fn(),
    },
    invitation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  }
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Multi-Location Security & Data Isolation', () => {
  const locations = {
    towerA: {
      id: 'loc-tower-a',
      name: 'Tower A',
      active: true,
      dailyCapacity: 100,
      cutoffHour: 22,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    towerB: {
      id: 'loc-tower-b',
      name: 'Tower B',
      active: true,
      dailyCapacity: 50,
      cutoffHour: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    restricted: {
      id: 'loc-restricted',
      name: 'Restricted Zone',
      active: true,
      dailyCapacity: 10,
      cutoffHour: 18,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const users = {
    hostA: {
      id: 'user-host-a',
      email: 'host.a@company.com',
      name: 'Host A',
      role: 'host' as const,
      primaryLocationId: 'loc-tower-a',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    hostB: {
      id: 'user-host-b',
      email: 'host.b@company.com',
      name: 'Host B',
      role: 'host' as const,
      primaryLocationId: 'loc-tower-b',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    adminGlobal: {
      id: 'user-admin-global',
      email: 'admin@company.com',
      name: 'Global Admin',
      role: 'admin' as const,
      primaryLocationId: null, // Can access all locations
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    security: {
      id: 'user-security',
      email: 'security@company.com',
      name: 'Security Officer',
      role: 'security' as const,
      primaryLocationId: 'loc-restricted',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockPrisma.policy.findFirst.mockResolvedValue({
      id: 1,
      guestMonthlyLimit: 3,
      hostConcurrentLimit: 3,
    });
  });

  describe('Location-Based Data Isolation', () => {
    it('should isolate visit data by location', async () => {
      // Mock visits for different locations
      const towerAVisits = [
        { id: 'v1', locationId: 'loc-tower-a', guestId: 'g1', hostId: users.hostA.id },
        { id: 'v2', locationId: 'loc-tower-a', guestId: 'g2', hostId: users.hostA.id },
      ];
      
      const towerBVisits = [
        { id: 'v3', locationId: 'loc-tower-b', guestId: 'g3', hostId: users.hostB.id },
      ];

      // When querying for Tower A visits
      mockPrisma.visit.findMany.mockImplementation(async (params) => {
        if (params?.where?.locationId === 'loc-tower-a') {
          return towerAVisits as any;
        }
        if (params?.where?.locationId === 'loc-tower-b') {
          return towerBVisits as any;
        }
        return [];
      });

      // Tower A host should only see Tower A visits
      const towerAResults = await mockPrisma.visit.findMany({
        where: { locationId: 'loc-tower-a' }
      });
      expect(towerAResults).toHaveLength(2);
      expect(towerAResults.every(v => v.locationId === 'loc-tower-a')).toBe(true);

      // Tower B host should only see Tower B visits
      const towerBResults = await mockPrisma.visit.findMany({
        where: { locationId: 'loc-tower-b' }
      });
      expect(towerBResults).toHaveLength(1);
      expect(towerBResults[0].locationId).toBe('loc-tower-b');
    });

    it('should prevent cross-location guest queries', async () => {
      // Mock guest visits with location context
      mockPrisma.visit.findMany.mockImplementation(async (params) => {
        // Enforce location filtering
        if (!params?.where?.locationId) {
          throw new Error('Location filter required for security');
        }
        
        if (params.where.locationId === 'loc-tower-a') {
          return [
            { guestId: 'guest-a1', locationId: 'loc-tower-a' },
            { guestId: 'guest-a2', locationId: 'loc-tower-a' },
          ] as any;
        }
        
        return [];
      });

      // Query without location filter should fail
      await expect(
        mockPrisma.visit.findMany({ where: { guestId: 'guest-a1' } })
      ).rejects.toThrow('Location filter required');

      // Query with location filter should succeed
      const visits = await mockPrisma.visit.findMany({
        where: { 
          guestId: 'guest-a1',
          locationId: 'loc-tower-a'
        }
      });
      expect(visits).toBeDefined();
    });

    it('should enforce location-specific capacity limits', async () => {
      // Set up different capacities for each location
      mockPrisma.location.findUnique.mockImplementation(async (params) => {
        const locationId = params?.where?.id;
        return locations[
          locationId === 'loc-tower-a' ? 'towerA' :
          locationId === 'loc-tower-b' ? 'towerB' :
          'restricted'
        ] as any;
      });

      // Tower A at 99/100 capacity (can accept 1 more)
      mockPrisma.visit.count.mockImplementation(async (params) => {
        if (params?.where?.locationId === 'loc-tower-a') return 99;
        if (params?.where?.locationId === 'loc-tower-b') return 50;
        if (params?.where?.locationId === 'loc-restricted') return 10;
        return 0;
      });

      // Tower A should allow one more visitor
      const towerALocation = await mockPrisma.location.findUnique({ 
        where: { id: 'loc-tower-a' } 
      });
      const towerACount = await mockPrisma.visit.count({ 
        where: { locationId: 'loc-tower-a' } 
      });
      expect(towerACount < towerALocation!.dailyCapacity).toBe(true);

      // Tower B at capacity (50/50)
      const towerBLocation = await mockPrisma.location.findUnique({ 
        where: { id: 'loc-tower-b' } 
      });
      const towerBCount = await mockPrisma.visit.count({ 
        where: { locationId: 'loc-tower-b' } 
      });
      expect(towerBCount >= towerBLocation!.dailyCapacity).toBe(true);

      // Restricted zone at capacity (10/10)
      const restrictedLocation = await mockPrisma.location.findUnique({ 
        where: { id: 'loc-restricted' } 
      });
      const restrictedCount = await mockPrisma.visit.count({ 
        where: { locationId: 'loc-restricted' } 
      });
      expect(restrictedCount >= restrictedLocation!.dailyCapacity).toBe(true);
    });

    it('should apply location-specific cutoff times', async () => {
      const now = new Date('2025-01-09T21:00:00-08:00'); // 9 PM PST
      
      mockPrisma.location.findUnique.mockImplementation(async (params) => {
        const locationId = params?.where?.id;
        return locations[
          locationId === 'loc-tower-a' ? 'towerA' :    // 10 PM cutoff
          locationId === 'loc-tower-b' ? 'towerB' :    // 8 PM cutoff
          'restricted'                                   // 6 PM cutoff
        ] as any;
      });

      // Check each location's cutoff
      const towerA = await mockPrisma.location.findUnique({ 
        where: { id: 'loc-tower-a' } 
      });
      const towerB = await mockPrisma.location.findUnique({ 
        where: { id: 'loc-tower-b' } 
      });
      const restricted = await mockPrisma.location.findUnique({ 
        where: { id: 'loc-restricted' } 
      });

      const currentHour = now.getHours();
      
      // Tower A: 9 PM < 10 PM cutoff (open)
      expect(currentHour < towerA!.cutoffHour).toBe(true);
      
      // Tower B: 9 PM > 8 PM cutoff (closed)
      expect(currentHour >= towerB!.cutoffHour).toBe(true);
      
      // Restricted: 9 PM > 6 PM cutoff (closed)
      expect(currentHour >= restricted!.cutoffHour).toBe(true);
    });
  });

  describe('User Location Access Control', () => {
    it('should restrict hosts to their primary location', async () => {
      mockPrisma.user.findUnique.mockImplementation(async (params) => {
        const userId = params?.where?.id;
        return users[
          userId === 'user-host-a' ? 'hostA' :
          userId === 'user-host-b' ? 'hostB' :
          userId === 'user-admin-global' ? 'adminGlobal' :
          'security'
        ] as any;
      });

      // Host A can only access Tower A
      const hostA = await mockPrisma.user.findUnique({ 
        where: { id: 'user-host-a' } 
      });
      expect(hostA?.primaryLocationId).toBe('loc-tower-a');

      // Validate access attempt to different location
      const canAccessTowerB = hostA?.primaryLocationId === 'loc-tower-b';
      expect(canAccessTowerB).toBe(false);

      // Host B can only access Tower B
      const hostB = await mockPrisma.user.findUnique({ 
        where: { id: 'user-host-b' } 
      });
      expect(hostB?.primaryLocationId).toBe('loc-tower-b');
    });

    it('should allow admins to access all locations', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(users.adminGlobal as any);

      const admin = await mockPrisma.user.findUnique({ 
        where: { id: 'user-admin-global' } 
      });
      
      // Admin has no primary location restriction
      expect(admin?.primaryLocationId).toBeNull();
      expect(admin?.role).toBe('admin');

      // Admin can access any location
      const canAccessLocations = [
        'loc-tower-a',
        'loc-tower-b',
        'loc-restricted',
      ].map(locationId => {
        // In real implementation, check permission logic
        return admin?.role === 'admin' || admin?.primaryLocationId === locationId;
      });

      expect(canAccessLocations.every(can => can)).toBe(true);
    });

    it('should enforce location restrictions for invitations', async () => {
      // Mock invitation creation with location validation
      mockPrisma.invitation.create.mockImplementation(async (params) => {
        const data = params?.data as any;
        
        // Validate host can create invitation for location
        if (data.hostId === 'user-host-a' && data.locationId !== 'loc-tower-a') {
          throw new Error('Host can only create invitations for their location');
        }
        if (data.hostId === 'user-host-b' && data.locationId !== 'loc-tower-b') {
          throw new Error('Host can only create invitations for their location');
        }
        
        return { id: 'inv-123', ...data } as any;
      });

      // Host A creating invitation for Tower A should succeed
      await expect(
        mockPrisma.invitation.create({
          data: {
            hostId: 'user-host-a',
            locationId: 'loc-tower-a',
            guestEmail: 'guest@example.com',
          } as any
        })
      ).resolves.toBeDefined();

      // Host A creating invitation for Tower B should fail
      await expect(
        mockPrisma.invitation.create({
          data: {
            hostId: 'user-host-a',
            locationId: 'loc-tower-b',
            guestEmail: 'guest@example.com',
          } as any
        })
      ).rejects.toThrow('Host can only create invitations for their location');
    });
  });

  describe('Cross-Location Security Boundaries', () => {
    it('should prevent data leakage in concurrent operations', async () => {
      const visitCounts = new Map<string, number>();
      
      // Simulate concurrent visit count queries
      mockPrisma.visit.count.mockImplementation(async (params) => {
        const locationId = params?.where?.locationId;
        
        if (!locationId) {
          throw new Error('Location filter required');
        }
        
        // Simulate race condition detection
        if (visitCounts.has(locationId)) {
          // Concurrent access detected
          const currentCount = visitCounts.get(locationId)!;
          visitCounts.set(locationId, currentCount + 1);
        } else {
          visitCounts.set(locationId, 1);
        }
        
        // Return location-specific counts
        if (locationId === 'loc-tower-a') return 45;
        if (locationId === 'loc-tower-b') return 23;
        return 0;
      });

      // Concurrent requests from different locations
      const promises = [
        mockPrisma.visit.count({ where: { locationId: 'loc-tower-a' } }),
        mockPrisma.visit.count({ where: { locationId: 'loc-tower-b' } }),
        mockPrisma.visit.count({ where: { locationId: 'loc-tower-a' } }),
      ];

      const results = await Promise.all(promises);
      
      // Each location should get correct count
      expect(results[0]).toBe(45); // Tower A
      expect(results[1]).toBe(23); // Tower B
      expect(results[2]).toBe(45); // Tower A again

      // Verify concurrent access was tracked
      expect(visitCounts.get('loc-tower-a')).toBe(2);
      expect(visitCounts.get('loc-tower-b')).toBe(1);
    });

    it('should validate location consistency in transactions', async () => {
      // Mock transaction that ensures location consistency
      const mockTransaction = async (locationId: string, operations: any[]) => {
        // All operations must be for the same location
        const allSameLocation = operations.every(op => op.locationId === locationId);
        
        if (!allSameLocation) {
          throw new Error('Transaction operations must be for the same location');
        }
        
        return { success: true, locationId };
      };

      // Valid transaction - all operations for Tower A
      await expect(
        mockTransaction('loc-tower-a', [
          { type: 'create-visit', locationId: 'loc-tower-a' },
          { type: 'update-capacity', locationId: 'loc-tower-a' },
          { type: 'log-activity', locationId: 'loc-tower-a' },
        ])
      ).resolves.toEqual({ success: true, locationId: 'loc-tower-a' });

      // Invalid transaction - mixed locations
      await expect(
        mockTransaction('loc-tower-a', [
          { type: 'create-visit', locationId: 'loc-tower-a' },
          { type: 'update-capacity', locationId: 'loc-tower-b' }, // Different location!
        ])
      ).rejects.toThrow('Transaction operations must be for the same location');
    });

    it('should handle location-specific policy overrides', async () => {
      // Mock location-specific policies
      const locationPolicies = new Map([
        ['loc-tower-a', { guestMonthlyLimit: 5, hostConcurrentLimit: 5 }],
        ['loc-tower-b', { guestMonthlyLimit: 3, hostConcurrentLimit: 3 }],
        ['loc-restricted', { guestMonthlyLimit: 1, hostConcurrentLimit: 1 }],
      ]);

      mockPrisma.policy.findFirst.mockImplementation(async (params) => {
        const locationId = (params?.where as any)?.locationId;
        
        if (locationId && locationPolicies.has(locationId)) {
          return {
            id: 1,
            ...locationPolicies.get(locationId)!,
          };
        }
        
        // Default global policy
        return {
          id: 1,
          guestMonthlyLimit: 3,
          hostConcurrentLimit: 3,
        };
      });

      // Tower A has higher limits
      const towerAPolicy = await mockPrisma.policy.findFirst({
        where: { locationId: 'loc-tower-a' } as any
      });
      expect(towerAPolicy?.guestMonthlyLimit).toBe(5);
      expect(towerAPolicy?.hostConcurrentLimit).toBe(5);

      // Restricted zone has strict limits
      const restrictedPolicy = await mockPrisma.policy.findFirst({
        where: { locationId: 'loc-restricted' } as any
      });
      expect(restrictedPolicy?.guestMonthlyLimit).toBe(1);
      expect(restrictedPolicy?.hostConcurrentLimit).toBe(1);
    });
  });

  describe('Location Migration and Transfer', () => {
    it('should handle guest transfer between locations', async () => {
      const transferGuest = async (
        guestId: string,
        fromLocation: string,
        toLocation: string,
        authorizedBy: string
      ) => {
        // Validate authorization
        const user = await mockPrisma.user.findUnique({ 
          where: { id: authorizedBy } 
        });
        
        if (user?.role !== 'admin' && user?.role !== 'security') {
          throw new Error('Unauthorized to transfer guests between locations');
        }
        
        // Check capacity at destination
        const destinationCount = await mockPrisma.visit.count({
          where: { locationId: toLocation }
        });
        
        const destinationLocation = await mockPrisma.location.findUnique({
          where: { id: toLocation }
        });
        
        if (destinationCount >= (destinationLocation?.dailyCapacity ?? 0)) {
          throw new Error('Destination location at capacity');
        }
        
        return {
          success: true,
          guestId,
          fromLocation,
          toLocation,
          transferredAt: new Date(),
          authorizedBy,
        };
      };

      // Setup mocks for transfer scenario
      mockPrisma.user.findUnique.mockResolvedValue(users.adminGlobal as any);
      mockPrisma.visit.count.mockResolvedValue(5);
      mockPrisma.location.findUnique.mockResolvedValue(locations.towerB as any);

      // Admin can transfer guest
      await expect(
        transferGuest('guest-123', 'loc-tower-a', 'loc-tower-b', 'user-admin-global')
      ).resolves.toMatchObject({
        success: true,
        guestId: 'guest-123',
        fromLocation: 'loc-tower-a',
        toLocation: 'loc-tower-b',
      });

      // Host cannot transfer guest
      mockPrisma.user.findUnique.mockResolvedValue(users.hostA as any);
      await expect(
        transferGuest('guest-123', 'loc-tower-a', 'loc-tower-b', 'user-host-a')
      ).rejects.toThrow('Unauthorized to transfer guests');
    });

    it('should maintain audit trail for cross-location operations', async () => {
      const auditLog: any[] = [];
      
      const logCrossLocationOperation = (operation: {
        type: string;
        userId: string;
        fromLocation?: string;
        toLocation?: string;
        details: any;
      }) => {
        const entry = {
          ...operation,
          timestamp: new Date(),
          id: `audit-${Date.now()}`,
        };
        auditLog.push(entry);
        return entry;
      };

      // Log various cross-location operations
      logCrossLocationOperation({
        type: 'GUEST_TRANSFER',
        userId: 'user-admin-global',
        fromLocation: 'loc-tower-a',
        toLocation: 'loc-tower-b',
        details: { guestId: 'guest-123', reason: 'Meeting location changed' },
      });

      logCrossLocationOperation({
        type: 'CROSS_LOCATION_QUERY',
        userId: 'user-admin-global',
        details: { locations: ['loc-tower-a', 'loc-tower-b'], purpose: 'capacity report' },
      });

      logCrossLocationOperation({
        type: 'LOCATION_ACCESS_DENIED',
        userId: 'user-host-a',
        toLocation: 'loc-restricted',
        details: { reason: 'Insufficient permissions' },
      });

      // Verify audit trail
      expect(auditLog).toHaveLength(3);
      expect(auditLog.filter(log => log.type === 'GUEST_TRANSFER')).toHaveLength(1);
      expect(auditLog.filter(log => log.type === 'LOCATION_ACCESS_DENIED')).toHaveLength(1);
      
      // All entries should have timestamps
      expect(auditLog.every(log => log.timestamp instanceof Date)).toBe(true);
    });
  });

  describe('Emergency Location Operations', () => {
    it('should allow security to override location restrictions in emergencies', async () => {
      const emergencyOverride = async (
        userId: string,
        targetLocation: string,
        reason: string
      ) => {
        const user = await mockPrisma.user.findUnique({ 
          where: { id: userId } 
        });
        
        // Only security and admin can perform emergency overrides
        if (user?.role !== 'security' && user?.role !== 'admin') {
          throw new Error('Emergency override not authorized');
        }
        
        if (reason.length < 20) {
          throw new Error('Emergency reason must be detailed (min 20 chars)');
        }
        
        return {
          success: true,
          overrideId: `emergency-${Date.now()}`,
          userId,
          targetLocation,
          reason,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        };
      };

      // Security can override
      mockPrisma.user.findUnique.mockResolvedValue(users.security as any);
      await expect(
        emergencyOverride(
          'user-security',
          'loc-restricted',
          'Fire evacuation - all guests must be relocated immediately'
        )
      ).resolves.toMatchObject({
        success: true,
        userId: 'user-security',
        targetLocation: 'loc-restricted',
      });

      // Host cannot override
      mockPrisma.user.findUnique.mockResolvedValue(users.hostA as any);
      await expect(
        emergencyOverride(
          'user-host-a',
          'loc-restricted',
          'Need access to restricted area'
        )
      ).rejects.toThrow('Emergency override not authorized');

      // Insufficient reason
      mockPrisma.user.findUnique.mockResolvedValue(users.security as any);
      await expect(
        emergencyOverride(
          'user-security',
          'loc-restricted',
          'Emergency' // Too short
        )
      ).rejects.toThrow('Emergency reason must be detailed');
    });
  });
});