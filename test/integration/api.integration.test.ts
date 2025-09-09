/**
 * API Integration Tests
 * Tests all API endpoints with real database integration
 */

import { testDb, TestDataFactory, QRPayloadGenerator, httpHelpers, assertions, dataHelpers } from '../test-utils';

const API_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

describe('API Integration Tests', () => {
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

  describe('POST /api/checkin - Unified Check-in API', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should handle single guest check-in via guest object', async () => {
      const guest = TestDataFactory.createGuest();
      
      // Create guest in database first
      await testDb.getPrisma().guest.create({ data: guest });
      
      // Create acceptance for the guest
      await testDb.getPrisma().acceptance.create({
        data: TestDataFactory.createAcceptance(guest.id),
      });

      const { status, data } = await httpHelpers.makePostRequest(`${API_BASE}/api/checkin`, {
        guest: {
          e: guest.email,
          n: guest.name,
        },
        hostId: testData.host.id,
        locationId: testData.location.id,
      });

      expect(status).toBe(200);
      assertions.expectApiSuccess(data, (response) => {
        expect(response.results).toHaveLength(1);
        expect(response.results[0].success).toBe(true);
        expect(response.results[0].visitId).toBeDefined();
        expect(response.summary.successful).toBe(1);
        expect(response.summary.failed).toBe(0);
      });
    });

    it('should handle multi-guest check-in via guests array', async () => {
      const guests = dataHelpers.generateGuestBatch(3, 'multi');
      
      // Create guests in database
      for (const guest of guests) {
        const guestData = TestDataFactory.createGuest({
          email: guest.email,
          name: guest.name,
        });
        await testDb.getPrisma().guest.create({ data: guestData });
        await testDb.getPrisma().acceptance.create({
          data: TestDataFactory.createAcceptance(guestData.id),
        });
      }

      const { status, data } = await httpHelpers.makePostRequest(`${API_BASE}/api/checkin`, {
        guests: guests.map(g => ({ e: g.email, n: g.name })),
        hostId: testData.host.id,
        locationId: testData.location.id,
      });

      expect(status).toBe(200);
      assertions.expectApiSuccess(data, (response) => {
        expect(response.results).toHaveLength(3);
        expect(response.results.every(r => r.success)).toBe(true);
        expect(response.summary.successful).toBe(3);
        expect(response.summary.failed).toBe(0);
      });
    });

    it('should handle QR token with guest batch payload', async () => {
      // Create 2 test guests
      const guestData = [
        { email: 'qr1@test.example.com', name: 'QR Guest 1' },
        { email: 'qr2@test.example.com', name: 'QR Guest 2' },
      ];
      
      const guests = [];
      for (const data of guestData) {
        const guest = await prisma.guest.create({ data: createTestGuest(data) });
        await prisma.acceptance.create({
          data: {
            id: faker.string.uuid(),
            guestId: guest.id,
            acceptedAt: new Date(),
          },
        });
        guests.push(guest);
      }

      // Create QR payload in expected format
      const qrPayload = JSON.stringify({
        guests: guests.map(g => ({ e: g.email, n: g.name })),
      });

      const { status, data } = await makeApiRequest(`${API_BASE}/api/checkin`, {
        token: qrPayload,
        hostId: host.id,
        locationId: location.id,
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(2);
      expect(data.summary.successful).toBe(2);
    });

    it('should handle capacity limit violations with proper error messages', async () => {
      // Set very low capacity limit
      await testDb.getPrisma().policy.updateMany({
        data: { hostConcurrentLimit: 1 },
      });

      const guests = dataHelpers.generateGuestBatch(2, 'capacity');
      
      // Create guests
      for (const guest of guests) {
        const guestData = TestDataFactory.createGuest({
          email: guest.email,
          name: guest.name,
        });
        await testDb.getPrisma().guest.create({ data: guestData });
        await testDb.getPrisma().acceptance.create({
          data: TestDataFactory.createAcceptance(guestData.id),
        });
      }

      const { status, data } = await httpHelpers.makePostRequest(`${API_BASE}/api/checkin`, {
        guests: guests.map(g => ({ e: g.email, n: g.name })),
        hostId: testData.host.id,
        locationId: testData.location.id,
      });

      expect(status).toBe(200);
      assertions.expectApiSuccess(data, (response) => {
        expect(response.results).toHaveLength(2);
        // First guest should succeed
        expect(response.results[0].success).toBe(true);
        // Second guest should fail due to capacity
        expect(response.results[1].success).toBe(false);
        expect(response.results[1].reason).toContain('capacity');
        expect(response.summary.successful).toBe(1);
        expect(response.summary.failed).toBe(1);
      });
    });

    it('should handle blacklisted guests appropriately', async () => {
      const blacklistedGuest = TestDataFactory.createBlacklistedGuest();
      
      await testDb.getPrisma().guest.create({ data: blacklistedGuest });

      const { status, data } = await httpHelpers.makePostRequest(`${API_BASE}/api/checkin`, {
        guest: {
          e: blacklistedGuest.email,
          n: blacklistedGuest.name,
        },
        hostId: testData.host.id,
        locationId: testData.location.id,
      });

      expect(status).toBe(200);
      assertions.expectApiSuccess(data, (response) => {
        expect(response.results).toHaveLength(1);
        expect(response.results[0].success).toBe(false);
        expect(response.results[0].reason).toContain('not authorized');
      });
    });

    it('should auto-renew expired terms for returning guests', async () => {
      const returningGuest = TestDataFactory.createGuest({
        termsAcceptedAt: new Date('2020-01-01'), // Very old terms
      });
      
      await testDb.getPrisma().guest.create({ data: returningGuest });
      
      // Create old acceptance record
      await testDb.getPrisma().acceptance.create({
        data: TestDataFactory.createAcceptance(returningGuest.id, {
          acceptedAt: new Date('2020-01-01'),
        }),
      });

      const { status, data } = await httpHelpers.makePostRequest(`${API_BASE}/api/checkin`, {
        guest: {
          e: returningGuest.email,
          n: returningGuest.name,
        },
        hostId: testData.host.id,
        locationId: testData.location.id,
      });

      expect(status).toBe(200);
      assertions.expectApiSuccess(data, (response) => {
        expect(response.results).toHaveLength(1);
        expect(response.results[0].success).toBe(true);
        expect(response.results[0].acceptanceRenewed).toBe(true);
      });

      // Verify new acceptance was created
      const newAcceptance = await testDb.getPrisma().acceptance.findFirst({
        where: { guestId: returningGuest.id },
        orderBy: { acceptedAt: 'desc' },
      });
      expect(newAcceptance?.acceptedAt.getTime()).toBeGreaterThan(new Date('2024-01-01').getTime());
    });

    it('should handle security override scenarios', async () => {
      // Set capacity to 0 to force override scenario
      await testDb.getPrisma().policy.updateMany({
        data: { hostConcurrentLimit: 0 },
      });

      const guest = TestDataFactory.createGuest();
      await testDb.getPrisma().guest.create({ data: guest });
      await testDb.getPrisma().acceptance.create({
        data: TestDataFactory.createAcceptance(guest.id),
      });

      const { status, data } = await httpHelpers.makePostRequest(`${API_BASE}/api/checkin`, {
        guest: {
          e: guest.email,
          n: guest.name,
        },
        hostId: testData.host.id,
        locationId: testData.location.id,
        override: {
          reason: 'VIP Guest - Executive Request',
          password: process.env.OVERRIDE_PASSWORD || 'override123',
          userId: testData.security.id,
        },
      });

      expect(status).toBe(200);
      assertions.expectApiSuccess(data, (response) => {
        expect(response.results).toHaveLength(1);
        expect(response.results[0].success).toBe(true);
        
        // Verify override was logged
        expect(response.results[0].visitId).toBeDefined();
      });

      // Verify override was recorded in visit
      const visit = await testDb.getPrisma().visit.findFirst({
        where: { guestId: guest.id },
      });
      expect(visit?.overrideReason).toBe('VIP Guest - Executive Request');
      expect(visit?.overrideUserId).toBe(testData.security.id);
    });
  });

  describe('POST /api/invitations - Invitation Management', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should create single guest invitation', async () => {
      const guestData = {
        email: dataHelpers.generateTestEmail('invite'),
        name: 'Test Guest',
        phone: dataHelpers.generateTestPhoneNumber(),
      };

      const { status, data } = await httpHelpers.makePostRequest(`${API_BASE}/api/invitations`, {
        guests: [guestData],
        hostId: testData.host.id,
        locationId: testData.location.id,
      });

      expect(status).toBe(200);
      assertions.expectApiSuccess(data, (response) => {
        expect(response.invitation).toBeDefined();
        expect(response.qrCode).toBeDefined();
        expect(response.invitation.guestEmail).toBe(guestData.email);
        expect(response.invitation.guestName).toBe(guestData.name);
      });

      // Verify invitation was created in database
      const invitation = await testDb.getPrisma().invitation.findUnique({
        where: { id: data.invitation.id },
      });
      expect(invitation).toBeDefined();
      expect(invitation?.status).toBe('PENDING');
    });

    it('should create multi-guest invitations', async () => {
      const guests = [
        { email: 'multi1@test.example.com', name: 'Multi Guest 1', phone: '+1234567891' },
        { email: 'multi2@test.example.com', name: 'Multi Guest 2', phone: '+1234567892' },
        { email: 'multi3@test.example.com', name: 'Multi Guest 3', phone: '+1234567893' },
      ];

      const { status, data } = await makeApiRequest(`${API_BASE}/api/invitations`, {
        guests,
        hostId: host.id,
        locationId: location.id,
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.invitations).toHaveLength(3);
      expect(data.qrCodes).toHaveLength(3);

      // Verify all invitations were created
      const invitations = await prisma.invitation.findMany({ where: { hostId: host.id } });
      expect(invitations).toHaveLength(3);
      expect(invitations.every(i => i.status === 'PENDING')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let testData: any;

    beforeEach(async () => {
      testData = await testDb.setupBasicTestData();
    });

    it('should handle malformed QR payloads gracefully', async () => {
      const { status, data } = await makeApiRequest(`${API_BASE}/api/checkin`, {
        token: '{"malformed": json}', // Invalid JSON
        hostId: host.id,
        locationId: location.id,
      });

      expect(status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error || data.message).toMatch(/invalid.*format/i);
    });

    it('should handle missing required fields', async () => {
      const { status, data } = await makeApiRequest(`${API_BASE}/api/checkin`, {
        // Missing guest data entirely
        hostId: host.id,
        locationId: location.id,
      });

      expect(status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error || data.message).toMatch(/missing.*guest/i);
    });

    it('should handle invalid host ID', async () => {
      const guest = TestDataFactory.createGuest();
      await testDb.getPrisma().guest.create({ data: guest });

      const { status, data } = await httpHelpers.makePostRequest(`${API_BASE}/api/checkin`, {
        guest: {
          e: guest.email,
          n: guest.name,
        },
        hostId: 'non-existent-host',
        locationId: testData.location.id,
      });

      expect(status).toBe(404);
      assertions.expectApiError(data, /host.*not.*found/i);
    });

    it('should handle non-existent location gracefully', async () => {
      const guest = await prisma.guest.create({ 
        data: createTestGuest({ email: 'invalid-location@test.example.com' }) 
      });
      await prisma.acceptance.create({
        data: {
          id: faker.string.uuid(),
          guestId: guest.id,
          acceptedAt: new Date(),
        },
      });

      const { status, data } = await makeApiRequest(`${API_BASE}/api/checkin`, {
        guest: { e: guest.email, n: guest.name },
        hostId: host.id,
        locationId: 'non-existent-location',
      });

      expect(status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error || data.message).toMatch(/location.*not.*found/i);
    });
  });
});