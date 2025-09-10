/**
 * Admin API Endpoint Tests
 * Tests for admin-specific API endpoints that were previously untested
 */

import { testDb, TestDataFactory, httpHelpers } from '../test-utils';
import { faker } from '@faker-js/faker';

const API_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

describe('Admin API Endpoints', () => {
  let adminUser: any;
  let testLocation: any;

  beforeAll(async () => {
    await testDb.connect();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanup();
    
    // Setup admin user and location
    testLocation = await testDb.getPrisma().location.create({
      data: TestDataFactory.createLocation(),
    });
    
    adminUser = await testDb.getPrisma().user.create({
      data: TestDataFactory.createUser({
        role: 'admin',
        primaryLocationId: testLocation.id,
      }),
    });
  });

  describe('GET /api/admin/reports', () => {
    beforeEach(async () => {
      // Create test data for reports
      const host = await testDb.getPrisma().user.create({
        data: TestDataFactory.createUser({ role: 'host' }),
      });

      // Create visits across different time periods
      for (let i = 0; i < 10; i++) {
        const guest = await testDb.getPrisma().guest.create({
          data: TestDataFactory.createGuest(),
        });
        
        await testDb.getPrisma().visit.create({
          data: TestDataFactory.createVisit(
            guest.id,
            host.id,
            testLocation.id,
            { checkedInAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000) }
          ),
        });
      }
    });

    it('should generate daily report', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/reports?period=daily`
      );

      expect(status).toBe(200);
      expect(data).toHaveProperty('period', 'daily');
      expect(data).toHaveProperty('totalVisits');
      expect(data).toHaveProperty('uniqueGuests');
      expect(data).toHaveProperty('peakHours');
      expect(data).toHaveProperty('topHosts');
    });

    it('should generate weekly report', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/reports?period=weekly`
      );

      expect(status).toBe(200);
      expect(data).toHaveProperty('period', 'weekly');
      expect(data).toHaveProperty('weeklyTrends');
      expect(Array.isArray(data.weeklyTrends)).toBe(true);
    });

    it('should generate monthly report', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/reports?period=monthly`
      );

      expect(status).toBe(200);
      expect(data).toHaveProperty('period', 'monthly');
      expect(data).toHaveProperty('monthlyComparison');
      expect(data).toHaveProperty('averageDailyVisits');
    });

    it('should filter reports by location', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/reports?period=daily&locationId=${testLocation.id}`
      );

      expect(status).toBe(200);
      expect(data).toHaveProperty('locationId', testLocation.id);
      expect(data).toHaveProperty('locationName', testLocation.name);
    });

    it('should handle invalid period parameter', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/reports?period=invalid`
      );

      expect(status).toBe(400);
      expect(data.error).toContain('Invalid period');
    });
  });

  describe('GET /api/admin/activity', () => {
    beforeEach(async () => {
      // Create recent activities
      const host = await testDb.getPrisma().user.create({
        data: TestDataFactory.createUser({ role: 'host' }),
      });

      for (let i = 0; i < 5; i++) {
        const guest = await testDb.getPrisma().guest.create({
          data: TestDataFactory.createGuest(),
        });
        
        const visit = await testDb.getPrisma().visit.create({
          data: TestDataFactory.createVisit(
            guest.id,
            host.id,
            testLocation.id,
            { 
              checkedInAt: new Date(Date.now() - i * 60 * 60 * 1000),
              overrideUsed: i === 0, // First one has override
            }
          ),
        });

        if (i === 0) {
          await testDb.getPrisma().override.create({
            data: {
              id: faker.string.uuid(),
              visitId: visit.id,
              userId: adminUser.id,
              reason: 'VIP Guest',
              createdAt: new Date(),
            },
          });
        }
      }
    });

    it('should return recent activity feed', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/activity`
      );

      expect(status).toBe(200);
      expect(Array.isArray(data.activities)).toBe(true);
      expect(data.activities.length).toBeGreaterThan(0);
      
      const activity = data.activities[0];
      expect(activity).toHaveProperty('type');
      expect(activity).toHaveProperty('timestamp');
      expect(activity).toHaveProperty('details');
    });

    it('should include override activities', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/activity`
      );

      expect(status).toBe(200);
      
      const overrideActivity = data.activities.find((a: any) => a.type === 'override');
      expect(overrideActivity).toBeDefined();
      expect(overrideActivity.details).toHaveProperty('reason', 'VIP Guest');
      expect(overrideActivity.details).toHaveProperty('authorizedBy');
    });

    it('should paginate activities', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/activity?limit=2&offset=0`
      );

      expect(status).toBe(200);
      expect(data.activities).toHaveLength(2);
      expect(data).toHaveProperty('hasMore', true);
      expect(data).toHaveProperty('total');
    });

    it('should filter by activity type', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/activity?type=checkin`
      );

      expect(status).toBe(200);
      expect(data.activities.every((a: any) => a.type === 'checkin')).toBe(true);
    });

    it('should filter by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/activity?from=${yesterday}&to=${tomorrow}`
      );

      expect(status).toBe(200);
      expect(data.activities.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/search', () => {
    beforeEach(async () => {
      // Create searchable data
      await testDb.getPrisma().guest.create({
        data: TestDataFactory.createGuest({
          name: 'John Doe',
          email: 'john.doe@example.com',
          company: 'Acme Corp',
        }),
      });

      await testDb.getPrisma().guest.create({
        data: TestDataFactory.createGuest({
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          phone: '+1234567890',
        }),
      });

      await testDb.getPrisma().user.create({
        data: TestDataFactory.createUser({
          name: 'John Host',
          email: 'john.host@frontier.com',
          role: 'host',
        }),
      });
    });

    it('should search guests by name', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/search?q=${encodeURIComponent('John')}`
      );

      expect(status).toBe(200);
      expect(data.results).toHaveLength(2); // Guest and Host named John
      expect(data.results[0]).toHaveProperty('type');
      expect(data.results[0]).toHaveProperty('name');
    });

    it('should search by email', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/search?q=${encodeURIComponent('jane.smith@example.com')}`
      );

      expect(status).toBe(200);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].email).toBe('jane.smith@example.com');
    });

    it('should search by phone number', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/search?q=${encodeURIComponent('+1234567890')}`
      );

      expect(status).toBe(200);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].phone).toBe('+1234567890');
    });

    it('should search by company', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/search?q=${encodeURIComponent('Acme')}`
      );

      expect(status).toBe(200);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].company).toBe('Acme Corp');
    });

    it('should limit search results', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/search?q=John&limit=1`
      );

      expect(status).toBe(200);
      expect(data.results).toHaveLength(1);
    });

    it('should handle empty search query', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/search?q=`
      );

      expect(status).toBe(400);
      expect(data.error).toContain('Search query required');
    });
  });

  describe('GET /api/admin/guests/[id]/journey', () => {
    let testGuest: any;
    let visitIds: string[] = [];

    beforeEach(async () => {
      testGuest = await testDb.getPrisma().guest.create({
        data: TestDataFactory.createGuest(),
      });

      // Create visit history
      const hosts = await Promise.all([
        testDb.getPrisma().user.create({
          data: TestDataFactory.createUser({ name: 'Host One', role: 'host' }),
        }),
        testDb.getPrisma().user.create({
          data: TestDataFactory.createUser({ name: 'Host Two', role: 'host' }),
        }),
      ]);

      for (let i = 0; i < 5; i++) {
        const visit = await testDb.getPrisma().visit.create({
          data: TestDataFactory.createVisit(
            testGuest.id,
            hosts[i % 2].id,
            testLocation.id,
            { 
              checkedInAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000), // Weekly visits
            }
          ),
        });
        visitIds.push(visit.id);
      }
    });

    it('should return complete guest journey', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/guests/${testGuest.id}/journey`
      );

      expect(status).toBe(200);
      expect(data).toHaveProperty('guest');
      expect(data).toHaveProperty('visits');
      expect(data).toHaveProperty('statistics');
      
      expect(data.guest.id).toBe(testGuest.id);
      expect(data.visits).toHaveLength(5);
      expect(data.statistics).toHaveProperty('totalVisits', 5);
      expect(data.statistics).toHaveProperty('firstVisit');
      expect(data.statistics).toHaveProperty('lastVisit');
    });

    it('should include host information in journey', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/guests/${testGuest.id}/journey`
      );

      expect(status).toBe(200);
      
      const visit = data.visits[0];
      expect(visit).toHaveProperty('host');
      expect(visit.host).toHaveProperty('name');
      expect(['Host One', 'Host Two']).toContain(visit.host.name);
    });

    it('should calculate visit patterns', async () => {
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/guests/${testGuest.id}/journey`
      );

      expect(status).toBe(200);
      expect(data.statistics).toHaveProperty('averageVisitDuration');
      expect(data.statistics).toHaveProperty('mostFrequentHost');
      expect(data.statistics).toHaveProperty('visitFrequency');
    });

    it('should handle guest not found', async () => {
      const nonExistentId = faker.string.uuid();
      
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/guests/${nonExistentId}/journey`
      );

      expect(status).toBe(404);
      expect(data.error).toContain('Guest not found');
    });

    it('should support date range filtering', async () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const { status, data } = await httpHelpers.makeGetRequest(
        `${API_BASE}/api/admin/guests/${testGuest.id}/journey?from=${twoWeeksAgo}`
      );

      expect(status).toBe(200);
      expect(data.visits.length).toBeLessThan(5);
    });
  });

  describe('POST /api/invitations/[id]/activate', () => {
    let invitation: any;
    let host: any;
    let guest: any;

    beforeEach(async () => {
      host = await testDb.getPrisma().user.create({
        data: TestDataFactory.createUser({ role: 'host' }),
      });

      guest = await testDb.getPrisma().guest.create({
        data: TestDataFactory.createGuest(),
      });

      invitation = await testDb.getPrisma().invitation.create({
        data: TestDataFactory.createInvitation(
          guest.id,
          host.id,
          testLocation.id,
          { status: 'PENDING' }
        ),
      });
    });

    it('should activate pending invitation', async () => {
      const { status, data } = await httpHelpers.makePostRequest(
        `${API_BASE}/api/invitations/${invitation.id}/activate`,
        {}
      );

      expect(status).toBe(200);
      expect(data).toHaveProperty('qrToken');
      expect(data).toHaveProperty('expiresAt');
      expect(data).toHaveProperty('status', 'ACTIVATED');
    });

    it('should generate unique QR token', async () => {
      const { status, data } = await httpHelpers.makePostRequest(
        `${API_BASE}/api/invitations/${invitation.id}/activate`,
        {}
      );

      expect(status).toBe(200);
      expect(data.qrToken).toBeTruthy();
      expect(data.qrToken.length).toBeGreaterThan(20);
    });

    it('should not reactivate already activated invitation', async () => {
      // First activation
      await httpHelpers.makePostRequest(
        `${API_BASE}/api/invitations/${invitation.id}/activate`,
        {}
      );

      // Try to activate again
      const { status, data } = await httpHelpers.makePostRequest(
        `${API_BASE}/api/invitations/${invitation.id}/activate`,
        {}
      );

      expect(status).toBe(400);
      expect(data.error).toContain('already activated');
    });

    it('should not activate expired invitation', async () => {
      // Update invitation to be expired
      await testDb.getPrisma().invitation.update({
        where: { id: invitation.id },
        data: { 
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          status: 'EXPIRED',
        },
      });

      const { status, data } = await httpHelpers.makePostRequest(
        `${API_BASE}/api/invitations/${invitation.id}/activate`,
        {}
      );

      expect(status).toBe(400);
      expect(data.error).toContain('expired');
    });

    it('should handle invitation not found', async () => {
      const nonExistentId = faker.string.uuid();
      
      const { status, data } = await httpHelpers.makePostRequest(
        `${API_BASE}/api/invitations/${nonExistentId}/activate`,
        {}
      );

      expect(status).toBe(404);
      expect(data.error).toContain('Invitation not found');
    });

    it('should set correct expiration time', async () => {
      const { status, data } = await httpHelpers.makePostRequest(
        `${API_BASE}/api/invitations/${invitation.id}/activate`,
        {}
      );

      expect(status).toBe(200);
      
      const expiresAt = new Date(data.expiresAt);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(diffDays).toBeCloseTo(7, 0); // 7 days expiration
    });
  });
});