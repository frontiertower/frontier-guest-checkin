'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type {
  AdminStats,
  Activity,
  Guest,
  GuestJourney,
  ExecutiveReport,
  Policies,
  SearchResult
} from '@/types/admin';

interface LocationContext {
  isSingleLocation: boolean;
  locationName: string | null;
  locationCount: number;
  locationPhrase: string;
  locationDescription: string;
}

interface AdminDataContextType {
  // Data
  stats: AdminStats | null;
  activities: Activity[];
  guests: Guest[];
  policies: Policies | null;
  executiveReport: ExecutiveReport | null;
  searchResults: SearchResult[];
  selectedGuest: GuestJourney | null;
  
  // Location state
  selectedLocationId: string;
  setSelectedLocationId: (locationId: string) => void;
  getLocationContext: () => LocationContext;
  
  // Loading states
  isLoadingStats: boolean;
  isLoadingActivities: boolean;
  isLoadingGuests: boolean;
  isLoadingPolicies: boolean;
  isLoadingReport: boolean;
  isSearching: boolean;
  isLoadingJourney: boolean;
  
  // Cache timestamps
  lastFetch: {
    stats: number | null;
    activities: number | null;
    guests: number | null;
    policies: number | null;
    report: number | null;
  };
  
  // Actions
  loadStats: (force?: boolean) => Promise<void>;
  loadActivities: (force?: boolean) => Promise<void>;
  loadGuests: (query?: string, blacklisted?: boolean, force?: boolean) => Promise<void>;
  loadPolicies: (force?: boolean) => Promise<void>;
  loadExecutiveReport: (period: string, force?: boolean) => Promise<void>;
  performSearch: (query: string) => Promise<void>;
  loadGuestJourney: (guestId: string) => Promise<void>;
  updatePolicies: (data: { guestMonthlyLimit: number; hostConcurrentLimit: number }) => Promise<boolean>;
  blacklistToggle: (guestId: string, action: 'blacklist' | 'unblacklist') => Promise<boolean>;
  clearSelectedGuest: () => void;
  refreshAll: () => Promise<void>;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

// Cache durations in milliseconds
const CACHE_DURATIONS = {
  stats: 60000,        // 1 minute
  activities: 30000,   // 30 seconds
  guests: 60000,       // 1 minute
  policies: 300000,    // 5 minutes
  report: 120000,      // 2 minutes
};

// Refresh intervals
const REFRESH_INTERVALS = {
  activities: 30000,   // Auto-refresh activities every 30 seconds
  stats: 60000,        // Auto-refresh stats every minute
};

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  
  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [policies, setPolicies] = useState<Policies | null>(null);
  const [executiveReport, setExecutiveReport] = useState<ExecutiveReport | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestJourney | null>(null);
  
