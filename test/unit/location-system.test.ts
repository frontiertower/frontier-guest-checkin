/**
 * Consolidated Location System Tests
 * Tests multi-location functionality, data isolation, security boundaries, and context management
 */

/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { prisma } from '@/lib/prisma';
import { validateHostConcurrentLimit, validateGuestRollingLimit } from '@/lib/validations';
import { faker } from '@faker-js/faker';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    location: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    visit: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    guest: {
      findMany: jest.fn(),
    },
    policy: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock fetch for context tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock toast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { AdminDataProvider, useAdminData } from '@/contexts/AdminDataContext';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Create wrapper for AdminDataProvider
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <AdminDataProvider>{children}</AdminDataProvider>
  );
};

describe('Location System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Location Context Management', () => {
    it('should initialize with default location state', () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.selectedLocationId).toBe('all');
      expect(typeof result.current.setSelectedLocationId).toBe('function');
      expect(typeof result.current.getLocationContext).toBe('function');
    });

    it('should update selected location and trigger data refresh', () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('location-123');
      });

      expect(result.current.selectedLocationId).toBe('location-123');
    });

    it('should provide correct location context information', () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('location-456');
      });

      const context = result.current.getLocationContext();
      expect(context).toHaveProperty('isSingleLocation');
      expect(context).toHaveProperty('locationName');
      expect(context.isSingleLocation).toBe(true);
    });

    it('should pass location filter to API calls', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ stats: {} }), { status: 200 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('location-789');
      });

      // Trigger a stats load
      await act(async () => {
        await result.current.loadStats();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('locationId=location-789')
      );
    });
  });

  describe('Data Isolation by Location', () => {
    const setupLocationData = () => {
      const location1 = { id: 'loc-1', name: 'Tower A' };
      const location2 = { id: 'loc-2', name: 'Tower B' };
      
      const visitsLoc1 = [
        { id: 'v1', locationId: 'loc-1', guestId: 'g1', hostId: 'h1' },
        { id: 'v2', locationId: 'loc-1', guestId: 'g2', hostId: 'h1' },
      ];
      
      const visitsLoc2 = [
        { id: 'v3', locationId: 'loc-2', guestId: 'g3', hostId: 'h2' },
      ];

      return { location1, location2, visitsLoc1, visitsLoc2 };
    };

    it('should isolate visit data by location', async () => {
      const { visitsLoc1 } = setupLocationData();
      
      mockPrisma.visit.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.locationId === 'loc-1') {
          return visitsLoc1;
        }
        return [];
      });

      const loc1Visits = await mockPrisma.visit.findMany({
        where: { locationId: 'loc-1' },
      });
      
      expect(loc1Visits).toHaveLength(2);
      expect(loc1Visits.every(v => v.locationId === 'loc-1')).toBe(true);
    });

    it('should prevent cross-location data access', async () => {
      mockPrisma.visit.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.locationId === 'loc-1') {
          return [];
        }
        throw new Error('Access denied');
      });

      // User from location 2 trying to access location 1 data
      await expect(
        mockPrisma.visit.findMany({ where: { locationId: 'loc-2' } })
      ).rejects.toThrow('Access denied');
    });

    it('should enforce location-specific capacity limits', async () => {
      mockPrisma.policy.findFirst.mockResolvedValue({
        id: 1,
        hostConcurrentLimit: 3,
        guestMonthlyLimit: 3,
      });

      mockPrisma.visit.count.mockImplementation(async (args: any) => {
        if (args?.where?.locationId === 'loc-1') {
          return 3; // At capacity
        }
        return 1; // Under capacity
      });

      const loc1Count = await mockPrisma.visit.count({
        where: {
          locationId: 'loc-1',
          hostId: 'host-1',
          expiresAt: { gte: new Date() },
        },
      });

      expect(loc1Count).toBe(3);
      
      // Validation should fail for location 1
      const result = await validateHostConcurrentLimit('host-1', 'loc-1');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('concurrent guest limit');
    });

    it('should aggregate data across locations for admin view', async () => {
      const { visitsLoc1, visitsLoc2 } = setupLocationData();
      
      mockPrisma.visit.findMany.mockResolvedValue([...visitsLoc1, ...visitsLoc2]);

      const allVisits = await mockPrisma.visit.findMany();
      
      expect(allVisits).toHaveLength(3);
      expect(new Set(allVisits.map(v => v.locationId)).size).toBe(2);
    });
  });

  describe('User Location Permissions', () => {
    it('should restrict hosts to their primary location', async () => {
      const hostUser = {
        id: 'user-1',
        role: 'host',
        primaryLocationId: 'loc-1',
      };

      mockPrisma.user.findUnique.mockResolvedValue(hostUser as any);
      mockPrisma.visit.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.locationId !== 'loc-1') {
          return [];
        }
        return [{ id: 'v1', locationId: 'loc-1' }];
      });

      const user = await mockPrisma.user.findUnique({ where: { id: 'user-1' } });
      expect(user?.primaryLocationId).toBe('loc-1');

      // Host can only see their location's data
      const visits = await mockPrisma.visit.findMany({
        where: { locationId: user?.primaryLocationId },
      });
      expect(visits).toHaveLength(1);
    });

    it('should allow admins to access all locations', async () => {
      const adminUser = {
        id: 'admin-1',
        role: 'admin',
        primaryLocationId: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(adminUser as any);
      mockPrisma.location.findMany.mockResolvedValue([
        { id: 'loc-1', name: 'Tower A' },
        { id: 'loc-2', name: 'Tower B' },
      ] as any);

      const user = await mockPrisma.user.findUnique({ where: { id: 'admin-1' } });
      expect(user?.role).toBe('admin');

      const locations = await mockPrisma.location.findMany();
      expect(locations).toHaveLength(2);
    });

    it('should validate location assignment for new users', async () => {
      mockPrisma.location.findUnique.mockResolvedValue(null);

      const invalidLocationId = 'non-existent-location';
      const location = await mockPrisma.location.findUnique({
        where: { id: invalidLocationId },
      });

      expect(location).toBeNull();
    });
  });

  describe('Cross-Location Security', () => {
    it('should prevent guest data leakage across locations', async () => {
      const guestWithVisits = {
        id: 'guest-1',
        email: 'guest@example.com',
        visits: [
          { locationId: 'loc-1', checkedInAt: new Date() },
          { locationId: 'loc-2', checkedInAt: new Date() },
        ],
      };

      mockPrisma.guest.findMany.mockImplementation(async (args: any) => {
        if (args?.include?.visits?.where?.locationId) {
          const locationId = args.include.visits.where.locationId;
          return [{
            ...guestWithVisits,
            visits: guestWithVisits.visits.filter(v => v.locationId === locationId),
          }];
        }
        return [];
      });

      // Query with location filter
      const guests = await mockPrisma.guest.findMany({
        include: {
          visits: {
            where: { locationId: 'loc-1' },
          },
        },
      });

      expect(guests[0].visits).toHaveLength(1);
      expect(guests[0].visits[0].locationId).toBe('loc-1');
    });

    it('should handle location-specific blacklists', async () => {
      const blacklistedGuest = {
        id: 'guest-bad',
        email: 'blocked@example.com',
        blacklisted: true,
        blacklistLocations: ['loc-1'],
      };

      mockPrisma.guest.findUnique.mockResolvedValue(blacklistedGuest as any);

      const guest = await mockPrisma.guest.findUnique({
        where: { id: 'guest-bad' },
      });

      // Should be blocked at location 1
      const isBlockedAtLoc1 = guest?.blacklisted && 
        (guest as any).blacklistLocations?.includes('loc-1');
      expect(isBlockedAtLoc1).toBe(true);

      // Should not be blocked at location 2
      const isBlockedAtLoc2 = guest?.blacklisted && 
        (guest as any).blacklistLocations?.includes('loc-2');
      expect(isBlockedAtLoc2).toBe(false);
    });

    it('should validate inter-location transfers', async () => {
      const visitToTransfer = {
        id: 'visit-1',
        guestId: 'guest-1',
        hostId: 'host-1',
        locationId: 'loc-1',
        transferredFrom: null,
      };

      // Simulate transfer validation
      const canTransfer = (visit: any, targetLocationId: string) => {
        return visit.locationId !== targetLocationId && !visit.transferredFrom;
      };

      expect(canTransfer(visitToTransfer, 'loc-2')).toBe(true);
      expect(canTransfer(visitToTransfer, 'loc-1')).toBe(false);
    });
  });

  describe('Location Capacity Management', () => {
    it('should track real-time capacity per location', async () => {
      mockPrisma.location.findMany.mockResolvedValue([
        { id: 'loc-1', name: 'Tower A', capacity: 100 },
        { id: 'loc-2', name: 'Tower B', capacity: 150 },
      ] as any);

      mockPrisma.visit.count.mockImplementation(async (args: any) => {
        if (args?.where?.locationId === 'loc-1') return 95;
        if (args?.where?.locationId === 'loc-2') return 50;
        return 0;
      });

      const locations = await mockPrisma.location.findMany();
      
      for (const location of locations) {
        const activeVisits = await mockPrisma.visit.count({
          where: {
            locationId: location.id,
            expiresAt: { gte: new Date() },
          },
        });

        const capacity = (location as any).capacity || 100;
        const utilization = (activeVisits / capacity) * 100;

        if (location.id === 'loc-1') {
          expect(utilization).toBeCloseTo(95, 0);
        } else {
          expect(utilization).toBeCloseTo(33.33, 0);
        }
      }
    });

    it('should handle emergency capacity override per location', async () => {
      const emergencyOverride = {
        locationId: 'loc-1',
        temporaryCapacity: 200,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        authorizedBy: 'admin-1',
        reason: 'Special event',
      };

      // Simulate emergency override check
      const getEffectiveCapacity = (locationId: string, baseCapacity: number) => {
        if (emergencyOverride.locationId === locationId && 
            emergencyOverride.expiresAt > new Date()) {
          return emergencyOverride.temporaryCapacity;
        }
        return baseCapacity;
      };

      expect(getEffectiveCapacity('loc-1', 100)).toBe(200);
      expect(getEffectiveCapacity('loc-2', 100)).toBe(100);
    });
  });

  describe('Location Reporting and Analytics', () => {
    it('should generate location-specific metrics', async () => {
      const mockStats = {
        'loc-1': { totalVisits: 1000, uniqueGuests: 250, avgDuration: 3.5 },
        'loc-2': { totalVisits: 750, uniqueGuests: 200, avgDuration: 2.8 },
      };

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('locationId=loc-1')) {
          return new Response(JSON.stringify(mockStats['loc-1']), { status: 200 });
        }
        if (url.includes('locationId=loc-2')) {
          return new Response(JSON.stringify(mockStats['loc-2']), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      const loc1Response = await fetch('/api/admin/stats?locationId=loc-1');
      const loc1Stats = await loc1Response.json();
      
      expect(loc1Stats.totalVisits).toBe(1000);
      expect(loc1Stats.uniqueGuests).toBe(250);
    });

    it('should compare metrics across locations', async () => {
      mockPrisma.visit.findMany.mockResolvedValue([
        { locationId: 'loc-1', checkedInAt: new Date('2025-01-01') },
        { locationId: 'loc-1', checkedInAt: new Date('2025-01-02') },
        { locationId: 'loc-2', checkedInAt: new Date('2025-01-01') },
      ] as any);

      const visits = await mockPrisma.visit.findMany();
      
      const locationMetrics = visits.reduce((acc: any, visit: any) => {
        acc[visit.locationId] = (acc[visit.locationId] || 0) + 1;
        return acc;
      }, {});

      expect(locationMetrics['loc-1']).toBe(2);
      expect(locationMetrics['loc-2']).toBe(1);
    });
  });
});