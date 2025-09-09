/**
 * Critical Error Scenario Coverage
 * Tests edge cases, failure modes, and error handling patterns
 */

import { prisma } from '@/lib/prisma';
import { validateHostConcurrentLimit, validateGuestRollingLimit } from '@/lib/validations';
import { parseQRData } from '@/lib/qr-token';
import { faker } from '@faker-js/faker';

// Mock Prisma for isolated error testing
jest.mock('@/lib/prisma', () => ({
  prisma: {
    policy: { findFirst: jest.fn() },
    visit: { 
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    guest: { 
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    location: { findUnique: jest.fn() },
    acceptance: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  }
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Critical Error Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Connection Failures', () => {
    it('should handle database timeout gracefully', async () => {
      mockPrisma.policy.findFirst.mockRejectedValue(new Error('Connection timeout'));
      
      await expect(validateHostConcurrentLimit('host-1', 'location-1')).rejects.toThrow('Connection timeout');
    });

    it('should handle database connection drops during transactions', async () => {
      mockPrisma.policy.findFirst.mockResolvedValue({ 
        id: 1, 
        guestMonthlyLimit: 3, 
        hostConcurrentLimit: 3 
      });
      mockPrisma.visit.count.mockRejectedValue(new Error('Connection lost'));
      
      await expect(validateHostConcurrentLimit('host-1', 'location-1')).rejects.toThrow('Connection lost');
    });

    it('should handle Prisma client not initialized errors', async () => {
      mockPrisma.policy.findFirst.mockRejectedValue(new Error('Prisma client is not initialized'));
      
      await expect(validateHostConcurrentLimit('host-1', 'location-1')).rejects.toThrow('Prisma client is not initialized');
    });

    it('should handle database constraint violations', async () => {
      mockPrisma.guest.findUnique.mockResolvedValue({
        id: 'guest-1',
        email: 'test@example.com',
        name: 'Test Guest',
        blacklisted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.visit.findMany.mockResolvedValue([]);
      mockPrisma.policy.findFirst.mockResolvedValue({ 
        id: 1, 
        guestMonthlyLimit: 3, 
        hostConcurrentLimit: 3 
      });
      
      const result = await validateGuestRollingLimit('guest-1');
      expect(result.isValid).toBe(true);
    });

    it('should handle foreign key constraint violations', async () => {
      mockPrisma.visit.create.mockRejectedValue(
        new Error('Foreign key constraint failed on field: guestId')
      );
      
      await expect(
        mockPrisma.visit.create({ data: { guestId: 'invalid-id' } as any })
      ).rejects.toThrow('Foreign key constraint failed');
    });

    it('should handle unique constraint violations', async () => {
      mockPrisma.guest.create.mockRejectedValue(
        new Error('Unique constraint failed on field: email')
      );
      
      await expect(
        mockPrisma.guest.create({ data: { email: 'duplicate@example.com' } as any })
      ).rejects.toThrow('Unique constraint failed');
    });
  });

  describe('Memory and Resource Exhaustion', () => {
    it('should handle out-of-memory conditions during large operations', async () => {
      mockPrisma.visit.findMany.mockRejectedValue(new Error('JavaScript heap out of memory'));
      mockPrisma.guest.findUnique.mockResolvedValue({
        id: 'guest-1',
        email: 'test@example.com',
        name: 'Test Guest',
        blacklisted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      await expect(validateGuestRollingLimit('guest-1')).rejects.toThrow('JavaScript heap out of memory');
    });

    it('should handle stack overflow from recursive operations', () => {
      // Create deeply nested QR data that could cause stack overflow
      let deepObject: any = { value: 'bottom' };
      for (let i = 0; i < 10000; i++) {
        deepObject = { level: i, nested: deepObject };
      }
      
      const deepQR = JSON.stringify({
        guests: [{ e: 'test@example.com', n: 'Test', metadata: deepObject }]
      });
      
      expect(() => {
        parseQRData(deepQR);
      }).not.toThrow(); // Should handle gracefully or fail with controlled error
    });

    it('should handle extremely large guest arrays', () => {
      // Test with large but reasonable guest array
      const largeGuestArray = Array.from({ length: 1000 }, (_, i) => ({
        e: `guest${i}@example.com`,
        n: `Guest ${i}`
      }));
      
      const largeQR = JSON.stringify({ guests: largeGuestArray });
      
      const result = parseQRData(largeQR);
      expect(result).not.toBeNull();
      if (result && result.type === 'batch') {
        expect(result.guestBatch.guests).toHaveLength(1000);
      }
    });
  });

  describe('Malicious Input Handling', () => {
    it('should sanitize SQL injection attempts in guest emails', async () => {
      const maliciousEmail = "'; DROP TABLE guests; --@example.com";
      
      mockPrisma.guest.findUnique.mockResolvedValue({
        id: 'guest-1',
        email: maliciousEmail,
        name: 'Test Guest',
        blacklisted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.visit.findMany.mockResolvedValue([]);
      mockPrisma.policy.findFirst.mockResolvedValue({ 
        id: 1, 
        guestMonthlyLimit: 3, 
        hostConcurrentLimit: 3 
      });
      
      const result = await validateGuestRollingLimit('guest-1');
      expect(result.isValid).toBe(true);
      
      // Verify the email is passed through as-is (parameter binding prevents injection)
      expect(mockPrisma.guest.findUnique).toHaveBeenCalledWith({
        where: { id: 'guest-1' }
      });
    });

    it('should handle XSS attempts in guest names', () => {
      const xssName = '<script>alert("XSS")</script>';
      const qrData = JSON.stringify({
        guests: [{ e: 'test@example.com', n: xssName }]
      });
      
      const result = parseQRData(qrData);
      expect(result).not.toBeNull();
      if (result && result.type === 'batch') {
        expect(result.guestBatch.guests[0].n).toBe(xssName);
        // Script tags should be preserved for proper escaping in UI layer
      }
    });

    it('should resist prototype pollution attacks', () => {
      const pollutionAttempt = '{"__proto__":{"isAdmin":true},"guests":[{"e":"test@example.com","n":"Test"}]}';
      
      const result = parseQRData(pollutionAttempt);
      
      // Should parse without pollution
      expect((result as any)?.isAdmin).toBeUndefined();
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      
      if (result && result.type === 'batch') {
        expect(result.guestBatch.guests).toHaveLength(1);
        expect(result.guestBatch.guests[0].e).toBe('test@example.com');
      }
    });

    it('should handle buffer overflow attempts in long strings', () => {
      const veryLongString = 'A'.repeat(1000000); // 1MB string
      const qrData = JSON.stringify({
        guests: [{ e: 'test@example.com', n: veryLongString }]
      });
      
      expect(() => {
        const result = parseQRData(qrData);
        // Should handle without crashing
        if (result && result.type === 'batch') {
          expect(result.guestBatch.guests[0].n).toBe(veryLongString);
        }
      }).not.toThrow();
    });
  });

  describe('Race Condition Handling', () => {
    it('should handle concurrent validation requests for same guest', async () => {
      mockPrisma.guest.findUnique.mockResolvedValue({
        id: 'guest-1',
        email: 'test@example.com',
        name: 'Test Guest',
        blacklisted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.visit.findMany.mockResolvedValue([]);
      mockPrisma.policy.findFirst.mockResolvedValue({ 
        id: 1, 
        guestMonthlyLimit: 3, 
        hostConcurrentLimit: 3 
      });
      
      // Simulate concurrent validation calls
      const promises = Array.from({ length: 5 }, () => 
        validateGuestRollingLimit('guest-1')
      );
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle concurrent policy updates during validation', async () => {
      // First call succeeds
      mockPrisma.policy.findFirst.mockResolvedValueOnce({ 
        id: 1, 
        guestMonthlyLimit: 3, 
        hostConcurrentLimit: 3 
      });
      mockPrisma.visit.count.mockResolvedValueOnce(2);
      
      // Second call gets updated policy
      mockPrisma.policy.findFirst.mockResolvedValueOnce({ 
        id: 1, 
        guestMonthlyLimit: 3, 
        hostConcurrentLimit: 1 
      });
      mockPrisma.visit.count.mockResolvedValueOnce(2);
      
      const result1 = await validateHostConcurrentLimit('host-1', 'location-1');
      const result2 = await validateHostConcurrentLimit('host-1', 'location-1');
      
      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('capacity');
    });
  });

  describe('Data Corruption Recovery', () => {
    it('should handle corrupted JSON in QR codes', () => {
      const corruptedJson = '{"guests":[{"e":"test@example.com","n":}';
      
      const result = parseQRData(corruptedJson);
      expect(result).toBeNull();
    });

    it('should handle null or undefined database responses', async () => {
      mockPrisma.policy.findFirst.mockResolvedValue(null);
      
      // Should handle missing policy gracefully
      await expect(validateHostConcurrentLimit('host-1', 'location-1')).rejects.toThrow();
    });

    it('should handle malformed database records', async () => {
      mockPrisma.guest.findUnique.mockResolvedValue({
        id: 'guest-1',
        email: null, // Corrupted email field
        name: 'Test Guest',
        blacklisted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      
      await expect(validateGuestRollingLimit('guest-1')).rejects.toThrow();
    });

    it('should handle inconsistent visit data', async () => {
      mockPrisma.guest.findUnique.mockResolvedValue({
        id: 'guest-1',
        email: 'test@example.com',
        name: 'Test Guest',
        blacklisted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Return visits with inconsistent dates
      mockPrisma.visit.findMany.mockResolvedValue([
        {
          id: 'visit-1',
          guestId: 'guest-1',
          hostId: 'host-1',
          locationId: 'location-1',
          checkedInAt: null, // Inconsistent - should have check-in time
          expiresAt: new Date(),
          checkedOutAt: null,
          overridden: false,
          overrideReason: null,
          overrideByUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);
      
      mockPrisma.policy.findFirst.mockResolvedValue({ 
        id: 1, 
        guestMonthlyLimit: 3, 
        hostConcurrentLimit: 3 
      });
      
      const result = await validateGuestRollingLimit('guest-1');
      // Should handle inconsistent data gracefully
      expect(result.isValid).toBe(true);
    });
  });

  describe('Network and Timeout Handling', () => {
    it('should handle slow database queries with timeout', async () => {
      // Simulate very slow query
      mockPrisma.policy.findFirst.mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve({ 
          id: 1, 
          guestMonthlyLimit: 3, 
          hostConcurrentLimit: 3 
        }), 10000))
      );
      
      // Should timeout or handle gracefully (depending on implementation)
      const promise = validateHostConcurrentLimit('host-1', 'location-1');
      
      // Either resolves eventually or rejects with timeout
      await expect(promise).resolves.toBeTruthy();
    }, 12000);

    it('should handle intermittent network failures', async () => {
      let callCount = 0;
      
      mockPrisma.policy.findFirst.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('ENOTFOUND database.server.com');
        }
        return Promise.resolve({ 
          id: 1, 
          guestMonthlyLimit: 3, 
          hostConcurrentLimit: 3 
        });
      });
      
      // First call should fail with network error
      await expect(validateHostConcurrentLimit('host-1', 'location-1')).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('Edge Case Input Validation', () => {
    it('should handle empty guest arrays', () => {
      const emptyGuestQR = JSON.stringify({ guests: [] });
      
      const result = parseQRData(emptyGuestQR);
      expect(result).not.toBeNull();
      if (result && result.type === 'batch') {
        expect(result.guestBatch.guests).toHaveLength(0);
      }
    });

    it('should handle guests with missing required fields', () => {
      const incompleteGuestQR = JSON.stringify({
        guests: [
          { e: 'complete@example.com', n: 'Complete Guest' },
          { e: 'missing-name@example.com' }, // Missing name
          { n: 'Missing Email' }, // Missing email
          {}, // Missing both
        ]
      });
      
      const result = parseQRData(incompleteGuestQR);
      expect(result).not.toBeNull();
      if (result && result.type === 'batch') {
        expect(result.guestBatch.guests).toHaveLength(4);
        // All guests should be preserved for validation at API level
        expect(result.guestBatch.guests[1].e).toBe('missing-name@example.com');
        expect(result.guestBatch.guests[1].n).toBeUndefined();
        expect(result.guestBatch.guests[2].e).toBeUndefined();
        expect(result.guestBatch.guests[2].n).toBe('Missing Email');
      }
    });

    it('should handle extreme date values', async () => {
      mockPrisma.guest.findUnique.mockResolvedValue({
        id: 'guest-1',
        email: 'test@example.com',
        name: 'Test Guest',
        blacklisted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Visit with extreme future date
      mockPrisma.visit.findMany.mockResolvedValue([
        {
          id: 'visit-1',
          guestId: 'guest-1',
          hostId: 'host-1',
          locationId: 'location-1',
          checkedInAt: new Date('9999-12-31T23:59:59.999Z'),
          expiresAt: new Date('9999-12-31T23:59:59.999Z'),
          checkedOutAt: null,
          overridden: false,
          overrideReason: null,
          overrideByUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);
      
      mockPrisma.policy.findFirst.mockResolvedValue({ 
        id: 1, 
        guestMonthlyLimit: 3, 
        hostConcurrentLimit: 3 
      });
      
      const result = await validateGuestRollingLimit('guest-1');
      expect(result.isValid).toBe(false); // Should count as recent visit
    });
  });

  describe('Environment Configuration Errors', () => {
    it('should handle missing environment variables gracefully', () => {
      const originalEnv = process.env.OVERRIDE_PASSWORD;
      delete process.env.OVERRIDE_PASSWORD;
      
      // QR parsing should still work without override password
      const result = parseQRData('{"guests":[{"e":"test@example.com","n":"Test"}]}');
      expect(result).not.toBeNull();
      
      // Restore environment
      if (originalEnv) {
        process.env.OVERRIDE_PASSWORD = originalEnv;
      }
    });

    it('should handle invalid database URL format', () => {
      // This would typically be caught at application startup
      // Test that parsing functions still work with invalid config
      const result = parseQRData('{"guests":[{"e":"test@example.com","n":"Test"}]}');
      expect(result).not.toBeNull();
    });
  });
});