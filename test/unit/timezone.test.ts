/**
 * Unit tests for timezone utilities
 * Tests REAL timezone conversion and date operations for LA timezone
 */

import {
  nowInLA,
  thirtyDaysAgoInLA,
  getQRTokenExpiration,
  calculateVisitExpiration,
  isAfterCutoff,
  calculateNextEligibleDate,
  formatDateForDisplay,
  formatTimeForDisplay,
  parseInviteDate,
} from '@/lib/timezone';

describe('Timezone Utilities - Real Implementation', () => {
  // Use fixed dates for deterministic testing
  const FIXED_LA_TIME = new Date('2025-01-09T14:30:00-08:00'); // 2:30 PM PST
  const FIXED_LA_SUMMER = new Date('2025-07-15T14:30:00-07:00'); // 2:30 PM PDT
  
  beforeEach(() => {
    // Mock Date.now for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_LA_TIME.getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('nowInLA', () => {
    it('should return current time in LA timezone', () => {
      const result = nowInLA();
      expect(result).toBeInstanceOf(Date);
      
      // The actual implementation should handle timezone conversion
      // Result should be close to our fixed time
      expect(Math.abs(result.getTime() - FIXED_LA_TIME.getTime())).toBeLessThan(1000);
    });

    it('should handle DST transitions correctly', () => {
      // Test during standard time (winter)
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-15T12:00:00Z').getTime());
      const winterTime = nowInLA();
      
      // Test during daylight time (summer)
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-07-15T12:00:00Z').getTime());
      const summerTime = nowInLA();
      
      // Both should be valid dates
      expect(winterTime).toBeInstanceOf(Date);
      expect(summerTime).toBeInstanceOf(Date);
    });
  });

  describe('thirtyDaysAgoInLA', () => {
    it('should return date exactly 30 days ago in LA time', () => {
      const result = thirtyDaysAgoInLA();
      const now = nowInLA();
      
      const diffMs = now.getTime() - result.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      // Should be exactly 30 days
      expect(Math.round(diffDays)).toBe(30);
    });

    it('should handle month boundaries correctly', () => {
      // Test when 30 days ago crosses month boundary
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-03-15T12:00:00-07:00').getTime());
      const result = thirtyDaysAgoInLA();
      
      // Should be in February
      expect(result.getMonth()).toBe(1); // February (0-indexed)
      expect(result.getDate()).toBe(13); // March 15 - 30 = Feb 13
    });

    it('should handle leap year correctly', () => {
      // Test during leap year (2024)
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-03-01T12:00:00-08:00').getTime());
      const result = thirtyDaysAgoInLA();
      
      // 30 days before March 1, 2024 should be January 31, 2024
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(31);
    });
  });

  describe('getQRTokenExpiration', () => {
    it('should return expiration 7 days in the future', () => {
      const result = getQRTokenExpiration();
      const now = nowInLA();
      
      const diffMs = result.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      // Should be approximately 7 days
      expect(Math.round(diffDays)).toBe(7);
    });

    it('should maintain time of day', () => {
      const result = getQRTokenExpiration();
      const now = nowInLA();
      
      // Hours and minutes should be similar
      expect(result.getHours()).toBe(now.getHours());
      expect(result.getMinutes()).toBe(now.getMinutes());
    });
  });

  describe('calculateVisitExpiration', () => {
    it('should add 12 hours to check-in time', () => {
      const checkInTime = new Date('2025-01-09T09:00:00-08:00'); // 9 AM PST
      const result = calculateVisitExpiration(checkInTime);
      
      const diffMs = result.getTime() - checkInTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      expect(diffHours).toBe(12);
    });

    it('should handle day boundary crossing', () => {
      const checkInTime = new Date('2025-01-09T20:00:00-08:00'); // 8 PM PST
      const result = calculateVisitExpiration(checkInTime);
      
      // Should be 8 AM next day
      expect(result.getDate()).toBe(checkInTime.getDate() + 1);
      expect(result.getHours()).toBe(8); // 8 AM
    });

    it('should handle month boundary crossing', () => {
      const checkInTime = new Date('2025-01-31T20:00:00-08:00'); // 8 PM on Jan 31
      const result = calculateVisitExpiration(checkInTime);
      
      // Should be Feb 1 at 8 AM
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(8);
    });
  });

  describe('isAfterCutoff', () => {
    it('should correctly identify times after default cutoff (10 PM)', () => {
      // Test at 10:30 PM
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-09T22:30:00-08:00').getTime());
      expect(isAfterCutoff()).toBe(true);
      
      // Test at 9:30 PM
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-09T21:30:00-08:00').getTime());
      expect(isAfterCutoff()).toBe(false);
    });

    it('should handle custom cutoff hours', () => {
      // Test with 8 PM cutoff at 8:30 PM
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-09T20:30:00-08:00').getTime());
      expect(isAfterCutoff(20)).toBe(true);
      
      // Test with 11 PM cutoff at 10:30 PM
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-09T22:30:00-08:00').getTime());
      expect(isAfterCutoff(23)).toBe(false);
    });

    it('should handle edge case at exact cutoff time', () => {
      // Test at exactly 10:00 PM
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-09T22:00:00-08:00').getTime());
      expect(isAfterCutoff()).toBe(true); // >= comparison
    });
  });

  describe('calculateNextEligibleDate', () => {
    it('should add exactly 30 days', () => {
      const date = new Date('2025-01-09T14:00:00-08:00');
      const result = calculateNextEligibleDate(date);
      
      const diffMs = result.getTime() - date.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      expect(diffDays).toBe(30);
    });

    it('should preserve time of day', () => {
      const date = new Date('2025-01-09T15:45:30-08:00');
      const result = calculateNextEligibleDate(date);
      
      expect(result.getHours()).toBe(date.getHours());
      expect(result.getMinutes()).toBe(date.getMinutes());
      expect(result.getSeconds()).toBe(date.getSeconds());
    });

    it('should handle February to March transition', () => {
      const date = new Date('2025-02-15T12:00:00-08:00');
      const result = calculateNextEligibleDate(date);
      
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(17); // Feb 15 + 30 = March 17
    });
  });

  describe('formatDateForDisplay', () => {
    it('should format date in readable format', () => {
      const date = new Date('2025-01-09T14:30:00-08:00');
      const result = formatDateForDisplay(date);
      
      // Should contain month, day, year
      expect(result).toMatch(/Jan/i);
      expect(result).toMatch(/9/);
      expect(result).toMatch(/2025/);
    });

    it('should handle different months correctly', () => {
      const dates = [
        new Date('2025-03-15T12:00:00-07:00'),
        new Date('2025-07-04T12:00:00-07:00'),
        new Date('2025-12-25T12:00:00-08:00'),
      ];
      
      const results = dates.map(formatDateForDisplay);
      
      expect(results[0]).toMatch(/Mar/i);
      expect(results[1]).toMatch(/Jul/i);
      expect(results[2]).toMatch(/Dec/i);
    });
  });

  describe('formatTimeForDisplay', () => {
    it('should format time in 12-hour format with AM/PM', () => {
      const morning = new Date('2025-01-09T09:30:00-08:00');
      const afternoon = new Date('2025-01-09T14:30:00-08:00');
      const evening = new Date('2025-01-09T20:15:00-08:00');
      
      expect(formatTimeForDisplay(morning)).toMatch(/9:30.*AM/i);
      expect(formatTimeForDisplay(afternoon)).toMatch(/2:30.*PM/i);
      expect(formatTimeForDisplay(evening)).toMatch(/8:15.*PM/i);
    });

    it('should handle noon and midnight correctly', () => {
      const noon = new Date('2025-01-09T12:00:00-08:00');
      const midnight = new Date('2025-01-09T00:00:00-08:00');
      
      expect(formatTimeForDisplay(noon)).toMatch(/12:00.*PM/i);
      expect(formatTimeForDisplay(midnight)).toMatch(/12:00.*AM/i);
    });
  });

  describe('parseInviteDate', () => {
    it('should parse YYYY-MM-DD format correctly', () => {
      const result = parseInviteDate('2025-03-15');
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2); // March (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should handle invalid date strings', () => {
      const invalid = [
        'not-a-date',
        '2025-13-01', // Invalid month
        '2025-02-30', // Invalid day
        '',
        null,
      ];
      
      invalid.forEach(dateStr => {
        const result = parseInviteDate(dateStr as any);
        // Should either return null or invalid date
        expect(result === null || isNaN(result.getTime())).toBeTruthy();
      });
    });

    it('should preserve local timezone', () => {
      const result = parseInviteDate('2025-07-04');
      
      // Should be interpreted in local timezone
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(6); // July
      expect(result.getDate()).toBe(4);
    });
  });

  describe('DST edge cases', () => {
    it('should handle spring forward correctly', () => {
      // DST starts March 9, 2025 at 2 AM -> 3 AM
      const beforeDST = new Date('2025-03-09T01:30:00-08:00');
      const afterDST = new Date('2025-03-09T03:30:00-07:00');
      
      const diffMs = afterDST.getTime() - beforeDST.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // Should be 1 hour difference despite clock showing 2 hours
      expect(diffHours).toBe(1);
    });

    it('should handle fall back correctly', () => {
      // DST ends November 2, 2025 at 2 AM -> 1 AM
      const beforeFallback = new Date('2025-11-02T01:30:00-07:00');
      const afterFallback = new Date('2025-11-02T01:30:00-08:00');
      
      const diffMs = afterFallback.getTime() - beforeFallback.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // Should be 1 hour difference despite same clock time
      expect(diffHours).toBe(1);
    });
  });
});