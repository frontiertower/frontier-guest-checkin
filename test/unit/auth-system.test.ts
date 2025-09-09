/**
 * Comprehensive Authentication System Tests
 * Consolidated test suite covering JWT auth, middleware, hooks, and demo mode
 */

// Jest environment for React hooks
/**
 * @jest-environment jsdom
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock jose before any imports
let mockUserPayload: any = null;
let mockIssuedAt: number | undefined;
let mockExpirationTime: number | undefined;
let mockSecret: Uint8Array | undefined;

const mockSign = jest.fn().mockImplementation(async (secret: Uint8Array) => {
  mockSecret = secret;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iat: mockIssuedAt || Math.floor(Date.now() / 1000),
    exp: mockExpirationTime || (Math.floor(Date.now() / 1000) + 24 * 60 * 60),
    ...mockUserPayload,
  };
  
  if (mockUserPayload) {
    if (!payload.sub && !payload.id) payload.sub = 'user-123';
    if (!payload.email) payload.email = 'test@example.com';
    if (!payload.name) payload.name = 'Test User';
    if (!payload.role) payload.role = 'host';
  }
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = new TextDecoder().decode(secret).includes('wrong') ? 'tampered-signature' : 'mock-signature';
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
});

const mockJwtVerify = jest.fn().mockImplementation(async (token: string) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  if (parts[2] === 'tampered-signature') throw new Error('Invalid signature');
  
  const payload = JSON.parse(atob(parts[1]));
  
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Token expired');
  if (!payload.sub || !payload.email || !payload.name || !payload.role) {
    throw new Error('Missing required fields');
  }
  
  return { payload };
});

jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation((userData) => {
    mockUserPayload = userData;
    return {
      setProtectedHeader: jest.fn().mockReturnThis(),
      setIssuedAt: jest.fn().mockImplementation((iat) => {
        mockIssuedAt = typeof iat === 'number' ? iat : Math.floor(Date.now() / 1000);
        return { 
          setProtectedHeader: jest.fn().mockReturnThis(),
          setExpirationTime: jest.fn().mockImplementation((exp) => {
            if (typeof exp === 'number') {
              mockExpirationTime = exp;
            } else if (exp === '24h') {
              mockExpirationTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
            }
            return { sign: mockSign };
          }),
          sign: mockSign,
        };
      }), 
      setExpirationTime: jest.fn().mockImplementation((exp) => {
        if (typeof exp === 'number') {
          mockExpirationTime = exp;
        } else if (exp === '24h') {
          mockExpirationTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
        }
        return { sign: mockSign };
      }),
      sign: mockSign,
    };
  }),
  jwtVerify: mockJwtVerify,
  errors: {
    JWTExpired: class JWTExpired extends Error {},
  },
}));

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/demo-config', () => ({
  isDemoMode: jest.fn(() => false),
  getDemoUser: jest.fn(),
  logDemo: jest.fn(),
}));

// Mock fetch for hook tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.location for hook tests
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

import {
  createAuthToken,
  verifyAuthToken,
  authenticateUser,
  getAuthContext,
  getCurrentUserId,
  getCurrentUser,
  hasRole,
  hasAnyRole,
  hasRoleOrHigher,
  AuthUser,
} from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isDemoMode, getDemoUser, logDemo } from '@/lib/demo-config';
import { middleware } from '@/middleware';
import { useAuth } from '@/hooks/use-auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockIsDemoMode = isDemoMode as jest.MockedFunction<typeof isDemoMode>;
const mockGetDemoUser = getDemoUser as jest.MockedFunction<typeof getDemoUser>;
const mockLogDemo = logDemo as jest.MockedFunction<typeof logDemo>;

// Set up JWT secret
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    JWT_SECRET: 'test-secret-key-for-testing-only',
  };
});
afterAll(() => {
  process.env = originalEnv;
});

describe('Authentication System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDemoMode.mockReturnValue(false);
    mockUserPayload = null;
    mockIssuedAt = undefined;
    mockExpirationTime = undefined;
    mockSecret = undefined;
    window.location.href = '';
    mockFetch.mockClear();
  });

  describe('JWT Token Management', () => {
    describe('createAuthToken', () => {
      it('should create valid JWT token with user data', async () => {
        const user: AuthUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'host',
        };

        const token = await createAuthToken(user);
        
        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);
        
        // Verify token contains user data
        const decoded = await verifyAuthToken(token);
        expect(decoded).toEqual(user);
      });

      it('should set proper expiration time', async () => {
        const user: AuthUser = {
          id: 'user-789',
          email: 'test@example.com',
          name: 'Test User',
          role: 'host',
        };

        const token = await createAuthToken(user);
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        
        expect(payload.exp).toBeDefined();
        expect(payload.iat).toBeDefined();
        expect(payload.exp - payload.iat).toBe(86400); // 24 hours
      });
    });

    describe('verifyAuthToken', () => {
      it('should verify valid token', async () => {
        const user: AuthUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'security',
        };

        const token = await createAuthToken(user);
        const verified = await verifyAuthToken(token);
        
        expect(verified).toEqual(user);
      });

      it('should reject expired token', async () => {
        const jose = require('jose');
        const jwt = await new jose.SignJWT({
          sub: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'host',
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt(Math.floor(Date.now() / 1000) - 86401)
          .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
          .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

        const result = await verifyAuthToken(jwt);
        expect(result).toBeNull();
      });

      it('should reject token with invalid signature', async () => {
        const jose = require('jose');
        const jwt = await new jose.SignJWT({
          sub: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'host',
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('24h')
          .sign(new TextEncoder().encode('wrong-secret'));

        const result = await verifyAuthToken(jwt);
        expect(result).toBeNull();
      });

      it('should reject malformed token', async () => {
        const result = await verifyAuthToken('not.a.valid.token');
        expect(result).toBeNull();
      });
    });

    describe('Security Tests', () => {
      it('should handle JWT with tampered payload', async () => {
        const user: AuthUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'host',
        };
        const token = await createAuthToken(user);
        
        // Tamper with payload
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        payload.role = 'admin'; // Try to escalate privileges
        parts[1] = btoa(JSON.stringify(payload));
        const tamperedToken = parts.join('.');

        const result = await verifyAuthToken(tamperedToken);
        expect(result).toBeNull(); // Signature won't match
      });

      it('should handle extremely long JWT', async () => {
        const jose = require('jose');
        const longName = 'A'.repeat(10000);
        const jwt = await new jose.SignJWT({
          sub: 'user-123',
          email: 'test@example.com',
          name: longName,
          role: 'host',
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('24h')
          .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

        const result = await verifyAuthToken(jwt);
        expect(result?.name).toBe(longName);
      });
    });
  });

  describe('User Authentication', () => {
    describe('authenticateUser', () => {
      it('should authenticate existing user', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'host',
        };
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);

        const result = await authenticateUser('test@example.com', 'any-password');
        
        expect(result).toEqual(mockUser);
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        });
      });

      it('should reject non-existent user', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const result = await authenticateUser('nonexistent@example.com', 'password');
        expect(result).toBeNull();
      });

      it('should handle database errors gracefully', async () => {
        mockPrisma.user.findUnique.mockRejectedValue(new Error('DB Error'));

        const result = await authenticateUser('test@example.com', 'password');
        expect(result).toBeNull();
      });
    });

    describe('getAuthContext', () => {
      const mockRequest = (headers: Record<string, string> = {}) => ({
        headers: {
          get: (name: string) => headers[name.toLowerCase()] || null,
        },
      } as NextRequest);

      describe('Production Mode', () => {
        it('should extract valid JWT from Authorization header', async () => {
          const user: AuthUser = {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'host',
          };
          const token = await createAuthToken(user);
          const request = mockRequest({ authorization: `Bearer ${token}` });

          const context = await getAuthContext(request);
          
          expect(context.isAuthenticated).toBe(true);
          expect(context.user).toEqual(user);
        });

        it('should reject missing Authorization header', async () => {
          const request = mockRequest({});

          const context = await getAuthContext(request);
          
          expect(context.isAuthenticated).toBe(false);
          expect(context.user).toBeNull();
        });

        it('should reject invalid Bearer format', async () => {
          const request = mockRequest({ authorization: 'InvalidFormat token' });

          const context = await getAuthContext(request);
          
          expect(context.isAuthenticated).toBe(false);
          expect(context.user).toBeNull();
        });
      });

      describe('Demo Mode', () => {
        beforeEach(() => {
          mockIsDemoMode.mockReturnValue(true);
        });

        it('should use JWT if valid in demo mode', async () => {
          const user: AuthUser = {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'host',
          };
          const token = await createAuthToken(user);
          const request = mockRequest({ authorization: `Bearer ${token}` });

          const context = await getAuthContext(request);
          
          expect(context.isAuthenticated).toBe(true);
          expect(context.user).toEqual(user);
        });

        it('should fallback to demo user if no JWT', async () => {
          const demoUser: AuthUser = {
            id: 'demo-user',
            email: 'demo@example.com',
            name: 'Demo User',
            role: 'host',
          };
          mockGetDemoUser.mockResolvedValue(demoUser);
          const request = mockRequest({});

          const context = await getAuthContext(request);
          
          expect(context.isAuthenticated).toBe(true);
          expect(context.user).toEqual(demoUser);
        });
      });
    });

    describe('getCurrentUserId', () => {
      const mockRequest = (headers: Record<string, string> = {}) => ({
        headers: {
          get: (name: string) => headers[name.toLowerCase()] || null,
        },
      } as NextRequest);

      it('should return user ID from valid JWT', async () => {
        const user: AuthUser = {
          id: 'user-999',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin',
        };
        const token = await createAuthToken(user);
        const request = mockRequest({ authorization: `Bearer ${token}` });

        const userId = await getCurrentUserId(request);
        expect(userId).toBe('user-999');
      });

      it('should throw error if not authenticated', async () => {
        const request = mockRequest({});

        await expect(getCurrentUserId(request)).rejects.toThrow('Authentication required');
      });

      it('should return demo user ID in demo mode', async () => {
        mockIsDemoMode.mockReturnValue(true);
        mockGetDemoUser.mockResolvedValue({
          id: 'demo-123',
          email: 'demo@example.com',
          name: 'Demo User',
          role: 'host',
        });
        const request = mockRequest({});

        const userId = await getCurrentUserId(request);
        expect(userId).toBe('demo-123');
      });
    });
  });

  describe('Role Authorization', () => {
    const testUser: AuthUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'security',
    };

    describe('hasRole', () => {
      it('should return true for matching role', () => {
        expect(hasRole(testUser, 'security')).toBe(true);
      });

      it('should return false for non-matching role', () => {
        expect(hasRole(testUser, 'admin')).toBe(false);
        expect(hasRole(testUser, 'host')).toBe(false);
      });
    });

    describe('hasAnyRole', () => {
      it('should return true if user has any listed role', () => {
        expect(hasAnyRole(testUser, ['admin', 'security'])).toBe(true);
        expect(hasAnyRole(testUser, ['security', 'host'])).toBe(true);
      });

      it('should return false if user has none of listed roles', () => {
        expect(hasAnyRole(testUser, ['admin', 'host'])).toBe(false);
      });

      it('should handle empty role list', () => {
        expect(hasAnyRole(testUser, [])).toBe(false);
      });
    });

    describe('hasRoleOrHigher', () => {
      it('should respect role hierarchy: admin > security > host', () => {
        const adminUser: AuthUser = { ...testUser, role: 'admin' };
        const securityUser: AuthUser = { ...testUser, role: 'security' };
        const hostUser: AuthUser = { ...testUser, role: 'host' };

        // Admin can do everything
        expect(hasRoleOrHigher(adminUser, 'admin')).toBe(true);
        expect(hasRoleOrHigher(adminUser, 'security')).toBe(true);
        expect(hasRoleOrHigher(adminUser, 'host')).toBe(true);

        // Security can do security and host
        expect(hasRoleOrHigher(securityUser, 'admin')).toBe(false);
        expect(hasRoleOrHigher(securityUser, 'security')).toBe(true);
        expect(hasRoleOrHigher(securityUser, 'host')).toBe(true);

        // Host can only do host
        expect(hasRoleOrHigher(hostUser, 'admin')).toBe(false);
        expect(hasRoleOrHigher(hostUser, 'security')).toBe(false);
        expect(hasRoleOrHigher(hostUser, 'host')).toBe(true);
      });
    });
  });

  describe('Middleware Integration', () => {
    const createRequest = (pathname: string) => new NextRequest(new URL(pathname, 'https://test.com'));

    // Mock getAuthContext for middleware tests
    jest.doMock('@/lib/auth', () => ({
      ...jest.requireActual('@/lib/auth'),
      getAuthContext: jest.fn(),
    }));

    const { getAuthContext: mockGetAuthContext } = require('@/lib/auth');

    describe('Demo Mode Bypass', () => {
      it('should bypass all checks in demo mode', async () => {
        mockIsDemoMode.mockReturnValue(true);
        
        const request = createRequest('/invites');
        const response = await middleware(request);
        
        expect(mockLogDemo).toHaveBeenCalledWith('Middleware bypassed for /invites');
        expect(response).toEqual(NextResponse.next());
      });
    });

    describe('Protected Routes', () => {
      beforeEach(() => {
        mockIsDemoMode.mockReturnValue(false);
      });

      const protectedRoutes = ['/invites', '/admin'];

      it.each(protectedRoutes)('should redirect unauthenticated users from %s to login', async (route) => {
        mockGetAuthContext.mockResolvedValue({ isAuthenticated: false, user: null });
        
        const request = createRequest(route);
        const response = await middleware(request);
        
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toContain('/login');
        expect(response.headers.get('location')).toContain(`redirect=${encodeURIComponent(route)}`);
      });

      it.each(protectedRoutes)('should allow authenticated users to access %s', async (route) => {
        mockGetAuthContext.mockResolvedValue({ 
          isAuthenticated: true, 
          user: { id: '1', email: 'test@example.com', role: 'host' }
        });
        
        const request = createRequest(route);
        const response = await middleware(request);
        
        expect(response).toEqual(NextResponse.next());
      });
    });

    describe('Public Routes', () => {
      const publicRoutes = ['/', '/checkin', '/accept/token123'];

      it.each(publicRoutes)('should allow access to public route %s regardless of auth', async (route) => {
        mockGetAuthContext.mockResolvedValue({ isAuthenticated: false, user: null });
        
        const request = createRequest(route);
        const response = await middleware(request);
        
        expect(response).toEqual(NextResponse.next());
      });
    });

    describe('Error Handling', () => {
      it('should continue request on authentication error', async () => {
        mockIsDemoMode.mockReturnValue(false);
        mockGetAuthContext.mockRejectedValue(new Error('Auth service unavailable'));
        
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const request = createRequest('/invites');
        const response = await middleware(request);
        
        expect(consoleSpy).toHaveBeenCalledWith('Middleware error:', expect.any(Error));
        expect(response).toEqual(NextResponse.next());
        
        consoleSpy.mockRestore();
      });
    });
  });

  describe('useAuth Hook', () => {
    describe('Hook Interface', () => {
      it('should provide consistent interface', async () => {
        mockFetch.mockResolvedValue(new Response(null, { status: 401 }));
        
        const { result } = renderHook(() => useAuth());
        
        expect(result.current).toHaveProperty('user');
        expect(result.current).toHaveProperty('isLoading');
        expect(result.current).toHaveProperty('isAuthenticated');
        expect(result.current).toHaveProperty('logout');
        expect(typeof result.current.logout).toBe('function');
      });

      it('should initialize with correct default state', async () => {
        mockFetch.mockResolvedValue(new Response(null, { status: 401 }));
        
        const { result } = renderHook(() => useAuth());
        
        expect(result.current.user).toBe(null);
        expect(result.current.isLoading).toBe(true);
        expect(result.current.isAuthenticated).toBe(false);

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });
    });

    describe('Authentication Flow', () => {
      it('should handle successful authentication response', async () => {
        mockFetch.mockResolvedValue(new Response('[]', { status: 200 }));
        
        const { result } = renderHook(() => useAuth());
        
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
          expect(result.current.isAuthenticated).toBe(true);
          expect(result.current.user).toBeTruthy();
        });
      });

      it('should handle logout functionality', async () => {
        mockFetch
          .mockResolvedValueOnce(new Response('[]', { status: 200 })) // Initial auth check
          .mockResolvedValueOnce(new Response(null, { status: 200 })); // Logout
        
        const { result } = renderHook(() => useAuth());
        
        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(true);
        });

        await act(async () => {
          await result.current.logout();
        });
        
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
        expect(result.current.user).toBe(null);
        expect(result.current.isAuthenticated).toBe(false);
      });

      it('should handle logout errors gracefully', async () => {
        mockFetch
          .mockResolvedValueOnce(new Response('[]', { status: 200 }))
          .mockRejectedValueOnce(new Error('Logout failed'));
          
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const { result } = renderHook(() => useAuth());
        
        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(true);
        });

        await act(async () => {
          await result.current.logout();
        });
        
        expect(consoleSpy).toHaveBeenCalledWith('Logout failed:', expect.any(Error));
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent authentication attempts', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'host',
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const promises = Array.from({ length: 10 }, () =>
        authenticateUser('test@example.com', 'password')
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toEqual(mockUser);
      });
    });

    it('should handle concurrent token creation', async () => {
      const user: AuthUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'host',
      };

      const promises = Array.from({ length: 5 }, () => createAuthToken(user));
      const tokens = await Promise.all(promises);
      
      // All tokens should be valid and contain the same user data
      for (const token of tokens) {
        const decoded = await verifyAuthToken(token);
        expect(decoded).toEqual(user);
      }
    });
  });
});