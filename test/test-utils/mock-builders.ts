/**
 * Simplified Mock Utilities
 * Essential mocks for testing core business logic
 */

// Use global jest object (available in Jest test environment)
declare const jest: any;

// Core entity factories
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'host' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockGuest = (overrides = {}) => ({
  id: 'guest-123',
  email: 'guest@example.com',
  name: 'Guest User',
  blacklisted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockVisit = (overrides = {}) => ({
  id: 'visit-123',
  guestId: 'guest-123',
  hostId: 'host-123',
  locationId: 'loc-123',
  checkedInAt: new Date(),
  expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
  checkedOutAt: null,
  overridden: false,
  overrideReason: null,
  overrideByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockLocation = (overrides = {}) => ({
  id: 'loc-123',
  name: 'Test Location',
  active: true,
  dailyCapacity: 100,
  cutoffHour: 23,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPolicy = (overrides = {}) => ({
  id: 1,
  guestMonthlyLimit: 3,
  hostConcurrentLimit: 3,
  ...overrides,
});

/**
 * Simplified Prisma Mock Builder
 * Focus on essential mocking patterns used across tests
 */
export class PrismaMockBuilder {
  private mocks = new Map<string, jest.Mock>();

  constructor() {
    // Only create mocks for actually used methods
    const methods = [
      'user.findUnique', 'user.findFirst', 'user.create',
      'guest.findUnique', 'guest.findFirst', 'guest.create',
      'visit.findMany', 'visit.count', 'visit.create',
      'policy.findFirst', 'location.findUnique',
      'acceptance.findFirst', '$transaction'
    ];
    
    methods.forEach(method => {
      this.mocks.set(method, jest.fn());
    });
  }

  build() {
    return {
      user: {
        findUnique: this.mocks.get('user.findUnique'),
        findFirst: this.mocks.get('user.findFirst'),
        create: this.mocks.get('user.create'),
      },
      guest: {
        findUnique: this.mocks.get('guest.findUnique'),
        findFirst: this.mocks.get('guest.findFirst'),
        create: this.mocks.get('guest.create'),
      },
      visit: {
        findMany: this.mocks.get('visit.findMany'),
        count: this.mocks.get('visit.count'),
        create: this.mocks.get('visit.create'),
      },
      policy: {
        findFirst: this.mocks.get('policy.findFirst'),
      },
      location: {
        findUnique: this.mocks.get('location.findUnique'),
      },
      acceptance: {
        findFirst: this.mocks.get('acceptance.findFirst'),
      },
      $transaction: this.mocks.get('$transaction'),
    };
  }

  reset(): this {
    this.mocks.forEach(mock => mock.mockReset());
    return this;
  }

  // Fluent interface for common scenarios
  withUser(user = createMockUser()): this {
    this.mocks.get('user.findUnique')!.mockResolvedValue(user);
    this.mocks.get('user.findFirst')!.mockResolvedValue(user);
    return this;
  }

  withGuest(guest = createMockGuest()): this {
    this.mocks.get('guest.findUnique')!.mockResolvedValue(guest);
    this.mocks.get('guest.findFirst')!.mockResolvedValue(guest);
    return this;
  }

  withPolicy(policy = createMockPolicy()): this {
    this.mocks.get('policy.findFirst')!.mockResolvedValue(policy);
    return this;
  }

  withLocation(location = createMockLocation()): this {
    this.mocks.get('location.findUnique')!.mockResolvedValue(location);
    return this;
  }

  withVisitCount(count: number): this {
    this.mocks.get('visit.count')!.mockResolvedValue(count);
    return this;
  }

  withVisits(visits: any[]): this {
    this.mocks.get('visit.findMany')!.mockResolvedValue(visits);
    return this;
  }

  withAcceptance(acceptance: any): this {
    this.mocks.get('acceptance.findFirst')!.mockResolvedValue(acceptance);
    return this;
  }
}

/**
 * API Request Mock Factory
 * Simplified request mocking for API route testing
 */
export const createMockRequest = (options: {
  method?: string;
  url?: string;
  json?: any;
  headers?: Record<string, string>;
  authToken?: string;
} = {}) => {
  const {
    method = 'GET',
    url = 'http://localhost:3001/api/test',
    json,
    headers = {},
    authToken,
  } = options;

  const mockHeaders = new Map(Object.entries(headers));
  if (authToken) {
    mockHeaders.set('authorization', `Bearer ${authToken}`);
  }

  const mockRequest = {
    json: jest.fn(),
    text: jest.fn(),
    url,
    method,
    headers: mockHeaders,
    nextUrl: {
      pathname: new URL(url).pathname,
      searchParams: new URL(url).searchParams,
    },
  };

  if (json) {
    mockRequest.json.mockResolvedValue(json);
  }

  return mockRequest;
};

/**
 * Validation Result Factory
 * Simplified validation result creation
 */
export const validationResult = {
  success: (data?: any) => ({ isValid: true, error: undefined, ...data }),
  failure: (error: string, data?: any) => ({ isValid: false, error, ...data }),
  
  // Common failure patterns
  hostCapacity: (current: number, max: number, location = 'Test Location') =>
    validationResult.failure(
      `Host at capacity with ${current} guests. Maximum ${max} concurrent guests allowed at ${location}.`,
      { currentCount: current, maxCount: max }
    ),
  
  guestLimit: (count: number, limit: number) =>
    validationResult.failure(
      `Guest has reached ${count} visits this month. Limit: ${limit} visits per 30 days.`,
      { currentCount: count, maxCount: limit }
    ),
  
  blacklisted: () => 
    validationResult.failure('Guest is not authorized for building access. Contact security for assistance.'),
  
  termsRequired: () =>
    validationResult.failure('Guest needs to accept visitor terms before check-in. Email will be sent.'),
  
  qrExpired: () =>
    validationResult.failure('This QR code has expired. Please generate a new invitation.'),
};

/**
 * API Response Factory
 * Simplified API response creation
 */
export const apiResponse = {
  success: (data?: any, message = 'Operation successful') => ({
    success: true,
    message,
    ...data,
  }),
  
  error: (message: string, details?: any) => ({
    success: false,
    message,
    error: message,
    ...details,
  }),
  
  checkinSuccess: (results: any[]) => apiResponse.success({
    results,
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
  }),
  
  invitation: (invitation: any) => apiResponse.success({
    invitation,
    qrCode: `data:image/png;base64,mock-qr-code-${invitation.id}`,
  }),
};

// Convenience exports
export const mockPrisma = () => new PrismaMockBuilder();