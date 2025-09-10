/**
 * Critical Error Scenario Tests
 * Tests real error conditions and recovery using test database
 */

import { testDb, TestDataFactory } from '../test-utils';
import { validateHostConcurrentLimit, validateGuestRollingLimit } from '@/lib/validations';
import { parseQRData } from '@/lib/qr-token';
import { faker } from '@faker-js/faker';

describe('Critical Error Scenarios', () => {
  beforeAll(async () => {
    await testDb.connect();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanup();
  });

  describe('Database Error Handling', () => {
    it('should handle missing policy configuration gracefully', async () => {
      // Don't create any policy record
      const result = await validateHostConcurrentLimit('host-1', 'location-1');
      
      // Should use defaults when policy is missing
      expect(result.isValid).toBe(true);
    });

    it('should handle guest not found errors', async () => {
      const nonExistentGuestId = faker.string.uuid();
      
      const result = await validateGuestRollingLimit(nonExistentGuestId);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should handle constraint violations correctly', async () => {
      const testData = await testDb.setupBasicTestData();
      
      // Try to create visit without required foreign key
      try {
        await testDb.getPrisma().visit.create({
          data: {
            id: faker.string.uuid(),
            guestId: 'non-existent-guest',
            hostId: testData.host.id,
            locationId: testData.location.id,
            checkedInAt: new Date(),
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          },
        });
        fail('Should have thrown constraint error');
      } catch (error: any) {
        expect(error.code).toBe('P2003'); // Foreign key constraint
      }
    });

    it('should handle unique constraint violations', async () => {
      const guest = TestDataFactory.createGuest();
      await testDb.getPrisma().guest.create({ data: guest });
      
      // Try to create duplicate
      try {
        await testDb.getPrisma().guest.create({
          data: { ...guest, id: faker.string.uuid() }, // Same email
        });
        fail('Should have thrown unique constraint error');
      } catch (error: any) {
        expect(error.code).toBe('P2002'); // Unique constraint
      }
    });

    it('should handle transaction rollback on error', async () => {
      const testData = await testDb.setupBasicTestData();
      
      try {
        await testDb.getPrisma().$transaction(async (tx) => {
          // Create valid visit
          await tx.visit.create({
            data: TestDataFactory.createVisit(
              testData.guest.id,
              testData.host.id,
              testData.location.id
            ),
          });
          
          // Force error to trigger rollback
          throw new Error('Simulated transaction error');
        });
      } catch (error) {
        // Transaction should have rolled back
      }
      
      // Verify no visit was created
      const visits = await testDb.getPrisma().visit.findMany({
        where: { guestId: testData.guest.id },
      });
      expect(visits).toHaveLength(0);
    });
  });

  describe('Business Rule Violations', () => {
    it('should handle capacity limit exceeded', async () => {
      const testData = await testDb.setupBasicTestData();
      
      // Create policy with low limit
      await testDb.getPrisma().policy.create({
        data: {
          id: 1,
          hostConcurrentLimit: 2,
          guestMonthlyLimit: 3,
        },
      });
      
      // Create 2 active visits (at capacity)
      for (let i = 0; i < 2; i++) {
        const guest = TestDataFactory.createGuest();
        await testDb.getPrisma().guest.create({ data: guest });
        await testDb.getPrisma().visit.create({
          data: TestDataFactory.createVisit(
            guest.id,
            testData.host.id,
            testData.location.id
          ),
        });
      }
      
      // Try to validate for another guest
      const result = await validateHostConcurrentLimit(
        testData.host.id,
        testData.location.id
      );
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('concurrent guest limit');
      expect(result.currentCount).toBe(2);
      expect(result.limit).toBe(2);
    });

    it('should handle monthly limit exceeded', async () => {
      const testData = await testDb.setupBasicTestData();
      
      // Create policy
      await testDb.getPrisma().policy.create({
        data: {
          id: 1,
          hostConcurrentLimit: 10,
          guestMonthlyLimit: 2,
        },
      });
      
      // Create 2 visits in last 30 days
      for (let i = 0; i < 2; i++) {
        await testDb.getPrisma().visit.create({
          data: TestDataFactory.createVisit(
            testData.guest.id,
            testData.host.id,
            testData.location.id,
            { checkedInAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000) }
          ),
        });
      }
      
      const result = await validateGuestRollingLimit(testData.guest.id);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('monthly limit');
      expect(result.visitCount).toBe(2);
    });

    it('should handle blacklisted guest', async () => {
      const guest = TestDataFactory.createGuest({ blacklisted: true });
      await testDb.getPrisma().guest.create({ data: guest });
      
      const result = await validateGuestRollingLimit(guest.id);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('blacklisted');
    });
  });

  describe('QR Code Parsing Errors', () => {
    it('should handle malformed QR data', () => {
      const malformedInputs = [
        'not-json',
        '{"incomplete":',
        '[]',
        'null',
        '',
        undefined,
        null,
      ];
      
      for (const input of malformedInputs) {
        const result = parseQRData(input as any);
        expect(result.guests).toEqual([]);
      }
    });

    it('should handle QR with missing required fields', () => {
      const incompleteData = [
        { e: 'email@test.com' }, // Missing name
        { n: 'Test Name' }, // Missing email
        { e: '', n: 'Test' }, // Empty email
        { e: 'test@example.com', n: '' }, // Empty name
      ];
      
      const result = parseQRData(JSON.stringify({ guests: incompleteData }));
      
      // Should filter out invalid entries
      expect(result.guests.every(g => g.email && g.name)).toBe(true);
    });

    it('should handle oversized QR payloads', () => {
      const hugePayload = {
        guests: Array.from({ length: 1000 }, (_, i) => ({
          e: `user${i}@example.com`,
          n: `User ${i}`,
        })),
      };
      
      const result = parseQRData(JSON.stringify(hugePayload));
      
      // Should handle large payloads without crashing
      expect(result.guests.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operation Conflicts', () => {
    it('should handle concurrent check-ins for same guest', async () => {
      const testData = await testDb.setupBasicTestData();
      
      // Simulate concurrent check-in attempts
      const checkInPromises = Array.from({ length: 3 }, () =>
        testDb.getPrisma().visit.create({
          data: TestDataFactory.createVisit(
            testData.guest.id,
            testData.host.id,
            testData.location.id
          ),
        })
      );
      
      const results = await Promise.allSettled(checkInPromises);
      
      // All should succeed (Prisma handles concurrent creates)
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle race condition in capacity checks', async () => {
      const testData = await testDb.setupBasicTestData();
      
      await testDb.getPrisma().policy.create({
        data: {
          id: 1,
          hostConcurrentLimit: 1,
          guestMonthlyLimit: 10,
        },
      });
      
      // Create multiple guests
      const guests = await Promise.all(
        Array.from({ length: 3 }, async () => {
          const guest = TestDataFactory.createGuest();
          return testDb.getPrisma().guest.create({ data: guest });
        })
      );
      
      // Try concurrent validations
      const validationPromises = guests.map(guest =>
        validateHostConcurrentLimit(testData.host.id, testData.location.id)
      );
      
      const results = await Promise.all(validationPromises);
      
      // At least one should pass
      expect(results.some(r => r.isValid)).toBe(true);
    });
  });

  describe('Data Recovery Scenarios', () => {
    it('should recover from partial data corruption', async () => {
      const testData = await testDb.setupBasicTestData();
      
      // Create visit with NULL host (simulating corruption)
      const corruptVisit = await testDb.getPrisma().$executeRaw`
        INSERT INTO "Visit" (id, "guestId", "hostId", "locationId", "checkedInAt", "expiresAt")
        VALUES (${faker.string.uuid()}, ${testData.guest.id}, NULL, ${testData.location.id}, NOW(), NOW() + INTERVAL '12 hours')
      `;
      
      // System should handle NULL host gracefully
      const visits = await testDb.getPrisma().visit.findMany({
        where: { guestId: testData.guest.id },
      });
      
      // Query should not crash
      expect(Array.isArray(visits)).toBe(true);
    });

    it('should handle expired data cleanup', async () => {
      const testData = await testDb.setupBasicTestData();
      
      // Create expired visits
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await testDb.getPrisma().visit.create({
        data: {
          ...TestDataFactory.createVisit(
            testData.guest.id,
            testData.host.id,
            testData.location.id
          ),
          checkedInAt: expiredDate,
          expiresAt: expiredDate,
        },
      });
      
      // Query for active visits
      const activeVisits = await testDb.getPrisma().visit.findMany({
        where: {
          expiresAt: { gte: new Date() },
        },
      });
      
      expect(activeVisits).toHaveLength(0);
    });

    it('should handle missing acceptance records', async () => {
      const testData = await testDb.setupBasicTestData();
      
      // Guest without acceptance
      const acceptance = await testDb.getPrisma().acceptance.findFirst({
        where: { guestId: testData.guest.id },
      });
      
      expect(acceptance).toBeNull();
      
      // System should handle missing acceptance
      const validation = await validateGuestRollingLimit(testData.guest.id);
      expect(validation).toBeDefined();
    });
  });

  describe('Network and Timeout Errors', () => {
    it('should handle slow database queries', async () => {
      const testData = await testDb.setupBasicTestData();
      
      // Create many visits to slow down query
      const visits = Array.from({ length: 100 }, () =>
        TestDataFactory.createVisit(
          testData.guest.id,
          testData.host.id,
          testData.location.id
        )
      );
      
      await testDb.getPrisma().visit.createMany({ data: visits });
      
      const startTime = Date.now();
      const result = await validateGuestRollingLimit(testData.guest.id);
      const duration = Date.now() - startTime;
      
      // Should complete even with many records
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // 5 second timeout
    });

    it('should handle connection pool exhaustion', async () => {
      // Simulate many concurrent database operations
      const operations = Array.from({ length: 50 }, () =>
        testDb.getPrisma().guest.count()
      );
      
      const results = await Promise.allSettled(operations);
      
      // Most should succeed despite high concurrency
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(25);
    });
  });
});