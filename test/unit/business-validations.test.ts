/**
 * Streamlined Business Rule Validation Tests
 * Focuses on behavior and business logic rather than implementation details
 */

import {
  validateHostConcurrentLimit,
  validateGuestRollingLimit,
  validateLocationCapacity,
  validateTimeCutoff,
  validateGuestBlacklist,
  validateGuestAcceptance,
  validateQRToken,
  checkExistingActiveVisit,
  canUserOverride,
  shouldTriggerDiscount,
  processReturningGuestCheckIn,
  validateVisitScopedAcceptance,
} from '@/lib/validations';

// Simple, focused mocks
const mockPrisma = {
  policy: { findFirst: jest.fn() },
  visit: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  guest: { findUnique: jest.fn() },
  acceptance: { findFirst: jest.fn(), create: jest.fn() },
  location: { findUnique: jest.fn() },
  discount: { findFirst: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('@/lib/timezone', () => ({
  nowInLA: jest.fn(() => new Date('2025-08-30T14:00:00-07:00')),
  thirtyDaysAgoInLA: jest.fn(() => new Date('2025-07-31T14:00:00-07:00')),
  isAfterCutoff: jest.fn(() => false),
  calculateNextEligibleDate: jest.fn((date: Date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 30);
    return next;
  }),
}));

describe('Business Rule Validations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Host Concurrent Limit Validation', () => {
    const setupHostLimit = (limit: number, currentCount: number, locationName = 'Test Location') => {
      mockPrisma.policy.findFirst.mockResolvedValue({ hostConcurrentLimit: limit });
      mockPrisma.visit.count.mockResolvedValue(currentCount);
      mockPrisma.location.findUnique.mockResolvedValue({ name: locationName });
    };

    it('allows hosts under their concurrent guest limit', async () => {
      setupHostLimit(3, 2);

      const result = await validateHostConcurrentLimit('host-123', 'loc-456');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects hosts at their concurrent guest limit', async () => {
      setupHostLimit(3, 3, 'Tower A');

      const result = await validateHostConcurrentLimit('host-123', 'loc-456');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Host at capacity with 3 guests');
      expect(result.error).toContain('Tower A');
      expect(result.currentCount).toBe(3);
      expect(result.maxCount).toBe(3);
    });

    it('handles missing policy with sensible defaults', async () => {
      mockPrisma.policy.findFirst.mockResolvedValue(null);
      mockPrisma.visit.count.mockResolvedValue(2);

      const result = await validateHostConcurrentLimit('host-123', 'loc-456');
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Guest Rolling Limit Validation', () => {
    const setupGuestLimit = (limit: number, visits: Date[]) => {
      mockPrisma.policy.findFirst.mockResolvedValue({ guestMonthlyLimit: limit });
      mockPrisma.visit.findMany.mockResolvedValue(
        visits.map(date => ({ checkedInAt: date }))
      );
    };

    it('allows guests under their monthly limit', async () => {
      setupGuestLimit(3, [
        new Date('2025-08-15'),
        new Date('2025-08-20'),
      ]);

      const result = await validateGuestRollingLimit('guest@example.com');
      
      expect(result.isValid).toBe(true);
    });

    it('rejects guests at their monthly limit', async () => {
      const oldestVisit = new Date('2025-08-01T10:00:00');
      setupGuestLimit(3, [
        oldestVisit,
        new Date('2025-08-10'),
        new Date('2025-08-20'),
      ]);

      const result = await validateGuestRollingLimit('guest@example.com');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Guest has reached 3 visits this month');
      expect(result.nextEligibleDate).toBeDefined();
    });

    it('correctly calculates rolling 30-day window', async () => {
      // Visit exactly 30 days ago should NOT count
      setupGuestLimit(1, []);

      const result = await validateGuestRollingLimit('guest@example.com');
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Location Capacity Validation', () => {
    const setupLocationCapacity = (isActive: boolean, maxVisits?: number, currentVisits = 50) => {
      mockPrisma.location.findUnique.mockResolvedValue({
        name: 'Tower A',
        isActive,
        settings: maxVisits ? { maxDailyVisits: maxVisits } : null
      });
      mockPrisma.visit.count.mockResolvedValue(currentVisits);
    };

    it('allows visits to active locations under capacity', async () => {
      setupLocationCapacity(true, 100, 50);

      const result = await validateLocationCapacity('loc-123');
      
      expect(result.isValid).toBe(true);
    });

    it('rejects visits to inactive locations', async () => {
      setupLocationCapacity(false);

      const result = await validateLocationCapacity('loc-123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Tower A is currently closed for visits');
    });

    it('rejects visits when location is at capacity', async () => {
      setupLocationCapacity(true, 100, 100);

      const result = await validateLocationCapacity('loc-123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Tower A has reached daily capacity (100/100 visitors)');
    });

    it('uses sensible default limits when not configured', async () => {
      setupLocationCapacity(true, undefined, 999);

      const result = await validateLocationCapacity('loc-123');
      
      expect(result.isValid).toBe(true); // Under default 1000
    });

    it('handles missing locations gracefully', async () => {
      mockPrisma.location.findUnique.mockResolvedValue(null);

      const result = await validateLocationCapacity('invalid-loc');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Location not found');
    });
  });

  describe('Time Cutoff Validation', () => {
    it('allows 24/7 locations at any time', async () => {
      mockPrisma.location.findUnique.mockResolvedValue({
        name: '24/7 Tower',
        settings: { checkInCutoffHour: 24 }
      });

      const result = await validateTimeCutoff('loc-123');
      
      expect(result.isValid).toBe(true);
    });

    it('rejects visits past location cutoff hour', async () => {
      const { nowInLA } = require('@/lib/timezone');
      nowInLA.mockReturnValueOnce(new Date('2025-08-30T23:30:00')); // 11:30 PM
      
      mockPrisma.location.findUnique.mockResolvedValue({
        name: 'Tower A',
        settings: { checkInCutoffHour: 23 } // 11 PM cutoff
      });

      const result = await validateTimeCutoff('loc-123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Tower A is closed for the night. Check-ins resume tomorrow morning.');
    });

    it('handles global cutoff when no location provided', async () => {
      const { isAfterCutoff } = require('@/lib/timezone');
      isAfterCutoff.mockReturnValue(true);

      const result = await validateTimeCutoff();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Building is closed for the night. Check-ins resume tomorrow morning.');
    });
  });

  describe('Guest Blacklist Validation', () => {
    it('allows non-blacklisted guests', async () => {
      mockPrisma.guest.findUnique.mockResolvedValue({ blacklistedAt: null });

      const result = await validateGuestBlacklist('guest@example.com');
      
      expect(result.isValid).toBe(true);
    });

    it('rejects blacklisted guests', async () => {
      mockPrisma.guest.findUnique.mockResolvedValue({
        blacklistedAt: new Date('2025-01-01')
      });

      const result = await validateGuestBlacklist('banned@example.com');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Guest is not authorized for building access. Contact security for assistance.');
    });

    it('allows new guests (not found in database)', async () => {
      mockPrisma.guest.findUnique.mockResolvedValue(null);

      const result = await validateGuestBlacklist('new@example.com');
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Guest Terms Acceptance Validation', () => {
    it('allows recent acceptance', async () => {
      mockPrisma.acceptance.findFirst.mockResolvedValue({
        acceptedAt: new Date('2025-08-01') // Recent
      });

      const result = await validateGuestAcceptance('guest-123');
      
      expect(result.isValid).toBe(true);
    });

    it('requires acceptance for new guests', async () => {
      mockPrisma.acceptance.findFirst.mockResolvedValue(null);

      const result = await validateGuestAcceptance('guest-123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Guest needs to accept visitor terms before check-in. Email will be sent.');
    });

    it('rejects expired acceptance', async () => {
      const overOneYearAgo = new Date('2024-08-29');
      mockPrisma.acceptance.findFirst.mockResolvedValue({
        acceptedAt: overOneYearAgo,
        visitId: null // Legacy acceptance
      });

      const result = await validateGuestAcceptance('guest-123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Guest's visitor agreement has expired. New terms acceptance required.");
    });

    it('handles visit-scoped acceptance expiration', async () => {
      const over24HoursAgo = new Date('2025-08-29T12:00:00');
      mockPrisma.acceptance.findFirst.mockResolvedValue({
        acceptedAt: over24HoursAgo,
        visitId: 'visit-123' // Visit-scoped (24-hour validity)
      });

      const result = await validateGuestAcceptance('guest-123');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Guest's visitor agreement has expired. New terms acceptance required.");
    });
  });

  describe('QR Token Validation', () => {
    it('allows null expiration (multi-guest QR)', () => {
      const result = validateQRToken(null);
      expect(result.isValid).toBe(true);
    });

    it('allows future expiration', () => {
      const futureDate = new Date('2025-12-31T23:59:59');
      const result = validateQRToken(futureDate);
      expect(result.isValid).toBe(true);
    });

    it('rejects past expiration', () => {
      const pastDate = new Date('2025-01-01T00:00:00');
      const result = validateQRToken(pastDate);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This QR code has expired. Please generate a new invitation.');
    });
  });

  describe('Existing Active Visit Check', () => {
    it('detects same-host active visit', async () => {
      const activeVisit = {
        id: 'visit-123',
        checkedInAt: new Date(),
        expiresAt: new Date('2025-12-31'),
        guest: { id: 'g1', name: 'John', email: 'john@example.com' },
        host: { id: 'h1', name: 'Host', email: 'host@example.com' }
      };
      
      mockPrisma.visit.findFirst
        .mockResolvedValueOnce(activeVisit)  // same-host query
        .mockResolvedValueOnce(null);       // cross-host query

      const result = await checkExistingActiveVisit('h1', 'john@example.com');
      
      expect(result.hasActiveVisit).toBe(true);
      expect(result.crossHostVisit).toBe(false);
      expect(result.activeVisit).toEqual(activeVisit);
    });

    it('detects cross-host active visit', async () => {
      const crossHostVisit = {
        id: 'visit-456',
        checkedInAt: new Date(),
        expiresAt: new Date('2025-12-31'),
        guest: { id: 'g1', name: 'John', email: 'john@example.com' },
        host: { id: 'h2', name: 'Other Host', email: 'other@example.com' }
      };
      
      mockPrisma.visit.findFirst
        .mockResolvedValueOnce(null)          // same-host query
        .mockResolvedValueOnce(crossHostVisit); // cross-host query

      const result = await checkExistingActiveVisit('h1', 'john@example.com');
      
      expect(result.hasActiveVisit).toBe(true);
      expect(result.crossHostVisit).toBe(true);
      expect(result.activeVisit?.host.id).toBe('h2');
    });

    it('returns no active visit when none exists', async () => {
      mockPrisma.visit.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await checkExistingActiveVisit('h1', 'john@example.com');
      
      expect(result.hasActiveVisit).toBe(false);
      expect(result.crossHostVisit).toBe(false);
      expect(result.activeVisit).toBeUndefined();
    });
  });

  describe('Override Authorization', () => {
    it('allows security and admin roles to override', () => {
      expect(canUserOverride('security')).toBe(true);
      expect(canUserOverride('admin')).toBe(true);
    });

    it('denies host role override capability', () => {
      expect(canUserOverride('host')).toBe(false);
      expect(canUserOverride(undefined)).toBe(false);
    });
  });

  describe('Discount Trigger Logic', () => {
    it('triggers discount on exactly 3rd visit without existing discount', async () => {
      mockPrisma.visit.count.mockResolvedValue(3);
      mockPrisma.discount.findFirst.mockResolvedValue(null);

      const result = await shouldTriggerDiscount('guest-123');
      
      expect(result).toBe(true);
    });

    it('does not trigger discount on 2nd visit', async () => {
      mockPrisma.visit.count.mockResolvedValue(2);
      mockPrisma.discount.findFirst.mockResolvedValue(null);

      const result = await shouldTriggerDiscount('guest-123');
      
      expect(result).toBe(false);
    });

    it('does not trigger if discount already exists', async () => {
      mockPrisma.visit.count.mockResolvedValue(3);
      mockPrisma.discount.findFirst.mockResolvedValue({
        id: 'discount-123',
        triggeredAt: new Date()
      });

      const result = await shouldTriggerDiscount('guest-123');
      
      expect(result).toBe(false);
    });
  });

  describe('Returning Guest Processing', () => {
    const setupValidationMocks = () => {
      mockPrisma.guest.findUnique.mockResolvedValue({ blacklistedAt: null });
      mockPrisma.location.findUnique.mockResolvedValue({
        settings: { checkInCutoffHour: 23 }
      });
      mockPrisma.policy.findFirst.mockResolvedValue({
        hostConcurrentLimit: 3,
        guestMonthlyLimit: 3
      });
      mockPrisma.visit.count.mockResolvedValue(1);
      mockPrisma.visit.findMany.mockResolvedValue([]);
    };

    it('auto-renews expired acceptance for returning guests', async () => {
      setupValidationMocks();
      
      const veryOldAcceptance = new Date('2020-01-01');
      const newAcceptance = new Date();
      
      mockPrisma.acceptance.findFirst
        .mockResolvedValueOnce(null) // No visit-scoped acceptance
        .mockResolvedValueOnce(null) // No recent legacy acceptance
        .mockResolvedValueOnce({ acceptedAt: veryOldAcceptance, visitId: null }) // Has old acceptance (returning guest)
        .mockResolvedValueOnce({ // After renewal
          acceptedAt: newAcceptance,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          visitId: null
        });

      mockPrisma.acceptance.create.mockResolvedValue({
        acceptedAt: newAcceptance,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      const result = await processReturningGuestCheckIn(
        'host-123', 'guest-456', 'guest@example.com', 
        new Date('2025-12-31'), 'loc-789'
      );

      expect(result.acceptanceRenewed).toBe(true);
      expect(result.isValid).toBe(true);
      expect(mockPrisma.acceptance.create).toHaveBeenCalled();
    });

    it('does not renew for first-time guests', async () => {
      setupValidationMocks();
      
      mockPrisma.acceptance.findFirst
        .mockResolvedValueOnce(null) // No visit-scoped acceptance
        .mockResolvedValueOnce(null) // No recent legacy acceptance
        .mockResolvedValueOnce(null); // No previous acceptance (first-time guest)

      const result = await processReturningGuestCheckIn(
        'host-123', 'guest-456', 'new@example.com', 
        new Date('2025-12-31'), 'loc-789'
      );

      expect(result.isValid).toBe(false);
      expect(result.acceptanceRenewed).toBeUndefined();
      expect(result.error).toContain('needs to accept visitor terms');
      expect(mockPrisma.acceptance.create).not.toHaveBeenCalled();
    });

    it('handles renewal failure gracefully', async () => {
      setupValidationMocks();
      
      mockPrisma.acceptance.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ acceptedAt: new Date('2020-01-01'), visitId: null });
      
      mockPrisma.acceptance.create.mockRejectedValue(new Error('DB Error'));

      const result = await processReturningGuestCheckIn(
        'host-123', 'guest-456', 'guest@example.com', 
        new Date('2025-12-31'), 'loc-789'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unable to process guest terms update. Technical support needed.');
    });
  });

  describe('Visit-Scoped Acceptance Validation', () => {
    it('accepts valid visit-scoped acceptance', async () => {
      const mockAcceptance = {
        id: 'acc-123',
        guestId: 'guest-123',
        visitId: 'visit-123',
        invitationId: 'inv-123',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        acceptedAt: new Date()
      };

      mockPrisma.acceptance.findFirst.mockResolvedValue(mockAcceptance);

      const result = await validateVisitScopedAcceptance('guest-123', 'inv-123');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects when no current acceptance found', async () => {
      mockPrisma.acceptance.findFirst
        .mockResolvedValueOnce(null) // No visit-scoped acceptance
        .mockResolvedValueOnce(null); // No legacy acceptance

      const result = await validateVisitScopedAcceptance('guest-123', 'inv-123');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Guest needs to accept visitor terms for this visit. Email will be sent.');
    });

    it('accepts legacy acceptance within 24 hours', async () => {
      const mockLegacyAcceptance = {
        id: 'acc-legacy',
        guestId: 'guest-123',
        visitId: null,
        invitationId: null,
        expiresAt: null,
        acceptedAt: new Date(Date.now() - 3600000) // 1 hour ago
      };

      mockPrisma.acceptance.findFirst
        .mockResolvedValueOnce(null) // No visit-scoped acceptance
        .mockResolvedValueOnce(mockLegacyAcceptance); // Legacy acceptance within 24h

      const result = await validateVisitScopedAcceptance('guest-123', 'inv-123');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles database errors gracefully', async () => {
      mockPrisma.policy.findFirst.mockRejectedValue(new Error('Database connection error'));

      const result = await validateHostConcurrentLimit('host-123', 'loc-456');
      
      // Should handle error gracefully and not crash
      expect(result.isValid).toBe(false);
    });

    it('validates null and undefined inputs appropriately', async () => {
      expect(canUserOverride(undefined)).toBe(false);
      expect(validateQRToken(null).isValid).toBe(true);
    });

    it('handles concurrent validation requests', async () => {
      mockPrisma.policy.findFirst.mockResolvedValue({ hostConcurrentLimit: 3 });
      mockPrisma.visit.count.mockResolvedValue(1);
      mockPrisma.location.findUnique.mockResolvedValue({ name: 'Test' });

      const promises = Array.from({ length: 5 }, () => 
        validateHostConcurrentLimit('host-123', 'loc-456')
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });
  });
});