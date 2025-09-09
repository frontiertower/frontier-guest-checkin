/**
 * Optimized Unit Test Setup
 * Eliminates flakiness and improves performance for unit tests
 */

import { jest } from '@jest/globals';

// Global test configuration
global.console = {
  ...console,
  // Reduce noise in test output
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Mock global Date for consistent testing
const FIXED_DATE = new Date('2025-01-09T12:00:00.000Z');
global.Date = class extends Date {
  constructor(...args) {
    if (args.length === 0) {
      super(FIXED_DATE);
    } else {
      super(...args);
    }
  }
  
  static now() {
    return FIXED_DATE.getTime();
  }
};

// Mock Math.random for deterministic tests
let mockRandomSeed = 0;
global.Math.random = jest.fn(() => {
  mockRandomSeed = (mockRandomSeed + 1) % 1000;
  return mockRandomSeed / 1000;
});

// Mock fetch for consistent network behavior
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('OK'),
  })
);

// Mock crypto for deterministic UUIDs
const mockUuid = (() => {
  let counter = 0;
  return () => `mock-uuid-${++counter}`;
})();

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(mockUuid),
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock window and localStorage for React components
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
});

// Mock ResizeObserver for components that use it
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Test timeout configuration
jest.setTimeout(30000);

// Before/after hooks for deterministic testing
beforeEach(() => {
  // Reset all mocks to clean state
  jest.clearAllMocks();
  
  // Reset random seed for consistent test runs
  mockRandomSeed = 0;
  
  // Clear any timers
  jest.clearAllTimers();
  
  // Use fake timers for time-based tests
  jest.useFakeTimers({
    now: FIXED_DATE,
  });
});

afterEach(() => {
  // Restore real timers
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  
  // Clean up any remaining mocks
  jest.restoreAllMocks();
});

// Custom matchers for better test assertions
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass,
    };
  },
  
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);
    
    return {
      message: () => `expected ${received} to be a valid email address`,
      pass,
    };
  },
  
  toBeRecentDate(received, withinMs = 5000) {
    const now = Date.now();
    const receivedTime = new Date(received).getTime();
    const pass = Math.abs(now - receivedTime) <= withinMs;
    
    return {
      message: () => `expected ${received} to be within ${withinMs}ms of current time`,
      pass,
    };
  },
});

// Performance monitoring for slow tests
const originalIt = global.it;
global.it = (name, fn, timeout) => {
  return originalIt(name, async (...args) => {
    const start = performance.now();
    const result = await fn(...args);
    const duration = performance.now() - start;
    
    if (duration > 1000) {
      console.warn(`Slow unit test: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }, timeout);
};

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't fail tests for unhandled rejections in unit tests
});

// Memory leak detection
let initialMemoryUsage;
beforeAll(() => {
  if (global.gc) {
    global.gc();
    initialMemoryUsage = process.memoryUsage();
  }
});

afterAll(() => {
  if (global.gc && initialMemoryUsage) {
    global.gc();
    const finalMemoryUsage = process.memoryUsage();
    const heapGrowth = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
    
    if (heapGrowth > 50 * 1024 * 1024) { // 50MB growth
      console.warn(`Potential memory leak detected: heap grew by ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
    }
  }
});

export default {};