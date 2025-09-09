'use client';

import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Search,
  RefreshCw,
  Globe
} from 'lucide-react';

// Import overview tab immediately since it's the default active tab
import OverviewTab from './tabs/OverviewTab';
// Import skeleton for initial loading
import { AdminSkeleton } from './AdminSkeleton';
// Import error boundary for tab error handling
import { TabErrorBoundary } from './TabErrorBoundary';

// Lazy load tab components only when needed
const ActivityTab = lazy(() => import('./tabs/ActivityTab'));
const GuestsTab = lazy(() => import('./tabs/GuestsTab'));
const ReportsTab = lazy(() => import('./tabs/ReportsTab'));
const PoliciesTab = lazy(() => import('./tabs/PoliciesTab'));
const AuditTab = lazy(() => import('./tabs/AuditTab'));

// Import modal component for guest journey
import GuestJourneyModal from './GuestJourneyModal';

// Loading component for lazy-loaded tabs
const TabLoading = () => (
  <div className="flex justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

interface SearchResult {
  type: 'guest' | 'host' | 'visit';
  id: string;
  title: string;
  subtitle: string;
  description: string;
  data: Record<string, unknown>;
  relevanceScore: number;
}

export default function AdminDashboard() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isOverviewDataLoaded, setIsOverviewDataLoaded] = useState(false);
  const [prefetchedTabs, setPrefetchedTabs] = useState<Set<string>>(new Set());
  
  // Modal state for guest journey
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  

  const performGlobalSearch = useCallback(async () => {
    if (!globalSearchTerm || globalSearchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(globalSearchTerm)}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Error performing global search:', error);
    }
  }, [globalSearchTerm]);

  // Prefetch tab components in the background
  const prefetchTab = useCallback(async (tabName: string) => {
    if (prefetchedTabs.has(tabName)) return;
    
    try {
      switch (tabName) {
        case 'activity':
          await import('./tabs/ActivityTab');
          break;
        case 'guests':
          await import('./tabs/GuestsTab');
          break;
        case 'reports':
          await import('./tabs/ReportsTab');
          break;
        case 'policies':
          await import('./tabs/PoliciesTab');
          break;
        case 'audit':
          await import('./tabs/AuditTab');
          break;
      }
      setPrefetchedTabs(prev => new Set([...prev, tabName]));
    } catch (error) {
      console.warn(`Failed to prefetch tab: ${tabName}`, error);
    }
  }, [prefetchedTabs]);

  // Handle tab changes with smart loading
  const handleTabChange = useCallback((tabName: string) => {
    setActiveTab(tabName);
    
    // Prefetch likely next tabs based on current tab
    const prefetchMap: Record<string, string[]> = {
      overview: ['activity', 'guests'], // Most common flow
      activity: ['guests', 'reports'],
      guests: ['reports'],
      reports: ['policies'],
      policies: ['audit'],
      audit: []
    };
    
    prefetchMap[tabName]?.forEach(nextTab => {
      // Delay prefetching to not interfere with current tab loading
      setTimeout(() => prefetchTab(nextTab), 100);
    });
  }, [prefetchTab]);

  const handleGuestJourneyView = (guestId: string) => {
    setSelectedGuestId(guestId);
    setIsGuestModalOpen(true);
  };

  const handleCloseGuestModal = () => {
    setIsGuestModalOpen(false);
    setSelectedGuestId(null);
  };

  const handleRefreshAll = () => {
    // Clear prefetch cache and reload overview data
    setPrefetchedTabs(new Set());
    setIsOverviewDataLoaded(false);
    window.location.reload();
  };

  const handleOverviewDataLoaded = () => {
    setIsOverviewDataLoaded(true);
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performGlobalSearch();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [performGlobalSearch]);

  // Start prefetching commonly used tabs after overview loads
  useEffect(() => {
    if (isOverviewDataLoaded) {
      // Prefetch activity tab since it's the most likely next tab to be visited
      setTimeout(() => prefetchTab('activity'), 500);
    }
  }, [isOverviewDataLoaded, prefetchTab]);

  // Show skeleton until overview data is loaded
  if (!isOverviewDataLoaded) {
    return (
      <>
        <AdminSkeleton />
        {/* Hidden overview tab that loads data in background */}
        <div style={{ display: 'none' }}>
          <OverviewTab onDataLoaded={handleOverviewDataLoaded} />
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Subtle background gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-20 pointer-events-none" />
      
      <div className="container mx-auto px-4 py-8 space-y-6 relative">
        {/* Enhanced Header with glassmorphism */}
        <div className="backdrop-blur-xl bg-surface-1/80 border border-border/50 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                Frontier Tower - Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">System administration and analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="default" className="flex items-center gap-2 bg-primary/10 text-primary border-primary/20 px-3 py-1.5 shadow-sm shadow-primary/10">
                <div className="p-1 rounded bg-primary/20">
                  <Shield className="h-3 w-3" />
                </div>
                Admin Access
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                className="border-border/50 hover:bg-accent/10 hover:border-primary/30 transition-all shadow-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Global Search with better visual hierarchy */}
        <Card className="border-border/50 bg-gradient-to-br from-card to-surface-1/50 overflow-hidden shadow-lg">
          <CardHeader className="border-b border-border/30 bg-surface-0/30">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              Global Search
            </CardTitle>
            <CardDescription className="text-muted-foreground">Search across guests, hosts, and visits</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 rounded bg-primary/10">
                  <Search className="h-4 w-4 text-primary" />
                </div>
                <Input
                  placeholder="Search guests, hosts, visits..."
                  value={globalSearchTerm}
                  onChange={(e) => setGlobalSearchTerm(e.target.value)}
                  className="pl-11 bg-surface-0/50 border-border/50 focus:border-primary/50 focus:bg-surface-1/50 transition-all shadow-sm"
                />
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto rounded-lg border border-border/30 bg-surface-0/30 p-2">
                {searchResults.map((result) => (
                  <div 
                    key={`${result.type}-${result.id}`} 
                    className="p-3 rounded-lg border border-border/20 hover:bg-accent/10 hover:border-primary/30 cursor-pointer transition-all group"
                    onClick={() => result.type === 'guest' && handleGuestJourneyView(result.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {result.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                        <p className="text-xs text-muted-foreground/70">{result.description}</p>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`ml-3 ${
                          result.type === 'guest' ? 'bg-primary/10 text-primary border-primary/20' :
                          result.type === 'host' ? 'bg-info/10 text-info border-info/20' :
                          'bg-warning/10 text-warning border-warning/20'
                        }`}
                      >
                        {result.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-surface-1/80 backdrop-blur-xl border border-border/50 p-1 shadow-lg">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-all"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="activity"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-all"
            >
              Live Activity
            </TabsTrigger>
            <TabsTrigger 
              value="guests"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-all"
            >
              Guest Management
            </TabsTrigger>
            <TabsTrigger 
              value="reports"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-all"
            >
              Executive Reports
            </TabsTrigger>
            <TabsTrigger 
              value="policies"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-all"
            >
              System Policies
            </TabsTrigger>
            <TabsTrigger 
              value="audit"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/20 transition-all"
            >
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewTab onDataLoaded={handleOverviewDataLoaded} />
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <TabErrorBoundary tabName="Activity">
              <Suspense fallback={<TabLoading />}>
                <ActivityTab isActive={activeTab === 'activity'} />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>

          <TabsContent value="guests" className="space-y-6">
            <TabErrorBoundary tabName="Guest Management">
              <Suspense fallback={<TabLoading />}>
                <GuestsTab 
                  onViewJourney={handleGuestJourneyView}
                  isActive={activeTab === 'guests'}
                />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <TabErrorBoundary tabName="Executive Reports">
              <Suspense fallback={<TabLoading />}>
                <ReportsTab isActive={activeTab === 'reports'} />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <TabErrorBoundary tabName="System Policies">
              <Suspense fallback={<TabLoading />}>
                <PoliciesTab isActive={activeTab === 'policies'} />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <TabErrorBoundary tabName="Audit Log">
              <Suspense fallback={<TabLoading />}>
                <AuditTab isActive={activeTab === 'audit'} />
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>

        </Tabs>
        
        {/* Guest Journey Modal */}
        <GuestJourneyModal
          isOpen={isGuestModalOpen}
          guestId={selectedGuestId}
          onClose={handleCloseGuestModal}
        />
      </div>
    </div>
  );
}