  // Location state
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  
  // Loading states
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLoadingGuests, setIsLoadingGuests] = useState(false);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingJourney, setIsLoadingJourney] = useState(false);
  
  // Cache timestamps
  const [lastFetch, setLastFetch] = useState({
    stats: null as number | null,
    activities: null as number | null,
    guests: null as number | null,
    policies: null as number | null,
    report: null as number | null,
  });
  
  // Store query params for guests to check cache validity
  const guestsQueryRef = useRef({ query: '', blacklisted: false });
  const reportPeriodRef = useRef('weekly');
  const locationRef = useRef('all');
  
  // Check if cache is still valid
  const isCacheValid = useCallback((key: keyof typeof CACHE_DURATIONS, checkLocation = true) => {
    const lastFetchTime = lastFetch[key];
    if (!lastFetchTime) return false;
    // Invalidate cache if location changed
    if (checkLocation && locationRef.current !== selectedLocationId) return false;
    return Date.now() - lastFetchTime < CACHE_DURATIONS[key];
  }, [lastFetch, selectedLocationId]);
  
  // Load stats with caching
  const loadStats = useCallback(async (force = false) => {
    // Skip if we have valid cache and not forcing
    if (!force && isCacheValid('stats') && stats) {
      console.log('[AdminData] Using cached stats (age:', Math.round((Date.now() - (lastFetch.stats || 0))/1000), 'seconds)');
      return;
    }
    // Skip if already loading
    if (isLoadingStats) {
      console.log('[AdminData] Already loading stats, skipping');
      return;
    }
    
    console.log('[AdminData] Loading fresh stats from API (location:', selectedLocationId, ')');
    try {
      setIsLoadingStats(true);
      const locationParam = selectedLocationId && selectedLocationId !== 'all' ? `?location=${selectedLocationId}` : '';
      const response = await fetch(`/api/admin/stats${locationParam}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setLastFetch(prev => ({ ...prev, stats: Date.now() }));
        locationRef.current = selectedLocationId;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      if (!stats) { // Only show error if we don't have cached data
        toast({
          title: 'Error',
          description: 'Failed to load statistics',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoadingStats(false);
    }
  }, [stats, isLoadingStats, toast, isCacheValid, selectedLocationId]);
  
  // Load activities with caching
  const loadActivities = useCallback(async (force = false) => {
    // Skip if we have valid cache and not forcing
    if (!force && isCacheValid('activities') && activities.length > 0) {
      console.log('[AdminData] Using cached activities (age:', Math.round((Date.now() - (lastFetch.activities || 0))/1000), 'seconds)');
      return;
    }
    // Skip if already loading
    if (isLoadingActivities) {
      console.log('[AdminData] Already loading activities, skipping');
      return;
    }
    
    console.log('[AdminData] Loading fresh activities from API (location:', selectedLocationId, ')');
    try {
      setIsLoadingActivities(true);
      const locationParam = selectedLocationId && selectedLocationId !== 'all' ? `?location=${selectedLocationId}` : '';
      const response = await fetch(`/api/admin/activity${locationParam}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setLastFetch(prev => ({ ...prev, activities: Date.now() }));
        locationRef.current = selectedLocationId;
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [activities.length, isLoadingActivities, isCacheValid, selectedLocationId]);
  
  // Load guests with caching
  const loadGuests = useCallback(async (query = '', blacklisted = false, force = false) => {
    // Check if cache is valid for the same query
    const sameQuery = guestsQueryRef.current.query === query && 
                      guestsQueryRef.current.blacklisted === blacklisted;
    
    // Skip if we have valid cache for the same query and not forcing
    if (!force && sameQuery && isCacheValid('guests') && guests.length > 0) {
      console.log('[AdminData] Using cached guests (age:', Math.round((Date.now() - (lastFetch.guests || 0))/1000), 'seconds, query:', query, 'blacklisted:', blacklisted, ')');
      return;
    }
    // Skip if already loading
    if (isLoadingGuests) {
      console.log('[AdminData] Already loading guests, skipping');
      return;
    }
    
    console.log('[AdminData] Loading fresh guests from API (query:', query, 'blacklisted:', blacklisted, ')');
    try {
      setIsLoadingGuests(true);
      guestsQueryRef.current = { query, blacklisted };
      
      const locationParam = selectedLocationId && selectedLocationId !== 'all' ? `&location=${selectedLocationId}` : '';
      const response = await fetch(`/api/admin/guests?query=${query}&blacklisted=${blacklisted}${locationParam}`);
      if (response.ok) {
        const data = await response.json();
        setGuests(data.guests || []);
        setLastFetch(prev => ({ ...prev, guests: Date.now() }));
        locationRef.current = selectedLocationId;
      }
    } catch (error) {
      console.error('Error loading guests:', error);
    } finally {
      setIsLoadingGuests(false);
    }
  }, [guests.length, isLoadingGuests, isCacheValid, selectedLocationId]);
  
  // Load policies with caching
  const loadPolicies = useCallback(async (force = false) => {
    // Skip if we have valid cache and not forcing
    if (!force && isCacheValid('policies') && policies) {
      console.log('[AdminData] Using cached policies (age:', Math.round((Date.now() - (lastFetch.policies || 0))/1000), 'seconds)');
      return;
    }
    // Skip if already loading
    if (isLoadingPolicies) {
      console.log('[AdminData] Already loading policies, skipping');
      return;
    }
    
    console.log('[AdminData] Loading fresh policies from API');
    try {
      setIsLoadingPolicies(true);
      const response = await fetch('/api/admin/policies');
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies || data);
        setLastFetch(prev => ({ ...prev, policies: Date.now() }));
      }
    } catch (error) {
      console.error('Error loading policies:', error);
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [policies, isLoadingPolicies, isCacheValid]);
  
  // Load executive report with caching
  const loadExecutiveReport = useCallback(async (period: string, force = false) => {
    const samePeriod = reportPeriodRef.current === period;
    
    // Skip if we have valid cache for the same period and not forcing
    if (!force && samePeriod && isCacheValid('report') && executiveReport) {
      console.log('[AdminData] Using cached report (age:', Math.round((Date.now() - (lastFetch.report || 0))/1000), 'seconds, period:', period, ')');
      return;
    }
    // Skip if already loading
    if (isLoadingReport) {
      console.log('[AdminData] Already loading report, skipping');
      return;
    }
    
    console.log('[AdminData] Loading fresh report from API (period:', period, ')');
    try {
      setIsLoadingReport(true);
      reportPeriodRef.current = period;
      
      const locationParam = selectedLocationId && selectedLocationId !== 'all' ? `&location=${selectedLocationId}` : '';
      const response = await fetch(`/api/admin/reports?period=${period}${locationParam}`);
      if (response.ok) {
        const data = await response.json();
        setExecutiveReport(data);
        setLastFetch(prev => ({ ...prev, report: Date.now() }));
        locationRef.current = selectedLocationId;
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setIsLoadingReport(false);
    }
  }, [executiveReport, isLoadingReport, isCacheValid, selectedLocationId]);
  
  // Search (no caching for search)
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearching(true);
      const locationParam = selectedLocationId && selectedLocationId !== 'all' ? `&location=${selectedLocationId}` : '';
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}&limit=20${locationParam}`);
      if (response.ok) {
        const data = await response.json();
        // Add a small delay in development to see loading state
        if (process.env.NODE_ENV === 'development') {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Error performing search:', error);
    } finally {
      setIsSearching(false);
    }
  }, [selectedLocationId]);
  
  // Load guest journey (no caching for individual journeys)
  const loadGuestJourney = useCallback(async (guestId: string) => {
    try {
      setIsLoadingJourney(true);
      const response = await fetch(`/api/admin/guests/${guestId}/journey`);
      if (response.ok) {
        const data = await response.json();
        setSelectedGuest(data);
      }
    } catch (error) {
      console.error('Error loading guest journey:', error);
      toast({
        title: 'Error',
        description: 'Failed to load guest journey',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingJourney(false);
    }
  }, [toast]);
  
  // Update policies with optimistic update
  const updatePolicies = useCallback(async (data: { guestMonthlyLimit: number; hostConcurrentLimit: number }) => {
    const previousPolicies = policies;
    
    // Optimistic update
    if (policies) {
      setPolicies({ ...policies, ...data });
    }
    
    try {
      const response = await fetch('/api/admin/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setPolicies(result.policies);
        setLastFetch(prev => ({ ...prev, policies: Date.now() }));
        toast({ title: 'Success', description: 'Policies updated successfully!' });
        return true;
      } else {
        // Revert on error
        setPolicies(previousPolicies);
        toast({ 
          title: 'Error', 
          description: result.error || 'Failed to update policies',
          variant: 'destructive' 
        });
        return false;
      }
    } catch (error) {
      // Revert on error
      setPolicies(previousPolicies);
      toast({ 
        title: 'Error', 
        description: 'Network error. Please try again.',
        variant: 'destructive' 
      });
      return false;
    }
  }, [policies, toast]);
  
  // Blacklist toggle with optimistic update
  const blacklistToggle = useCallback(async (guestId: string, action: 'blacklist' | 'unblacklist') => {
    const previousGuests = [...guests];
    
    // Optimistic update
    setGuests(prev => prev.map(guest => 
      guest.id === guestId 
        ? { ...guest, isBlacklisted: action === 'blacklist' }
        : guest
    ));
    
    try {
      const response = await fetch(`/api/admin/guests/${guestId}/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: 'Success', description: data.message });
        // Invalidate cache to force refresh on next access
        setLastFetch(prev => ({ ...prev, guests: null }));
        return true;
      } else {
        // Revert on error
        setGuests(previousGuests);
        toast({ 
          title: 'Error', 
          description: data.error || 'Failed to update blacklist status',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      // Revert on error
      setGuests(previousGuests);
      toast({ 
        title: 'Error', 
        description: 'Network error. Please try again.',
        variant: 'destructive'
      });
      return false;
    }
  }, [guests, toast]);
  
  const clearSelectedGuest = useCallback(() => {
    setSelectedGuest(null);
  }, []);
  
  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadStats(true),
      loadActivities(true),
      loadGuests(guestsQueryRef.current.query, guestsQueryRef.current.blacklisted, true),
      loadPolicies(true),
      executiveReport && loadExecutiveReport(reportPeriodRef.current, true),
    ]);
  }, [loadStats, loadActivities, loadGuests, loadPolicies, loadExecutiveReport, executiveReport]);
  
  // Set up auto-refresh intervals only when data has been loaded
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    
    // Auto-refresh activities every 30 seconds if we have activities
    if (activities.length > 0 || lastFetch.activities) {
      console.log('[AdminData] Setting up auto-refresh for activities (30s interval)');
      intervals.push(setInterval(() => {
        console.log('[AdminData] Auto-refreshing activities');
        loadActivities(true);
      }, REFRESH_INTERVALS.activities));
    }
    
    // Auto-refresh stats every minute if we have stats
    if (stats || lastFetch.stats) {
      console.log('[AdminData] Setting up auto-refresh for stats (60s interval)');
      intervals.push(setInterval(() => {
        console.log('[AdminData] Auto-refreshing stats');
        loadStats(true);
      }, REFRESH_INTERVALS.stats));
    }
    
    return () => {
      intervals.forEach(clearInterval);
    };
  }, [loadActivities, loadStats, activities.length, stats, lastFetch.activities, lastFetch.stats]);
  
  // Invalidate caches and reload when location changes
  useEffect(() => {
    if (locationRef.current !== selectedLocationId) {
      console.log('[AdminData] Location changed from', locationRef.current, 'to', selectedLocationId, '- invalidating caches');
      // Clear cache timestamps to force reload
      setLastFetch({
        stats: null,
        activities: null,
        guests: null,
        policies: null,
        report: null,
      });
      // Trigger reload of currently visible data
      if (stats) loadStats(true);
      if (activities.length > 0) loadActivities(true);
      if (guests.length > 0) loadGuests(guestsQueryRef.current.query, guestsQueryRef.current.blacklisted, true);
      if (executiveReport) loadExecutiveReport(reportPeriodRef.current, true);
    }
  }, [selectedLocationId]);
  
  // Helper function to get location context for UI copy
  const getLocationContext = useCallback(() => {
    const isSingleLocation = selectedLocationId && selectedLocationId !== 'all';
    const locations = stats?.locations || [];
    const currentLocation = isSingleLocation 
      ? locations.find(loc => loc.id === selectedLocationId)
      : null;
    
    return {
      isSingleLocation,
      locationName: currentLocation?.name || null,
      locationCount: locations.length,
      locationPhrase: isSingleLocation 
        ? `at ${currentLocation?.name || 'this location'}`
        : `across all ${locations.length || ''} locations`,
      locationDescription: isSingleLocation
        ? currentLocation?.name || 'Location'
        : 'All Locations'
    };
  }, [selectedLocationId, stats]);
  
  const value: AdminDataContextType = {
    // Data
    stats,
    activities,
    guests,
    policies,
    executiveReport,
    searchResults,
    selectedGuest,
    
    // Location state
    selectedLocationId,
    setSelectedLocationId,
    getLocationContext,
    
    // Loading states
    isLoadingStats,
    isLoadingActivities,
    isLoadingGuests,
    isLoadingPolicies,
    isLoadingReport,
    isSearching,
    isLoadingJourney,
    
    // Cache timestamps
    lastFetch,
    
    // Actions
    loadStats,
    loadActivities,
    loadGuests,
    loadPolicies,
    loadExecutiveReport,
    performSearch,
    loadGuestJourney,
    updatePolicies,
    blacklistToggle,
    clearSelectedGuest,
    refreshAll,
  };
  
  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (context === undefined) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
}