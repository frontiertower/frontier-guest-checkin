'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import './globals-responsive.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AdminDataProvider, useAdminData } from '@/contexts/AdminDataContext';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { PageCard } from '@/components/ui/page-card';
import { StatCard } from '@/components/ui/stat-card';
import { SearchInput } from '@/components/ui/search-input';
import { DataTable, type Column } from '@/components/ui/data-table';
// Import tab components
import OverviewTab from '@/components/admin/tabs/OverviewTab';
import ActivityTab from '@/components/admin/tabs/ActivityTab';
import GuestsTab from '@/components/admin/tabs/GuestsTab';
import ReportsTab from '@/components/admin/tabs/ReportsTab';
import PoliciesTab from '@/components/admin/tabs/PoliciesTab';
import AuditTab from '@/components/admin/tabs/AuditTab';
// Import modal component for guest journey
import GuestJourneyModal from '@/components/admin/GuestJourneyModal';
import { 
  Users, 
  UserCheck, 
  Shield, 
  Settings, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Search,
  Ban,
  RotateCcw,
  Activity as ActivityIcon,
  FileText,
  Globe,
  Filter,
  RefreshCw,
  Mail,
  QrCode,
  UserPlus,
  ShieldAlert,
  Gift,
  FileCheck,
  UserX,
  Eye
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';

// Import shared types
import type {
  AdminStats,
  Activity,
  SearchResult,
  GuestJourney,
  ExecutiveReport,
  Policies,
  Guest,
  Location
} from '@/types/admin';

function AdminPageContent() {
  // Use centralized data context
  const {
    stats,
    activities,
    guests,
    policies,
    executiveReport,
    searchResults,
    selectedGuest,
    selectedLocationId,
    setSelectedLocationId,
    isLoadingStats,
    isLoadingActivities,
    isLoadingGuests,
    isLoadingPolicies,
    isLoadingReport,
    isSearching,
    loadStats,
    loadActivities,
    loadGuests,
    loadPolicies,
    loadExecutiveReport,
    performSearch,
    updatePolicies,
    blacklistToggle,
    refreshAll
  } = useAdminData();
  
  // Track if we're waiting for search (user has typed but debounce hasn't fired yet)
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Define columns for guest table
  const guestColumns: Column<Guest>[] = [
    { key: 'name', label: 'Guest', className: 'font-medium' },
    { key: 'email', label: 'Email' },
    { key: 'country', label: 'Country', render: (value) => (value as string) || 'Unknown' },
    { key: 'recentVisits', label: 'Visits (30d)' },
    { key: 'lifetimeVisits', label: 'Total Visits' },
    {
      key: 'status',
      label: 'Status',
      render: (_, guest) => (
        <div className="flex gap-1">
          {guest.isBlacklisted && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-700 border border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30">
              Blacklisted
            </span>
          )}
          {guest.hasDiscount && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-700 border border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30">
              Discount
            </span>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, guest) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleLoadGuestJourney(guest.id)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Journey
          </Button>
          {guest.isBlacklisted ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBlacklistToggle(guest.id, 'unblacklist')}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Unban
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBlacklistToggle(guest.id, 'blacklist')}
            >
              <Ban className="h-4 w-4 mr-1" />
              Blacklist
            </Button>
          )}
        </div>
      ),
      className: 'flex gap-2'
    }
  ];
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  
  // Handle search input with typing detection
  const handleSearchChange = useCallback((value: string) => {
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Show typing indicator immediately when user types
    if (value && value !== globalSearchTerm) {
      setIsTyping(true);
      // Hide typing indicator after debounce completes
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 350); // Slightly longer than SearchInput's 300ms debounce
    } else if (!value) {
      setIsTyping(false);
    }
    
    setGlobalSearchTerm(value);
  }, [globalSearchTerm]);
  const [showBlacklisted, setShowBlacklisted] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [quickFilter, setQuickFilter] = useState('all');
  
  const { toast } = useToast();

  // Policy form state
  const [policyForm, setPolicyForm] = useState({
    guestMonthlyLimit: 3,
    hostConcurrentLimit: 3
  });

  // Mark as loaded immediately to show UI - tabs handle their own loading now
  useEffect(() => {
    setIsInitialLoad(false);
  }, []);

  // Search and report period changes are now handled by individual tab components

  // Global search (debouncing handled by SearchInput component)
  useEffect(() => {
    performSearch(globalSearchTerm);
  }, [performSearch, globalSearchTerm]);
  
  // Update policy form when policies change
  useEffect(() => {
    if (policies) {
      setPolicyForm({
        guestMonthlyLimit: policies.guestMonthlyLimit,
        hostConcurrentLimit: policies.hostConcurrentLimit
      });
    }
  }, [policies]);

  const handlePolicyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await updatePolicies(policyForm);
    if (success) {
      // Policy update successful - optimistic update already applied
    }
  };

  const handleBlacklistToggle = async (guestId: string, action: 'blacklist' | 'unblacklist') => {
    const success = await blacklistToggle(guestId, action);
    if (success) {
      // Blacklist update successful - optimistic update already applied
    }
  };

  // Modal state for guest journey
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [selectedGuestModalId, setSelectedGuestModalId] = useState<string | null>(null);

  // Handle opening guest journey modal
  const handleLoadGuestJourney = (guestId: string) => {
    console.log('[Admin] Opening guest journey modal for guest:', guestId);
    setSelectedGuestModalId(guestId);
    setIsGuestModalOpen(true);
  };

  const handleCloseGuestModal = () => {
    setIsGuestModalOpen(false);
    setSelectedGuestModalId(null);
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
      'user-check': UserCheck,
      'qr-code': QrCode,
      'user-plus': UserPlus,
      'ban': Ban,
      'shield-alert': ShieldAlert,
      'gift': Gift,
      'file-check': FileCheck,
      'user-x': UserX,
      'mail': Mail,
      'activity': ActivityIcon,
    };
    
    const IconComponent = iconMap[iconName] || ActivityIcon;
    return <IconComponent className="h-4 w-4" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'text-green-600 bg-green-500/10 dark:text-green-400 dark:bg-green-500/20';
      case 'warning': return 'text-yellow-600 bg-yellow-500/10 dark:text-yellow-400 dark:bg-yellow-500/20';
      case 'error': return 'text-red-600 bg-red-500/10 dark:text-red-400 dark:bg-red-500/20';
      default: return 'text-blue-600 bg-blue-500/10 dark:text-blue-400 dark:bg-blue-500/20';
    }
  };

  const getFilteredGuests = () => {
    let filtered = guests;
    
    switch (quickFilter) {
      case 'frequent':
        filtered = guests.filter(g => g.lifetimeVisits >= 3);
        break;
      case 'new':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = guests.filter(g => new Date(g.createdAt) >= sevenDaysAgo);
        break;
      case 'blacklisted':
        filtered = guests.filter(g => g.isBlacklisted);
        break;
      default:
        break;
    }
    
    return filtered;
  };

  // Only show loading on initial page load, not on data refresh
  const isLoading = isInitialLoad;
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="mb-6">
            <Logo size="lg" className="mx-auto mb-4" />
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background admin-container">
      <div className="container mx-auto px-4 py-8 space-y-8 main-content">
        {/* Header */}
        <AdminPageHeader 
          activeTab={activeTab}
          selectedLocationId={selectedLocationId}
          onLocationChange={setSelectedLocationId}
          locations={stats?.locations}
          onRefresh={refreshAll}
        />

        {/* Global Search */}
        <PageCard 
          title={selectedLocationId === 'all' || !selectedLocationId ? "Global Search" : "Location Search"}
          description={selectedLocationId === 'all' || !selectedLocationId 
            ? `Search across all ${stats?.locations?.length || ''} locations`
            : `Search within ${stats?.locations?.find(l => l.id === selectedLocationId)?.name || 'this location'}`}
          icon={selectedLocationId === 'all' || !selectedLocationId ? Globe : Search}
        >
          <div className="flex gap-2">
            <SearchInput
              placeholder="Search guests, hosts, visits..."
              value={globalSearchTerm}
              onChange={handleSearchChange}
              isLoading={isSearching}
              className="flex-1"
            />
          </div>
            
          {/* Search Loading State - show when typing OR searching */}
          {(isTyping || isSearching) && globalSearchTerm && (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" />
                      <div className="h-3 w-48 bg-muted rounded animate-pulse mb-1" />
                      <div className="h-2 w-64 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Search Results */}
          {!isTyping && !isSearching && searchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((result) => (
                <div key={`${result.type}-${result.id}`} className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                     onClick={() => {
                       console.log('[Admin] Search result clicked:', result.type, result.id, result.data);
                       if (result.type === 'guest') {
                         handleLoadGuestJourney(result.id);
                       } else if (result.type === 'visit' && result.data) {
                         // For visit results, extract the guest ID from the data
                         const visitData = result.data as Record<string, unknown>;
                         // Check both guestId field and guest.id from the included relation
                         const guestId = visitData.guestId || (visitData.guest as Record<string, unknown>)?.id;
                         console.log('[Admin] Visit data guestId:', guestId);
                         if (guestId) {
                           handleLoadGuestJourney(guestId as string);
                         }
                       }
                     }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{result.title}</p>
                      <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                      <p className="text-xs text-muted-foreground">{result.description}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      {result.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Empty State */}
          {!isTyping && !isSearching && globalSearchTerm && searchResults.length === 0 && (
            <div className="mt-4 p-8 text-center">
              <p className="text-muted-foreground mb-2">No results found for &ldquo;{globalSearchTerm}&rdquo;</p>
              <p className="text-sm text-muted-foreground">Try different keywords or check the spelling</p>
            </div>
          )}
        </PageCard>

        {/* Navigation Component */}
        <AdminNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <OverviewTab onDataLoaded={() => {}} />
          </TabsContent>

          {/* Live Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <ActivityTab isActive={activeTab === 'activity'} />
          </TabsContent>

          {/* Guest Management Tab */}
          <TabsContent value="guests" className="space-y-6">
            <GuestsTab 
              onViewJourney={handleLoadGuestJourney}
              isActive={activeTab === 'guests'}
            />
          </TabsContent>

          {/* Executive Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <ReportsTab 
              isActive={activeTab === 'reports'}
            />
          </TabsContent>

          {/* System Policies Tab */}
          <TabsContent value="policies" className="space-y-6">
            <PoliciesTab 
              isActive={activeTab === 'policies'}
            />
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-6">
            <AuditTab 
              recentOverrides={stats?.recentOverrides} 
              isActive={activeTab === 'audit'}
            />
          </TabsContent>

        </Tabs>
        
        {/* Guest Journey Modal */}
        <GuestJourneyModal
          isOpen={isGuestModalOpen}
          guestId={selectedGuestModalId}
          onClose={handleCloseGuestModal}
        />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminDataProvider>
      <AdminPageContent />
    </AdminDataProvider>
  );
}