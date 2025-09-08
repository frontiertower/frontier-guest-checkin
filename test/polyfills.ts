/**
 * Polyfills for Node.js test environment
 */

import { webcrypto } from 'node:crypto';

// Add crypto polyfill for JWT operations
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto as Crypto;
}

// Add TextEncoder/TextDecoder if missing
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Mock fetch for tests that need it
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = jest.fn();
}

// Add Response polyfill for browser API testing
if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = class MockResponse {
    constructor(public body: any, public init: ResponseInit = {}) {}
    get status() { return this.init.status || 200; }
    get ok() { return this.status >= 200 && this.status < 300; }
    async json() { return JSON.parse(this.body || '{}'); }
    async text() { return this.body || ''; }
  } as any;
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.OVERRIDE_PASSWORD = 'test-override-password-123';