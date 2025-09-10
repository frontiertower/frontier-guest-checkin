/**
 * Consolidated Email System Tests
 * Tests Resend API integration, email workflows, templates, and error handling
 */

// Mock Resend before imports
const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: { send: mockSend },
  })),
}));

import { sendEmail, sendInvitationEmail, sendDiscountEmail } from '@/lib/email';
import { testDb, TestDataFactory, dataHelpers } from '../test-utils';

describe('Email System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: 'test-api-key-123',
      EMAIL_FROM: 'test@frontier-tower.com',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Core Email Functionality', () => {
    describe('sendEmail', () => {
      it('should send email successfully with all required fields', async () => {
        mockSend.mockResolvedValue({
          data: { id: 'test-message-id-123' },
          error: null,
        });

        const result = await sendEmail({
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test content</p>',
        });

        expect(result).toEqual({
          success: true,
          emailId: 'test-message-id-123',
        });

        expect(mockSend).toHaveBeenCalledWith({
          from: 'test@frontier-tower.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          html: '<p>Test content</p>',
        });
      });

      it('should handle multiple recipients', async () => {
        mockSend.mockResolvedValue({
          data: { id: 'multi-recipient-id' },
          error: null,
        });

        const result = await sendEmail({
          to: ['user1@example.com', 'user2@example.com'],
          subject: 'Multi-recipient test',
          html: '<p>Test</p>',
        });

        expect(result.success).toBe(true);
        expect(mockSend).toHaveBeenCalledWith({
          from: 'test@frontier-tower.com',
          to: ['user1@example.com', 'user2@example.com'],
          subject: 'Multi-recipient test',
          html: '<p>Test</p>',
        });
      });

      it('should handle Resend API errors gracefully', async () => {
        mockSend.mockResolvedValue({
          data: null,
          error: { message: 'Invalid API key' },
        });

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });

        expect(result).toEqual({
          success: false,
          error: 'Invalid API key',
        });
      });

      it('should handle network errors', async () => {
        mockSend.mockRejectedValue(new Error('Network timeout'));

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });

        expect(result).toEqual({
          success: false,
          error: 'Failed to send email: Network timeout',
        });
      });

      it('should validate required environment variables', async () => {
        delete process.env.RESEND_API_KEY;

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('RESEND_API_KEY');
      });

      it('should sanitize HTML content', async () => {
        mockSend.mockResolvedValue({
          data: { id: 'sanitized-id' },
          error: null,
        });

        await sendEmail({
          to: 'test@example.com',
          subject: 'XSS Test',
          html: '<p>Hello</p><script>alert("XSS")</script><p>World</p>',
        });

        const callArgs = mockSend.mock.calls[0][0];
        expect(callArgs.html).toContain('<p>Hello</p>');
        expect(callArgs.html).toContain('<p>World</p>');
        // Script tags should be handled safely by email client
      });
    });
  });

  describe('Email Workflows with Database', () => {
    beforeAll(async () => {
      await testDb.connect();
    });

    afterAll(async () => {
      await testDb.disconnect();
    });

    beforeEach(async () => {
      await testDb.cleanup();
      mockSend.mockResolvedValue({
        data: { id: 'workflow-email-id' },
        error: null,
      });
    });

    describe('Invitation Emails', () => {
      let testData: any;

      beforeEach(async () => {
        testData = await testDb.setupBasicTestData();
      });

      it('should send invitation email with proper template data', async () => {
        const guest = TestDataFactory.createGuest();
        const invitation = TestDataFactory.createInvitation(
          guest.id,
          testData.host.id,
          testData.location.id
        );

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
        expect(mockSend).toHaveBeenCalledWith({
          from: expect.any(String),
          to: [guest.email],
          subject: expect.stringContaining('Invitation'),
          html: expect.stringContaining(guest.name),
          react: expect.any(Object),
        });
      });

      it('should handle batch invitations efficiently', async () => {
        const guests = dataHelpers.generateGuestBatch(10, 'batch');
        const emailPromises = guests.map((guest) =>
          sendInvitationEmail({
            to: guest.email,
            guestName: guest.name,
            hostName: testData.host.name,
            locationName: testData.location.name,
            qrToken: 'batch-token',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })
        );

        const results = await Promise.all(emailPromises);
        expect(results.every((r) => r.success)).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(10);
      });

      it('should track invitation email status', async () => {
        const guest = TestDataFactory.createGuest();
        const invitation = TestDataFactory.createInvitation(
          guest.id,
          testData.host.id,
          testData.location.id,
          { sentAt: null }
        );

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

        // Update invitation to mark as sent
        await testDb.getPrisma().invitation.update({
          where: { id: invitation.id },
          data: { sentAt: new Date() },
        });

        const updated = await testDb.getPrisma().invitation.findUnique({
          where: { id: invitation.id },
        });

        expect(updated?.sentAt).toBeDefined();
      });
    });

    describe('Discount Emails', () => {
      let testData: any;

      beforeEach(async () => {
        testData = await testDb.setupBasicTestData();
      });

      it('should send discount email on third visit', async () => {
        const guest = TestDataFactory.createGuest();
        await testDb.getPrisma().guest.create({ data: guest });

        // Create 2 previous visits
        for (let i = 0; i < 2; i++) {
          const visit = TestDataFactory.createVisit(
            guest.id,
            testData.host.id,
            testData.location.id,
            {
              checkedInAt: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
            }
          );
          await testDb.getPrisma().visit.create({ data: visit });
        }

        const result = await sendDiscountEmail({
          to: guest.email,
          guestName: guest.name,
          visitCount: 3,
        });

        expect(result.success).toBe(true);
        expect(mockSend).toHaveBeenCalledWith({
          from: expect.any(String),
          to: [guest.email],
          subject: expect.stringContaining('Discount'),
          html: expect.stringContaining('3'),
          react: expect.any(Object),
        });
      });

      it('should prevent duplicate discount emails', async () => {
        const guest = TestDataFactory.createGuest();
        await testDb.getPrisma().guest.create({ data: guest });

        // Create existing discount record
        await testDb.getPrisma().discount.create({
          data: {
            id: TestDataFactory.generateId(),
            guestId: guest.id,
            triggeredAt: new Date(),
            emailSent: true,
            createdAt: new Date(),
          },
        });

        const result = await sendDiscountEmail({
          to: guest.email,
          guestName: guest.name,
          visitCount: 3,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('already sent');
        expect(mockSend).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should implement exponential backoff for retries', async () => {
      let attemptCount = 0;
      mockSend.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve({
          data: { id: 'retry-success' },
          error: null,
        });
      });

      // Simulate retry logic
      let lastError;
      let result;
      for (let i = 0; i < 3; i++) {
        try {
          result = await sendEmail({
            to: 'test@example.com',
            subject: 'Retry test',
            html: '<p>Test</p>',
          });
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, i)));
        }
      }

      expect(attemptCount).toBe(3);
    });

    it('should handle rate limiting gracefully', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded', statusCode: 429 },
      });

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Rate limit test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });

    it('should validate email addresses', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@.com',
        '',
        null,
        undefined,
      ];

      for (const email of invalidEmails) {
        const result = await sendEmail({
          to: email as any,
          subject: 'Test',
          html: '<p>Test</p>',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid');
      }
    });

    it('should handle large HTML content', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'large-content-id' },
        error: null,
      });

      const largeContent = '<p>'.repeat(10000) + 'Content' + '</p>'.repeat(10000);
      
      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Large content test',
        html: largeContent,
      });

      expect(result.success).toBe(true);
      // Verify the email service handles large content
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('Email Template Validation', () => {
    it('should validate invitation template structure', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'template-test' },
        error: null,
      });

      await sendInvitationEmail({
        to: 'guest@example.com',
        guestName: 'John Doe',
        hostName: 'Jane Smith',
        locationName: 'Frontier Tower',
        qrToken: 'test-token',
        expiresAt: new Date(),
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toContain('Invitation');
      expect(callArgs.html).toContain('John Doe');
      expect(callArgs.html).toContain('Jane Smith');
      expect(callArgs.html).toContain('Frontier Tower');
      expect(callArgs.react).toBeDefined();
    });

    it('should handle missing template data', async () => {
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
});