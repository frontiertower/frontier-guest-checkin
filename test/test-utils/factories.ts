// Use simple mock data instead of faker for compatibility
import { UserRole, ContactMethod, InvitationStatus, PrismaClient } from '@prisma/client';

/**
 * Enhanced Test Data Factory with Builder Pattern
 * Consolidated from original TestDataFactory with additional capabilities
 */
export class TestDataFactory {
  private static idCounter = 0;
  private static defaultLocationId: string | null = null;
  private static prisma: PrismaClient | null = null;

  static setPrisma(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  static resetCounters() {
    this.idCounter = 0;
    this.defaultLocationId = null;
  }

  static generateId(): string {
    // Generate a proper UUID v4 for database compatibility
    return crypto.randomUUID();
  }

  // Core entity builders
  static createUser(overrides: Partial<any> = {}) {
    const id = this.generateId();
    const uniqueId = ++this.idCounter; // Increment counter for unique emails
    return {
      id,
      email: `user-${uniqueId}-${Date.now()}@example.com`.toLowerCase(),
      name: `Test User ${uniqueId}`,
      role: 'host' as UserRole,
      // Remove createdAt - schema uses @default(now())
      ...overrides,
    };
  }

  static createGuest(overrides: Partial<any> = {}) {
    const id = this.generateId();
    const uniqueId = ++this.idCounter; // Increment counter for unique emails
    return {
      id,
      email: `guest-${uniqueId}-${Date.now()}@example.com`.toLowerCase(),
      name: `Test Guest ${uniqueId}`,
      phone: `+1-555-${uniqueId.toString().padStart(4, '0')}`,
      country: 'US',
      contactMethod: 'EMAIL' as ContactMethod,
      termsAcceptedAt: new Date(),
      blacklistedAt: null,
      // Remove createdAt and updatedAt - schema uses @default(now())
      ...overrides,
    };
  }

  static createBlacklistedGuest(overrides: Partial<any> = {}) {
    return this.createGuest({
      blacklistedAt: new Date(),
      ...overrides,
    });
  }

  static createGuestWithoutTerms(overrides: Partial<any> = {}) {
    return this.createGuest({
      termsAcceptedAt: null,
      ...overrides,
    });
  }

  static createMinimalGuest(overrides: Partial<any> = {}) {
    const id = this.generateId();
    const uniqueId = ++this.idCounter;
    // For Prisma, omit nullable fields rather than setting to null
    // Only include required fields and non-null defaults
    return {
      id,
      email: `minimal-${uniqueId}-${Date.now()}@example.com`.toLowerCase(),
      profileCompleted: false,
      // Don't include nullable fields - let Prisma handle them
      ...overrides,
    };
  }

  static createLocation(overrides: Partial<any> = {}) {
    const id = this.generateId();
    return {
      id,
      name: `Test Tower ${this.idCounter}`,
      address: `${this.idCounter} Test Street, Test City, CA 90210`,
      timezone: 'America/Los_Angeles',
      isActive: true,
      settings: {
        checkInCutoffHour: 23,
        maxDailyVisits: 500,
        requiresEscort: false,
      },
      // Remove createdAt and updatedAt - schema uses @default(now())
      ...overrides,
    };
  }

  static createPolicy(overrides: Partial<any> = {}) {
    return {
      // Don't include ID - let database handle it with @default(1)
      // locationId field doesn't exist in current Policy schema
      guestMonthlyLimit: 3,
      hostConcurrentLimit: 3,
      ...overrides,
    };
  }

  static createVisit(guestId: string, hostId: string, locationId?: string, overrides: Partial<any> = {}) {
    const checkedInAt = new Date();
    const expiresAt = new Date(checkedInAt.getTime() + 12 * 60 * 60 * 1000); // 12 hours later
    const id = this.generateId();

    return {
      id,
      guestId,
      hostId,
      locationId: locationId || this.defaultLocationId,
      checkedInAt,
      expiresAt,
      checkedOutAt: null,
      overrideReason: null,
      overrideBy: null, // Fixed: was overrideUserId
      // Remove createdAt - schema uses @default(now())
      ...overrides,
    };
  }

  static createInvitation(guestId: string, hostId: string, locationId: string, overrides: Partial<any> = {}) {
    const id = this.generateId();
    const inviteDate = new Date();

    return {
      id,
      guestId,
      hostId,
      locationId,
      status: 'PENDING' as InvitationStatus,
      inviteDate,
      qrToken: Math.random().toString(36).substr(2, 32),
      qrIssuedAt: new Date(),
      qrExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours later
      // Remove createdAt and updatedAt - schema uses @default(now()) and @updatedAt
      ...overrides,
    };
  }

  static createAcceptance(guestId: string, overrides: Partial<any> = {}) {
    const id = this.generateId();
    return {
      id,
      guestId,
      visitId: null, // Optional
      invitationId: null, // Optional
      termsVersion: '1.0',
      visitorAgreementVersion: '1.0', // Required field
      // Remove acceptedAt - schema uses @default(now())
      expiresAt: null, // Optional
      // Remove ipAddress and userAgent - not in schema
      ...overrides,
    };
  }

  // Utility methods for common test scenarios
  static async getDefaultLocationId(): Promise<string> {
    if (this.defaultLocationId) {
      return this.defaultLocationId;
    }

    if (!this.prisma) {
      throw new Error('Prisma client not set. Call TestDataFactory.setPrisma() first');
    }

    let location = await this.prisma.location.findFirst({ where: { isActive: true } });
    
    if (!location) {
      location = await this.prisma.location.create({
        data: this.createLocation(),
      });
    }

    this.defaultLocationId = location.id;
    return this.defaultLocationId;
  }

  /**
   * Create a batch of guests for multi-guest testing scenarios
   */
  static createGuestBatch(count: number, overrides: Partial<any> = {}): any[] {
    return Array.from({ length: count }, (_, i) => 
      this.createGuest({
        email: `batch.guest.${i + 1}.${Date.now()}@example.com`,
        name: `Batch Guest ${i + 1}`,
        ...overrides,
      })
    );
  }

  /**
   * Create edge case scenarios for validation testing
   */
  static createEdgeCaseScenarios() {
    return {
      expiredAcceptance: this.createGuest({
        termsAcceptedAt: new Date('2020-01-01'), // Very old acceptance
      }),
      blacklistedGuest: this.createBlacklistedGuest(),
      noTermsGuest: this.createGuestWithoutTerms(),
      internationalGuest: this.createGuest({
        country: 'GB',
        phone: '+44 20 7946 0958',
      }),
      vipGuest: this.createGuest({
        email: 'vip.guest@example.com',
        name: 'VIP Important Guest',
      }),
    };
  }
}