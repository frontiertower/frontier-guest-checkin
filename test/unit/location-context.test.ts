/**
 * @jest-environment jsdom
 */

/**
 * Critical Location Context Tests
 * Tests multi-location functionality, data isolation, and security
 * This was a major gap - location filtering was completely untested
 */

import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock toast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { AdminDataProvider, useAdminData } from '@/contexts/AdminDataContext';

// Create wrapper for AdminDataProvider
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <AdminDataProvider>{children}</AdminDataProvider>
  );
};

describe('Location Context System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('AdminDataContext Location State Management', () => {
    it('should initialize with default location state', () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      expect(result.current.selectedLocationId).toBe('all');
      expect(typeof result.current.setSelectedLocationId).toBe('function');
      expect(typeof result.current.getLocationContext).toBe('function');
    });

    it('should update selected location state', () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('location-123');
      });

      expect(result.current.selectedLocationId).toBe('location-123');
    });

    it('should provide location context information', () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      const locationContext = result.current.getLocationContext();

      expect(locationContext).toHaveProperty('isSingleLocation');
      expect(locationContext).toHaveProperty('locationName');
      expect(locationContext).toHaveProperty('locationCount');
      expect(locationContext).toHaveProperty('locationPhrase');
      expect(locationContext).toHaveProperty('locationDescription');
    });
  });

  describe('Location-Filtered API Calls', () => {
    it('should call stats API with location parameter when location is selected', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({
          overview: { totalVisits: 50 },
          locations: [{ id: 'loc-1', name: 'Tower A' }],
          currentLocation: { id: 'loc-1', name: 'Tower A' },
          isLocationFiltered: true
        }), { status: 200 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('loc-1');
      });

      await act(async () => {
        await result.current.loadStats(true); // force refresh
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=loc-1');
    });

    it('should call stats API without location parameter when "all" is selected', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({
          overview: { totalVisits: 100 },
          locations: [
            { id: 'loc-1', name: 'Tower A' },
            { id: 'loc-2', name: 'Tower B' }
          ],
          currentLocation: null,
          isLocationFiltered: false
        }), { status: 200 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      // Default is 'all'
      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats');
    });

    it('should call guests API with location filtering', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({
          guests: [{ id: 'guest-1', email: 'test@example.com' }],
          total: 1
        }), { status: 200 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('loc-1');
      });

      await act(async () => {
        await result.current.loadGuests('test@example.com', false, true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/guests?query=test%40example.com&blacklisted=false&location=loc-1');
    });

    it('should call activities API with location filtering', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({
          activities: [{ id: 'activity-1', type: 'checkin' }]
        }), { status: 200 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('loc-1');
      });

      await act(async () => {
        await result.current.loadActivities(true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/activity?location=loc-1');
    });
  });

  describe('Location Context Edge Cases', () => {
    it('should handle invalid location selection gracefully', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Location not found' }), { status: 404 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('invalid-location');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=invalid-location');
      // Should handle error gracefully without crashing
    });

    it('should preserve location selection across data refreshes', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ overview: { totalVisits: 25 } }), { status: 200 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('loc-test');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      await act(async () => {
        await result.current.refreshAll();
      });

      // Location should be preserved across refreshes
      expect(result.current.selectedLocationId).toBe('loc-test');
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=loc-test');
    });

    it('should handle location switching during ongoing requests', async () => {
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;

      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      const secondPromise = new Promise((resolve) => {
        resolveSecond = resolve;
      });

      mockFetch
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      // Start first request
      act(() => {
        result.current.setSelectedLocationId('loc-1');
      });
      
      const firstRequest = act(async () => {
        await result.current.loadStats(true);
      });

      // Immediately switch location and start second request
      act(() => {
        result.current.setSelectedLocationId('loc-2');
      });

      const secondRequest = act(async () => {
        await result.current.loadStats(true);
      });

      // Resolve both requests
      resolveFirst!(new Response(JSON.stringify({ overview: { totalVisits: 10 } }), { status: 200 }));
      resolveSecond!(new Response(JSON.stringify({ overview: { totalVisits: 20 } }), { status: 200 }));

      await firstRequest;
      await secondRequest;

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=loc-1');
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=loc-2');
      expect(result.current.selectedLocationId).toBe('loc-2');
    });
  });

  describe('Multi-Location Data Isolation', () => {
    it('should verify different data for different locations', async () => {
      const locationAData = { overview: { totalVisits: 100, activeVisits: 5 } };
      const locationBData = { overview: { totalVisits: 50, activeVisits: 2 } };

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      // Test location A
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(locationAData), { status: 200 })
      );

      act(() => {
        result.current.setSelectedLocationId('loc-a');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(result.current.stats?.overview.totalVisits).toBe(100);

      // Test location B
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(locationBData), { status: 200 })
      );

      act(() => {
        result.current.setSelectedLocationId('loc-b');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(result.current.stats?.overview.totalVisits).toBe(50);
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=loc-a');
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=loc-b');
    });

    it('should ensure guests API respects location boundaries', async () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({
          guests: [
            { id: 'guest-1', email: 'location-a-guest@example.com' }
          ]
        }), { status: 200 })
      );

      // Load guests for specific location
      act(() => {
        result.current.setSelectedLocationId('loc-a');
      });

      await act(async () => {
        await result.current.loadGuests('', false, true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/guests?query=&blacklisted=false&location=loc-a');

      // Switch to different location - should make different API call
      mockFetch.mockClear();
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({
          guests: [
            { id: 'guest-2', email: 'location-b-guest@example.com' }
          ]
        }), { status: 200 })
      );

      act(() => {
        result.current.setSelectedLocationId('loc-b');
      });

      await act(async () => {
        await result.current.loadGuests('', false, true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/guests?query=&blacklisted=false&location=loc-b');
    });
  });

  describe('Location Context Caching Behavior', () => {
    it('should cache data separately for different locations', async () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      // Mock data for location A
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ overview: { totalVisits: 100 } }), { status: 200 })
      );

      act(() => {
        result.current.setSelectedLocationId('loc-a');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      // Mock data for location B
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ overview: { totalVisits: 200 } }), { status: 200 })
      );

      act(() => {
        result.current.setSelectedLocationId('loc-b');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      // Switch back to location A - should use cached data (no new fetch)
      mockFetch.mockClear();

      act(() => {
        result.current.setSelectedLocationId('loc-a');
      });

      // Load without forcing refresh - should use cache
      await act(async () => {
        await result.current.loadStats(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.stats?.overview.totalVisits).toBe(100);
    });

    it('should invalidate cache when switching locations with force refresh', async () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ overview: { totalVisits: 150 } }), { status: 200 })
      );

      act(() => {
        result.current.setSelectedLocationId('loc-test');
      });

      // Force refresh should always make API call
      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=loc-test');

      // Force refresh again should make another API call
      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Location Permission and Security', () => {
    it('should handle unauthorized location access gracefully', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized access to location' }), { status: 403 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedLocationId('restricted-location');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=restricted-location');
      // Should handle 403 gracefully without exposing sensitive data
    });

    it('should prevent location parameter injection', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ overview: { totalVisits: 0 } }), { status: 200 })
      );

      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      // Attempt SQL injection-like attack
      act(() => {
        result.current.setSelectedLocationId('loc-1; DROP TABLE visits; --');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      // Should URL encode the malicious input
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/stats?location=loc-1%3B%20DROP%20TABLE%20visits%3B%20--');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should recover from location-related API errors', async () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      // First request fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      act(() => {
        result.current.setSelectedLocationId('loc-error');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to load admin statistics. Please refresh.',
        variant: 'destructive',
      });

      // Second request succeeds
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ overview: { totalVisits: 75 } }), { status: 200 })
      );

      await act(async () => {
        await result.current.loadStats(true);
      });

      expect(result.current.stats?.overview.totalVisits).toBe(75);
    });

    it('should handle partial location data gracefully', async () => {
      const { result } = renderHook(() => useAdminData(), {
        wrapper: createWrapper(),
      });

      // Mock partial response (missing some expected fields)
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({
          overview: { totalVisits: 25 },
          // Missing locations array and currentLocation
        }), { status: 200 })
      );

      act(() => {
        result.current.setSelectedLocationId('loc-partial');
      });

      await act(async () => {
        await result.current.loadStats(true);
      });

      // Should handle partial data without crashing
      expect(result.current.stats?.overview.totalVisits).toBe(25);
      expect(result.current.isLoadingStats).toBe(false);
    });
  });
});