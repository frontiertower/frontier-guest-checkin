'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Globe, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import type { Location } from '@/types/admin';

interface AdminPageHeaderProps {
  activeTab: string;
  selectedLocationId: string;
  onLocationChange: (locationId: string) => void;
  locations?: Location[];
  onRefresh: () => void;
}

function getActiveTabLabel(tab: string): string {
  const labels = {
    overview: 'Overview',
    activity: 'Live Activity',
    guests: 'Guest Management',
    reports: 'Executive Reports',
    policies: 'System Policies',
    audit: 'Audit Log',
    journey: 'Guest Journey'
  };
  return labels[tab as keyof typeof labels] || 'Dashboard';
}

export function AdminPageHeader({ 
  activeTab, 
  selectedLocationId, 
  onLocationChange, 
  locations, 
  onRefresh 
}: AdminPageHeaderProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Architectural background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-card to-card/80 dark:from-surface dark:to-surface/90 dark:via-surface" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/2 via-transparent to-primary/8 dark:from-primary/3 dark:via-transparent dark:to-primary/8" />
      
      {/* Subtle geometric accent lines inspired by tower architecture */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-primary/12 via-primary/6 to-transparent" />
        <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-primary/8 via-primary/4 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border-subtle/50 to-transparent" />
      </div>
      
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center md:gap-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="relative">
              <Logo size="sm" className="rounded-lg shadow-sm" />
              <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 to-transparent rounded-lg -z-10" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
                Frontier Tower
              </h1>
              {/* Show current section on mobile */}
              <p className="text-sm md:hidden text-primary font-semibold capitalize tracking-wide">
                {getActiveTabLabel(activeTab)}
              </p>
            </div>
          </div>
          <div className="hidden md:block">
            <p className="text-lg text-foreground/80 font-medium">Tower Operations & Analytics</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-sm text-primary font-medium">Live Dashboard</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Location Selector with enhanced styling */}
          {locations && (
            <div className="flex items-center gap-3 bg-surface/50 dark:bg-elevated/50 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/30">
              <Globe className="h-4 w-4 text-primary/80" />
              <Select value={selectedLocationId} onValueChange={onLocationChange}>
                <SelectTrigger className="w-48 bg-transparent border-none shadow-none focus:ring-0">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Enhanced admin badge with architectural styling */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg blur-sm" />
            <div className="relative bg-green-500/10 dark:bg-green-500/20 border border-green-500/25 dark:border-green-500/30 rounded-lg px-4 py-2 flex items-center gap-2 backdrop-blur-sm">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400 tracking-wide">Admin Access</span>
            </div>
          </div>
          
          {/* Enhanced refresh button */}
          <div className="relative group">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="bg-surface/50 dark:bg-elevated/50 backdrop-blur-sm border-border/50 hover:bg-elevated/80 hover:border-primary/30 transition-all duration-200 hover:shadow-sm dark:hover:shadow-primary/10"
            >
              <RefreshCw className="h-4 w-4 mr-2 transition-transform group-hover:rotate-180 duration-500" />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}