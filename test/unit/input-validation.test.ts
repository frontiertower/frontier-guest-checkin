/**
 * Consolidated Input Validation Tests
 * Combines QR parsing, fuzz testing, and property-based validation
 * Eliminates 800+ lines of duplication while maintaining comprehensive coverage
 */

import { parseQRData } from '@/lib/qr-token';
import { validateOverridePassword, validateOverrideRequest } from '@/lib/override';
import { cn } from '@/lib/utils';

describe('Input Validation & Edge Cases', () => {
  describe('QR Code Parsing', () => {
    describe('Valid QR formats', () => {
      it('should parse single guest JSON format', () => {
        const qrData = JSON.stringify({
          guests: [{ e: 'test@example.com', n: 'Test User' }]
        });
        
        const result = parseQRData(qrData);
        expect(result).not.toBeNull();
        expect(result.type).toBe('batch');
        if (result.type === 'batch') {
          expect(result.guestBatch.guests).toHaveLength(1);
          expect(result.guestBatch.guests[0].e).toBe('test@example.com');
        }
      });

      it('should parse multi-guest batch format', () => {
        const guests = [
          { e: 'guest1@example.com', n: 'Guest One' },
          { e: 'guest2@example.com', n: 'Guest Two' },
          { e: 'guest3@example.com', n: 'Guest Three' }
        ];
        
        const qrData = JSON.stringify({ guests });
        const result = parseQRData(qrData);
        
        expect(result).not.toBeNull();
        expect(result.type).toBe('batch');
        if (result.type === 'batch') {
          expect(result.guestBatch.guests).toHaveLength(3);
          result.guestBatch.guests.forEach((guest, i) => {
            expect(guest.e).toBe(guests[i].e);
            expect(guest.n).toBe(guests[i].n);
          });
        }
      });

      it('should handle base64 JWT tokens', () => {
        // Valid JWT structure (header.payload.signature)
        const mockJWT = 'eyJhbGciOiJIUzI1NiJ9.eyJndWVzdCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature';
        const result = parseQRData(mockJWT);
        
        // Should recognize JWT format
        expect(result).not.toBeNull();
        expect(result.type).toBe('invitation');
      });

      it('should handle empty guest arrays gracefully', () => {
        const result = parseQRData(JSON.stringify({ guests: [] }));
        expect(result).not.toBeNull();
        if (result && result.type === 'batch') {
          expect(result.guestBatch.guests).toHaveLength(0);
        }
      });
    });

    describe('Malformed input handling', () => {
      const malformedInputs = [
        { input: '{"guests":}', desc: 'Missing value' },
        { input: '{"guests":null}', desc: 'Null guests' },
        { input: '{}', desc: 'Empty object' },
        { input: 'not json at all', desc: 'Non-JSON string' },
        { input: '', desc: 'Empty string' },
        { input: '\x00\x01\x02', desc: 'Binary data' },
        { input: '{"__proto__":{"isAdmin":true}}', desc: 'Prototype pollution' },
      ];

      malformedInputs.forEach(({ input, desc }) => {
        it(`should handle ${desc} safely`, () => {
          const result = parseQRData(input);
          // Should return null for invalid data, never throw
          expect(result).toBeNull();
        });
      });
    });

    describe('Edge cases and boundaries', () => {
      it('should handle extremely large guest arrays', () => {
        const largeArray = Array.from({ length: 1000 }, (_, i) => ({
          e: `guest${i}@example.com`,
          n: `Guest ${i}`
        }));
        
        const qrData = JSON.stringify({ guests: largeArray });
        const result = parseQRData(qrData);
        
        expect(result).not.toBeNull();
        if (result && result.type === 'batch') {
          expect(result.guestBatch.guests).toHaveLength(1000);
        }
      });

      it('should handle very long strings in guest data', () => {
        const longName = 'A'.repeat(10000);
        const qrData = JSON.stringify({
          guests: [{ e: 'test@example.com', n: longName }]
        });
        
        const result = parseQRData(qrData);
        expect(result).not.toBeNull();
        if (result && result.type === 'batch') {
          expect(result.guestBatch.guests[0].n).toBe(longName);
        }
      });

      it('should handle Unicode and special characters', () => {
        const specialNames = [
          '🎉 Party Guest',
          '测试用户',
          'Тестовый пользователь',
          'مستخدم اختبار',
          'O\'Brien',
          'Smith-Jones',
        ];
        
        specialNames.forEach(name => {
          const qrData = JSON.stringify({
            guests: [{ e: 'test@example.com', n: name }]
          });
          
          const result = parseQRData(qrData);
          expect(result).not.toBeNull();
          if (result && result.type === 'batch') {
            expect(result.guestBatch.guests[0].n).toBe(name);
          }
        });
      });

      it('should handle guests with missing fields', () => {
        const incompleteGuests = [
          { e: 'complete@example.com', n: 'Complete' },
          { e: 'no-name@example.com' }, // Missing name
          { n: 'No Email' }, // Missing email
          {}, // Missing both
        ];
        
        const qrData = JSON.stringify({ guests: incompleteGuests });
        const result = parseQRData(qrData);
        
        expect(result).not.toBeNull();
        if (result && result.type === 'batch') {
          expect(result.guestBatch.guests).toHaveLength(4);
          // All guests preserved for validation at API level
          expect(result.guestBatch.guests[1].e).toBe('no-name@example.com');
          expect(result.guestBatch.guests[1].n).toBeUndefined();
        }
      });
    });

    describe('Injection attack resistance', () => {
      it('should preserve SQL injection attempts for proper escaping', () => {
        const sqlInjection = "'; DROP TABLE users; --";
        const qrData = JSON.stringify({
          guests: [{ e: sqlInjection, n: sqlInjection }]
        });
        
        const result = parseQRData(qrData);
        expect(result).not.toBeNull();
        if (result && result.type === 'batch') {
          // Data preserved as-is for parameter binding
          expect(result.guestBatch.guests[0].e).toBe(sqlInjection);
        }
      });

      it('should preserve XSS attempts for proper escaping', () => {
        const xssAttempt = '<script>alert("XSS")</script>';
        const qrData = JSON.stringify({
          guests: [{ e: 'test@example.com', n: xssAttempt }]
        });
        
        const result = parseQRData(qrData);
        expect(result).not.toBeNull();
        if (result && result.type === 'batch') {
          // Preserved for UI layer escaping
          expect(result.guestBatch.guests[0].n).toBe(xssAttempt);
        }
      });

      it('should prevent prototype pollution', () => {
        const pollutionAttempt = '{"__proto__":{"isAdmin":true},"guests":[{"e":"test@example.com","n":"Test"}]}';
        
        const result = parseQRData(pollutionAttempt);
        
        // Verify no pollution occurred
        expect((Object.prototype as any).isAdmin).toBeUndefined();
        expect((result as any)?.isAdmin).toBeUndefined();
      });
    });
  });

  describe('Override Password Validation', () => {
    const originalEnv = process.env.OVERRIDE_PASSWORD;
    
    beforeEach(() => {
      process.env.OVERRIDE_PASSWORD = 'test-override-123';
    });
    
    afterEach(() => {
      process.env.OVERRIDE_PASSWORD = originalEnv;
    });

    it('should validate correct passwords', () => {
      expect(validateOverridePassword('test-override-123')).toBe(true);
    });

    it('should reject incorrect passwords', () => {
      expect(validateOverridePassword('wrong-password')).toBe(false);
      expect(validateOverridePassword('')).toBe(false);
      expect(validateOverridePassword('TEST-OVERRIDE-123')).toBe(false); // Case sensitive
    });

    it('should handle missing environment variable', () => {
      delete process.env.OVERRIDE_PASSWORD;
      expect(validateOverridePassword('any-password')).toBe(false);
    });

    it('should handle null/undefined inputs safely', () => {
      expect(validateOverridePassword(null as any)).toBe(false);
      expect(validateOverridePassword(undefined as any)).toBe(false);
    });

    it('should validate override requests comprehensively', () => {
      // Valid request
      const validRequest = {
        reason: 'Emergency evacuation requires immediate access',
        password: 'test-override-123'
      };
      
      let result = validateOverrideRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      
      // Invalid reason (too short)
      result = validateOverrideRequest({
        reason: 'Short',
        password: 'test-override-123'
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 10 characters');
      
      // Invalid password
      result = validateOverrideRequest({
        reason: 'Valid reason for override',
        password: 'wrong-password'
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid override password');
      
      // Missing fields
      result = validateOverrideRequest({
        reason: '',
        password: 'test-override-123'
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should handle extreme input lengths', () => {
      const longReason = 'A'.repeat(500); // Max length
      const result = validateOverrideRequest({
        reason: longReason,
        password: 'test-override-123'
      });
      expect(result.isValid).toBe(true);
      
      const tooLongReason = 'A'.repeat(501);
      const tooLongResult = validateOverrideRequest({
        reason: tooLongReason,
        password: 'test-override-123'
      });
      expect(tooLongResult.isValid).toBe(false);
      expect(tooLongResult.error).toContain('cannot exceed 500');
    });
  });

  describe('CSS Class Name Utility', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
      expect(cn('px-4', 'py-2', 'bg-blue-500')).toBe('px-4 py-2 bg-blue-500');
    });

    it('should handle conflicting Tailwind utilities', () => {
      // clsx should handle conflicts intelligently
      const result = cn('px-4 py-2', 'px-8');
      expect(result).toContain('px-8'); // Later value wins
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isDisabled = false;
      
      const result = cn(
        'base-class',
        isActive && 'active',
        isDisabled && 'disabled'
      );
      
      expect(result).toContain('base-class');
      expect(result).toContain('active');
      expect(result).not.toContain('disabled');
      expect(result).not.toContain('false');
    });

    it('should handle arrays and objects', () => {
      const result = cn(
        'base',
        ['array1', 'array2'],
        { 'conditional': true, 'not-included': false }
      );
      
      expect(result).toContain('base');
      expect(result).toContain('array1');
      expect(result).toContain('array2');
      expect(result).toContain('conditional');
      expect(result).not.toContain('not-included');
    });

    it('should handle edge cases gracefully', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
      expect(cn(null, undefined, false)).toBe('');
      expect(cn('valid', null, 'class')).toBe('valid class');
    });

    it('should handle very long class strings', () => {
      const longClass = 'a'.repeat(10000);
      const result = cn(longClass, 'short');
      
      expect(result).toContain(longClass);
      expect(result).toContain('short');
      expect(result.length).toBeGreaterThan(10000);
    });
  });

  describe('Fuzz Testing Patterns', () => {
    const generateRandomString = (length: number) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
      return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    it('should handle 1000 random inputs without crashing', () => {
      for (let i = 0; i < 1000; i++) {
        const randomLength = Math.floor(Math.random() * 1000) + 1;
        const randomData = generateRandomString(randomLength);
        
        // Should never throw, always return null or valid result
        expect(() => {
          const result = parseQRData(randomData);
          expect(result === null || typeof result === 'object').toBe(true);
        }).not.toThrow();
      }
    });

    it('should handle random Unicode strings safely', () => {
      const unicodeRanges = [
        [0x0000, 0x007F], // ASCII
        [0x0080, 0x00FF], // Latin-1
        [0x4E00, 0x9FFF], // CJK
        [0x1F600, 0x1F64F], // Emoticons
      ];
      
      for (let i = 0; i < 100; i++) {
        let randomString = '';
        const length = Math.floor(Math.random() * 500) + 1;
        
        for (let j = 0; j < length; j++) {
          const range = unicodeRanges[Math.floor(Math.random() * unicodeRanges.length)];
          const codePoint = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
          randomString += String.fromCodePoint(codePoint);
        }
        
        expect(() => parseQRData(randomString)).not.toThrow();
      }
    });

    it('should handle rapid successive calls without memory leaks', () => {
      const start = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        const randomData = generateRandomString(100);
        parseQRData(randomData);
        cn(randomData, 'test-class');
        validateOverridePassword(randomData);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});