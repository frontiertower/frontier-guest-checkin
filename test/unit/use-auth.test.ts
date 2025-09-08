/**
 * @jest-environment jsdom
 */

/**
 * Unit tests for useAuth React hook
 * Tests authentication state management, API integration, and lifecycle
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/use-auth';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.location - only if not already defined
if (!window.location) {
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
} else {
  window.location.href = '';
}

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.location.href = '';
  });

  describe('hook structure and interface', () => {
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
      
      // Initial state before auth check completes
      expect(result.current.user).toBe(null);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);

      // Wait for auth check to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should call fetch for authentication check on mount', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 401 }));
      
      renderHook(() => useAuth());
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/invitations', {
          credentials: 'include',
        });
      });
    });
  });

  describe('authentication logic simulation', () => {
    it('should handle successful authentication response', async () => {
      mockFetch.mockResolvedValue(new Response('[]', { status: 200 }));
      
      const { result } = renderHook(() => useAuth());
      
      // Wait for auth check to complete and user to be set
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
      
      // Wait for initial auth check
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Call logout
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
        .mockResolvedValueOnce(new Response('[]', { status: 200 })) // Initial auth check
        .mockRejectedValueOnce(new Error('Logout failed')); // Logout error
        
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const { result } = renderHook(() => useAuth());
      
      // Wait for initial auth check
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Call logout
      await act(async () => {
        await result.current.logout();
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Logout failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});