/**
 * Setup for integration tests run as standalone scripts
 */

import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'util';

// Add crypto polyfill for JWT operations
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto as Crypto;
}

// Add TextEncoder/TextDecoder if missing
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder as any;
}

// Set test environment variables if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
}
if (!process.env.OVERRIDE_PASSWORD) {
  process.env.OVERRIDE_PASSWORD = 'test-override-password-123';
}

export {};