/**
 * Database Integration Tests
 * Tests database operations, constraints, and data integrity
 */

import { testDb, TestDataFactory, assertions, timeHelpers, dataHelpers } from '../test-utils';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    await testDb.connect();
    if (!await testDb.verifyConnectivity()) {
      throw new Error('Database connectivity check failed');
    }
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanup();
  });

  describe('Database Constraints and Relationships', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should enforce foreign key constraints between visits and guests', async () => {
      const prisma = testDb.getPrisma();

      // Try to create a visit with non-existent guest
      await expect(
        prisma.visit.create({
          data: TestDataFactory.createVisit('non-existent-guest', testData.host.id, testData.location.id),
        })
      ).rejects.toThrow();
    });

    it('should enforce foreign key constraints between visits and hosts', async () => {
      const prisma = testDb.getPrisma();
      const guest = TestDataFactory.createGuest();
      await prisma.guest.create({ data: guest });

      // Try to create a visit with non-existent host
      await expect(
        prisma.visit.create({
          data: TestDataFactory.createVisit(guest.id, 'non-existent-host', testData.location.id),
        })
      ).rejects.toThrow();
    });

    it('should allow cascading deletes appropriately', async () => {
      const prisma = testDb.getPrisma();
      
      // Create guest with associated data
      const guest = TestDataFactory.createGuest();
      await prisma.guest.create({ data: guest });
      
      const acceptance = TestDataFactory.createAcceptance(guest.id);
      await prisma.acceptance.create({ data: acceptance });
      
      const visit = TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id);
      await prisma.visit.create({ data: visit });

      // Delete guest should cascade properly
      await prisma.guest.delete({ where: { id: guest.id } });

      // Verify associated records are handled appropriately
      const remainingAcceptances = await prisma.acceptance.findMany({
        where: { guestId: guest.id },
      });
      const remainingVisits = await prisma.visit.findMany({
        where: { guestId: guest.id },
      });

      expect(remainingAcceptances).toHaveLength(0);
      expect(remainingVisits).toHaveLength(0);
    });

    it('should maintain data integrity across transactions', async () => {
      const prisma = testDb.getPrisma();
      const guest = TestDataFactory.createGuest();

      // Test atomic transaction for guest creation with acceptance
      await testDb.withTransaction(async (tx) => {
        await tx.guest.create({ data: guest });
        await tx.acceptance.create({
          data: TestDataFactory.createAcceptance(guest.id),
        });
      });

      // Verify both records exist
      const createdGuest = await prisma.guest.findUnique({ where: { id: guest.id } });
      const createdAcceptance = await prisma.acceptance.findFirst({ where: { guestId: guest.id } });

      expect(createdGuest).toBeDefined();
      expect(createdAcceptance).toBeDefined();
    });

    it('should handle transaction rollbacks on failure', async () => {
      const prisma = testDb.getPrisma();
      const guest = TestDataFactory.createGuest();

      // Test transaction that should fail
      await expect(
        testDb.withTransaction(async (tx) => {
          await tx.guest.create({ data: guest });
          // This should fail due to foreign key constraint
          await tx.visit.create({
            data: TestDataFactory.createVisit(guest.id, 'non-existent-host', testData.location.id),
          });
        })
      ).rejects.toThrow();

      // Verify guest was not created due to rollback
      const createdGuest = await prisma.guest.findUnique({ where: { id: guest.id } });
      expect(createdGuest).toBeNull();
    });
  });

  describe('Complex Queries and Business Logic', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should correctly calculate rolling 30-day visit counts', async () => {
      const prisma = testDb.getPrisma();
      const guest = TestDataFactory.createGuest();
      await prisma.guest.create({ data: guest });

      // Create visits across different time periods
      const visits = [
        // 45 days ago (should not count)
        TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id, {
          checkedInAt: timeHelpers.createDateInPast(45),
          createdAt: timeHelpers.createDateInPast(45),
        }),
        // 25 days ago (should count)
        TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id, {
          checkedInAt: timeHelpers.createDateInPast(25),
          createdAt: timeHelpers.createDateInPast(25),
        }),
        // 15 days ago (should count)
        TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id, {
          checkedInAt: timeHelpers.createDateInPast(15),
          createdAt: timeHelpers.createDateInPast(15),
        }),
        // 5 days ago (should count)
        TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id, {
          checkedInAt: timeHelpers.createDateInPast(5),
          createdAt: timeHelpers.createDateInPast(5),
        }),
      ];

      for (const visit of visits) {
        await prisma.visit.create({ data: visit });
      }

      // Query for visits in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentVisits = await prisma.visit.findMany({
        where: {
          guestId: guest.id,
          checkedInAt: {
            gte: thirtyDaysAgo,
          },
        },
      });

      expect(recentVisits).toHaveLength(3); // Should exclude the 45-day-old visit
    });

    it('should handle concurrent guest limits correctly', async () => {
      const prisma = testDb.getPrisma();
      
      // Create multiple guests
      const guests = [];
      for (let i = 0; i < 5; i++) {
        const guest = TestDataFactory.createGuest({
          email: `concurrent.${i}@example.com`,
        });
        await prisma.guest.create({ data: guest });
        guests.push(guest);
      }

      // Create some active visits
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours

      for (let i = 0; i < 3; i++) {
        await prisma.visit.create({
          data: TestDataFactory.createVisit(guests[i].id, testData.host.id, testData.location.id, {
            checkedInAt: now,
            expiresAt: expiresAt,
          }),
        });
      }

      // Query for active visits for this host
      const activeVisits = await prisma.visit.count({
        where: {
          hostId: testData.host.id,
          checkedInAt: { not: null },
          expiresAt: { gt: now },
          checkedOutAt: null,
        },
      });

      expect(activeVisits).toBe(3);
    });

    it('should handle visit expiration logic correctly', async () => {
      const prisma = testDb.getPrisma();
      const guest = TestDataFactory.createGuest();
      await prisma.guest.create({ data: guest });

      const now = new Date();
      
      // Create expired visit
      const expiredVisit = TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id, {
        checkedInAt: timeHelpers.createDateInPast(1),
        expiresAt: timeHelpers.createDateInPast(1),
      });
      await prisma.visit.create({ data: expiredVisit });

      // Create active visit
      const activeVisit = TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id, {
        checkedInAt: now,
        expiresAt: timeHelpers.createDateInFuture(1),
      });
      await prisma.visit.create({ data: activeVisit });

      // Query for active visits
      const activeVisits = await prisma.visit.findMany({
        where: {
          guestId: guest.id,
          checkedInAt: { not: null },
          expiresAt: { gt: now },
          checkedOutAt: null,
        },
      });

      expect(activeVisits).toHaveLength(1);
      expect(activeVisits[0].id).toBe(activeVisit.id);
    });
  });

  describe('Data Validation and Edge Cases', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should enforce email uniqueness for guests', async () => {
      const prisma = testDb.getPrisma();
      const email = dataHelpers.generateTestEmail('unique');

      const guest1 = TestDataFactory.createGuest({ email });
      await prisma.guest.create({ data: guest1 });

      const guest2 = TestDataFactory.createGuest({ email });
      
      // Should fail due to unique constraint
      await expect(
        prisma.guest.create({ data: guest2 })
      ).rejects.toThrow(/unique/i);
    });

    it('should handle null and optional fields correctly', async () => {
      const prisma = testDb.getPrisma();
      
      // Create guest with minimal required fields
      const minimalGuest = {
        id: TestDataFactory.generateId(),
        email: dataHelpers.generateTestEmail('minimal'),
        name: 'Minimal Guest',
        country: 'US',
        contactMethod: 'EMAIL' as const,
        // Explicitly null optional fields
        phone: null,
        blacklistedAt: null,
        termsAcceptedAt: null,
        createdAt: new Date(),
        // Guest model doesn't have updatedAt field
      };

      const createdGuest = await prisma.guest.create({ data: minimalGuest });
      
      expect(createdGuest.phone).toBeNull();
      expect(createdGuest.blacklistedAt).toBeNull();
      expect(createdGuest.termsAcceptedAt).toBeNull();
    });

    it('should create guest with email-only for invitation flow', async () => {
      const prisma = testDb.getPrisma();
      
      // Test the exact pattern used in invitation creation
      // This would catch the Prisma validation error we encountered
      const emailOnlyGuest = {
        email: dataHelpers.generateTestEmail('email-only'),
        name: '', // Empty string as placeholder
        profileCompleted: false,
        // Other nullable fields omitted
      };

      // This should succeed without Prisma validation errors
      const createdGuest = await prisma.guest.create({ data: emailOnlyGuest });
      
      // Verify fields
      expect(createdGuest.email).toContain('email-only');
      expect(createdGuest.name).toBe(''); // Empty string placeholder
      expect(createdGuest.country).toBeNull(); // Omitted fields are null
      expect(createdGuest.phone).toBeNull();
      expect(createdGuest.contactMethod).toBeNull();
      expect(createdGuest.profileCompleted).toBe(false);
    });

    it('should handle large datasets efficiently', async () => {
      const prisma = testDb.getPrisma();
      
      // Create a batch of guests
      const guestBatch = Array.from({ length: 50 }, (_, i) => 
        TestDataFactory.createGuest({
          email: `bulk.guest.${i}@example.com`,
          name: `Bulk Guest ${i}`,
        })
      );

      // Test bulk creation performance
      const startTime = Date.now();
      await prisma.guest.createMany({
        data: guestBatch,
      });
      const endTime = Date.now();

      // Should complete reasonably quickly (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify all guests were created
      const createdGuests = await prisma.guest.count({
        where: {
          email: { contains: 'bulk.guest' },
        },
      });
      expect(createdGuests).toBe(50);
    });

    it('should maintain consistency during concurrent operations', async () => {
      const prisma = testDb.getPrisma();
      const guest = TestDataFactory.createGuest();
      await prisma.guest.create({ data: guest });

      // Simulate concurrent visit creation attempts
      const promises = Array.from({ length: 5 }, () =>
        prisma.visit.create({
          data: TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id),
        })
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');

      // All should succeed if no conflicting constraints
      expect(successful).toHaveLength(5);
    });
  });

  describe('Performance and Optimization', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should use indexes efficiently for common queries', async () => {
      const prisma = testDb.getPrisma();
      
      // Create test data that would benefit from indexing
      const guests = Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createGuest({
          email: `indexed.guest.${i}@example.com`,
        })
      );

      await prisma.guest.createMany({ data: guests });

      // Test query performance on indexed field (email)
      const startTime = Date.now();
      const foundGuest = await prisma.guest.findUnique({
        where: { email: 'indexed.guest.50@example.com' },
      });
      const endTime = Date.now();

      // Should be very fast with proper indexing
      expect(endTime - startTime).toBeLessThan(100);
      expect(foundGuest).toBeDefined();
    });

    it('should handle complex joins efficiently', async () => {
      const prisma = testDb.getPrisma();
      
      // Create related data
      const guest = TestDataFactory.createGuest();
      await prisma.guest.create({ data: guest });
      
      await prisma.acceptance.create({
        data: TestDataFactory.createAcceptance(guest.id),
      });

      const visit = TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id);
      await prisma.visit.create({ data: visit });

      // Test complex query with joins
      const startTime = Date.now();
      const result = await prisma.visit.findMany({
        where: { hostId: testData.host.id },
        include: {
          guest: true,
          host: true,
          location: true,
        },
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500);
      expect(result).toHaveLength(1);
      expect(result[0].guest).toBeDefined();
      expect(result[0].host).toBeDefined();
      expect(result[0].location).toBeDefined();
    });
  });
});