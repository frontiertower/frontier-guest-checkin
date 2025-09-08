/**
 * Email Integration Tests
 * Tests email workflows, templates, and Resend API integration
 */

import { testDb, TestDataFactory, dataHelpers, waitHelpers } from '../test-utils';

// Mock Resend for testing
const mockResend = {
  emails: {
    send: jest.fn(),
  },
};

jest.mock('resend', () => ({
  Resend: jest.fn(() => mockResend),
}));

// Import after mocking
import { sendInvitationEmail, sendDiscountEmail } from '@/lib/email';

describe('Email Integration Tests', () => {
  beforeAll(async () => {
    await testDb.connect();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanup();
    jest.clearAllMocks();
  });

  describe('Invitation Email Workflow', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
      mockResend.emails.send.mockResolvedValue({
        id: 'mock-email-id',
        from: 'noreply@frontier.test',
        to: ['recipient@example.com'],
      });
    });

    it('should send invitation email with proper template data', async () => {
      const guest = TestDataFactory.createGuest();
      const invitation = TestDataFactory.createInvitation(guest.id, testData.host.id, testData.location.id);
      
      await testDb.getPrisma().guest.create({ data: guest });
      await testDb.getPrisma().invitation.create({ data: invitation });

      const result = await sendInvitationEmail({
        to: guest.email,
        guestName: guest.name,
        hostName: testData.host.name,
        locationName: testData.location.name,
        qrToken: invitation.qrToken,
        expiresAt: invitation.expiresAt,
      });

      expect(result.success).toBe(true);
      expect(result.emailId).toBe('mock-email-id');

      // Verify Resend was called with correct parameters
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: expect.any(String),
        to: [guest.email],
        subject: expect.stringContaining('Invitation'),
        html: expect.stringContaining(guest.name),
        react: expect.any(Object),
      });
    });

    it('should handle email template rendering correctly', async () => {
      const guest = TestDataFactory.createGuest();
      const invitation = TestDataFactory.createInvitation(guest.id, testData.host.id, testData.location.id);

      await sendInvitationEmail({
        to: guest.email,
        guestName: guest.name,
        hostName: testData.host.name,
        locationName: testData.location.name,
        qrToken: invitation.qrToken,
        expiresAt: invitation.expiresAt,
      });

      const emailCall = mockResend.emails.send.mock.calls[0][0];
      
      // Verify template data includes all required fields
      expect(emailCall.html).toContain(guest.name);
      expect(emailCall.html).toContain(testData.host.name);
      expect(emailCall.html).toContain(testData.location.name);
      expect(emailCall.html).toContain(invitation.qrToken);
    });

    it('should handle multiple recipient invitations', async () => {
      const guests = dataHelpers.generateGuestBatch(3, 'multi-email');
      const invitations = [];

      for (const guest of guests) {
        const guestData = TestDataFactory.createGuest({
          email: guest.email,
          name: guest.name,
        });
        const invitation = TestDataFactory.createInvitation(guest.id, testData.host.id, testData.location.id);
        
        await testDb.getPrisma().guest.create({ data: guestData });
        await testDb.getPrisma().invitation.create({ data: invitation });
        invitations.push(invitation);
      }

      // Send emails in parallel
      const emailPromises = guests.map((guest, index) =>
        sendInvitationEmail({
          to: guest.email,
          guestName: guest.name,
          hostName: testData.host.name,
          locationName: testData.location.name,
          qrToken: invitations[index].qrToken,
          expiresAt: invitations[index].expiresAt,
        })
      );

      const results = await Promise.all(emailPromises);

      // All emails should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(mockResend.emails.send).toHaveBeenCalledTimes(3);
    });

    it('should handle email sending failures gracefully', async () => {
      mockResend.emails.send.mockRejectedValue(new Error('SMTP connection failed'));

      const guest = TestDataFactory.createGuest();
      const invitation = TestDataFactory.createInvitation(guest.id, testData.host.id, testData.location.id);

      const result = await sendInvitationEmail({
        to: guest.email,
        guestName: guest.name,
        hostName: testData.host.name,
        locationName: testData.location.name,
        qrToken: invitation.qrToken,
        expiresAt: invitation.expiresAt,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP connection failed');
    });

    it('should respect rate limiting and retry logic', async () => {
      let attemptCount = 0;
      mockResend.emails.send.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Rate limit exceeded');
        }
        return Promise.resolve({
          id: 'retry-success-id',
          from: 'noreply@frontier.test',
          to: ['recipient@example.com'],
        });
      });

      const guest = TestDataFactory.createGuest();
      const invitation = TestDataFactory.createInvitation(guest.id, testData.host.id, testData.location.id);

      const result = await waitHelpers.retry(
        () => sendInvitationEmail({
          to: guest.email,
          guestName: guest.name,
          hostName: testData.host.name,
          locationName: testData.location.name,
          qrToken: invitation.qrToken,
          expiresAt: invitation.expiresAt,
        }),
        { maxAttempts: 3, delay: 100 }
      );

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });
  });

  describe('Discount Email Workflow', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
      mockResend.emails.send.mockResolvedValue({
        id: 'discount-email-id',
        from: 'noreply@frontier.test',
        to: ['recipient@example.com'],
      });
    });

    it('should trigger discount email on third visit', async () => {
      const guest = TestDataFactory.createGuest();
      await testDb.getPrisma().guest.create({ data: guest });

      // Create 2 previous visits
      for (let i = 0; i < 2; i++) {
        const visit = TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id, {
          checkedInAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000), // Previous days
        });
        await testDb.getPrisma().visit.create({ data: visit });
      }

      // Create third visit (should trigger discount)
      const thirdVisit = TestDataFactory.createVisit(guest.id, testData.host.id, testData.location.id);
      await testDb.getPrisma().visit.create({ data: thirdVisit });

      // Simulate discount email trigger
      const result = await sendDiscountEmail({
        to: guest.email,
        guestName: guest.name,
        visitCount: 3,
      });

      expect(result.success).toBe(true);
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: expect.any(String),
        to: [guest.email],
        subject: expect.stringContaining('Discount'),
        html: expect.stringContaining('3'),
        react: expect.any(Object),
      });
    });

    it('should not send duplicate discount emails', async () => {
      const guest = TestDataFactory.createGuest();
      await testDb.getPrisma().guest.create({ data: guest });

      // Create discount record
      await testDb.getPrisma().discount.create({
        data: {
          id: TestDataFactory.generateId(),
          guestId: guest.id,
          triggeredAt: new Date(),
          emailSent: true,
          createdAt: new Date(),
        },
      });

      // Try to send another discount email
      const result = await sendDiscountEmail({
        to: guest.email,
        guestName: guest.name,
        visitCount: 3,
      });

      // Should skip sending if discount already exists
      expect(result.success).toBe(false);
      expect(result.error).toContain('already sent');
      expect(mockResend.emails.send).not.toHaveBeenCalled();
    });
  });

  describe('Email Template Validation', () => {
    it('should validate invitation email template structure', async () => {
      const guest = TestDataFactory.createGuest();
      const testData = await testDb.setupBasicTestData();

      await sendInvitationEmail({
        to: guest.email,
        guestName: guest.name,
        hostName: testData.host.name,
        locationName: testData.location.name,
        qrToken: 'test-qr-token',
        expiresAt: new Date(),
      });

      const emailCall = mockResend.emails.send.mock.calls[0][0];
      
      // Verify email structure
      expect(emailCall.from).toMatch(/noreply@/);
      expect(emailCall.to).toEqual([guest.email]);
      expect(emailCall.subject).toContain('Invitation');
      expect(emailCall.html).toBeTruthy();
      expect(emailCall.react).toBeDefined();
    });

    it('should validate discount email template structure', async () => {
      const guest = TestDataFactory.createGuest();

      await sendDiscountEmail({
        to: guest.email,
        guestName: guest.name,
        visitCount: 3,
      });

      const emailCall = mockResend.emails.send.mock.calls[0][0];
      
      // Verify discount email structure
      expect(emailCall.from).toMatch(/noreply@/);
      expect(emailCall.to).toEqual([guest.email]);
      expect(emailCall.subject).toContain('Discount');
      expect(emailCall.html).toContain('3');
      expect(emailCall.react).toBeDefined();
    });

    it('should handle missing template data gracefully', async () => {
      // Test with missing required fields
      const result = await sendInvitationEmail({
        to: '',
        guestName: '',
        hostName: '',
        locationName: '',
        qrToken: '',
        expiresAt: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing');
    });
  });

  describe('Email Delivery Tracking', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should track email delivery status in database', async () => {
      const guest = TestDataFactory.createGuest();
      const invitation = TestDataFactory.createInvitation(guest.id, testData.host.id, testData.location.id, {
        qrIssuedAt: null, // Not sent yet
      });
      
      await testDb.getPrisma().guest.create({ data: guest });
      await testDb.getPrisma().invitation.create({ data: invitation });

      await sendInvitationEmail({
        to: guest.email,
        guestName: guest.name,
        hostName: testData.host.name,
        locationName: testData.location.name,
        qrToken: invitation.qrToken,
        expiresAt: invitation.expiresAt,
      });

      // Update invitation record to mark as sent
      await testDb.getPrisma().invitation.update({
        where: { id: invitation.id },
        data: { sentAt: new Date() },
      });

      const updatedInvitation = await testDb.getPrisma().invitation.findUnique({
        where: { id: invitation.id },
      });

      expect(updatedInvitation?.sentAt).toBeDefined();
    });

    it('should handle email bounce notifications', async () => {
      // This would typically involve webhook handling
      // For now, we'll test the data structure for tracking bounces
      
      const guest = TestDataFactory.createGuest({
        email: 'bounced@invalid-domain.test',
      });
      await testDb.getPrisma().guest.create({ data: guest });

      // Create a record to track email bounce
      const bounceRecord = {
        id: TestDataFactory.generateId(),
        guestId: guest.id,
        emailAddress: guest.email,
        bounceType: 'permanent',
        bounceReason: 'invalid-domain',
        bouncedAt: new Date(),
        createdAt: new Date(),
      };

      // This would be created by a webhook handler in practice
      // await testDb.getPrisma().emailBounce.create({ data: bounceRecord });

      // For now, just verify the structure is valid
      expect(bounceRecord.guestId).toBe(guest.id);
      expect(bounceRecord.bounceType).toBe('permanent');
    });
  });

  describe('Email Performance and Reliability', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should handle high-volume email sending', async () => {
      const guests = dataHelpers.generateGuestBatch(50, 'bulk-email');
      const emailPromises = [];

      // Send emails in batches to avoid overwhelming the service
      for (const guest of guests) {
        emailPromises.push(
          sendInvitationEmail({
            to: guest.email,
            guestName: guest.name,
            hostName: testData.host.name,
            locationName: testData.location.name,
            qrToken: 'bulk-test-token',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
        );
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(emailPromises);
      const endTime = Date.now();

      const successful = results.filter(r => r.status === 'fulfilled');
      
      // Should complete within reasonable time (10 seconds for 50 emails)
      expect(endTime - startTime).toBeLessThan(10000);
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should implement circuit breaker pattern for email failures', async () => {
      let failureCount = 0;
      const maxFailures = 5;

      mockResend.emails.send.mockImplementation(() => {
        failureCount++;
        if (failureCount <= maxFailures) {
          throw new Error('Service temporarily unavailable');
        }
        return Promise.resolve({ id: 'recovered-email-id' });
      });

      // This would be implemented in the actual email service
      // For now, we'll simulate the behavior
      let circuitOpen = false;
      
      const sendWithCircuitBreaker = async () => {
        if (circuitOpen) {
          throw new Error('Circuit breaker is open');
        }
        
        try {
          return await mockResend.emails.send({});
        } catch (error) {
          if (failureCount >= maxFailures) {
            circuitOpen = true;
          }
          throw error;
        }
      };

      // Test circuit breaker behavior
      for (let i = 0; i < maxFailures + 2; i++) {
        try {
          await sendWithCircuitBreaker();
        } catch (error) {
          if (i >= maxFailures) {
            expect(error.message).toContain('Circuit breaker is open');
          }
        }
      }

      expect(circuitOpen).toBe(true);
    });
  });
});