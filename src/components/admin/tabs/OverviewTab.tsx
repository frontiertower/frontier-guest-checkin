'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, TrendingUp, Gift } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';


interface OverviewTabProps {
  onDataLoaded?: () => void;
}

export default function OverviewTab({ onDataLoaded }: OverviewTabProps) {
  const { stats, isLoadingStats, loadStats, selectedLocationId, getLocationContext } = useAdminData();
  const locationContext = getLocationContext();

  // Load stats when component mounts, but only if we don't have cached data
  useEffect(() => {
    if (!stats) {
      loadStats();
    }
    // Signal that component is ready (either with cached or fresh data)
    onDataLoaded?.();
  }, [stats, loadStats, onDataLoaded]);

  // Show skeleton when loading (including when switching locations)
  if (isLoadingStats) {
    return (
      <div className="space-y-6">
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts and Additional Stats Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Hosts Skeleton */}
          <Card>
            <CardHeader>
              <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                      <div>
                        <div className="h-4 w-32 bg-muted rounded animate-pulse mb-1" />
                        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Trend Skeleton */}
          <Card>
            <CardHeader>
              <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-surface-2/30 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Guests</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.overview.totalGuests}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {locationContext.isSingleLocation 
                ? `Registered at ${locationContext.locationName}`
                : `Total across all locations`}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-surface-2/30 hover:shadow-lg hover:shadow-success/5 hover:border-success/20 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Now</CardTitle>
            <div className="p-2 rounded-lg bg-success/10 backdrop-blur-sm">
              <UserCheck className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-foreground tracking-tight">{stats.overview.activeVisits}</div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-xs text-success font-medium">Live</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {locationContext.isSingleLocation 
                ? `Currently at ${locationContext.locationName}`
                : `Currently ${locationContext.locationPhrase}`}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-surface-2/30 hover:shadow-lg hover:shadow-info/5 hover:border-info/20 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-info/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today&apos;s Visits</CardTitle>
            <div className="p-2 rounded-lg bg-info/10 backdrop-blur-sm">
              <TrendingUp className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.overview.todayVisits}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-info">↑</span>
                <span className="text-xs font-medium text-info">+{stats.overview.weekVisits - stats.overview.todayVisits}</span>
              </div>
              <span className="text-xs text-muted-foreground">this week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-surface-2/30 hover:shadow-lg hover:shadow-warning/5 hover:border-warning/20 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Discount Conversions</CardTitle>
            <div className="p-2 rounded-lg bg-warning/10 backdrop-blur-sm">
              <Gift className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.system.discountsSent}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Took up membership offer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-gradient-to-br from-card to-surface-1/50 overflow-hidden">
          <CardHeader className="border-b border-border/30 bg-surface-0/30">
            <CardTitle className="text-lg font-semibold text-foreground">Top Hosts</CardTitle>
            <CardDescription className="text-muted-foreground">
              {locationContext.isSingleLocation 
                ? `Most active hosts at ${locationContext.locationName}`
                : `Most active hosts ${locationContext.locationPhrase}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {stats.topHosts.slice(0, 5).map((host, index) => (
                <div key={host.id} className="flex items-center justify-between p-4 hover:bg-accent/5 transition-colors duration-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-gradient-to-br from-warning to-warning/60 text-warning-foreground shadow-md shadow-warning/20' : index === 1 ? 'bg-gradient-to-br from-muted-foreground to-muted-foreground/60 text-background' : index === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-600/60 text-white' : 'bg-surface-2 text-muted-foreground'}`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{host.name}</p>
                      <p className="text-xs text-muted-foreground">{host.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold">
                    {host.visitCount} visits
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-card to-surface-1/50 overflow-hidden">
          <CardHeader className="border-b border-border/30 bg-surface-0/30">
            <CardTitle className="text-lg font-semibold text-foreground">Weekly Trend</CardTitle>
            <CardDescription className="text-muted-foreground">
              {locationContext.isSingleLocation 
                ? `Daily visits at ${locationContext.locationName}`
                : `Daily visits ${locationContext.locationPhrase}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {stats.dailyTrends.map((day, index) => {
                const maxVisits = Math.max(...stats.dailyTrends.map(d => d.visits));
                const percentage = (day.visits / maxVisits) * 100;
                const isToday = index === stats.dailyTrends.length - 1;
                return (
                  <div key={day.date} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {day.visits}
                      </span>
                    </div>
                    <div className="relative h-6 bg-surface-2/50 rounded-md overflow-hidden">
                      <div 
                        className={`absolute inset-y-0 left-0 ${isToday ? 'bg-gradient-to-r from-primary via-primary-hover to-primary/80' : 'bg-gradient-to-r from-primary/60 to-primary/40'} rounded-md transition-all duration-500 ease-out group-hover:shadow-lg group-hover:shadow-primary/20`}
                        style={{ 
                          width: `${percentage}%`
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                      </div>
                      <div className="absolute inset-y-0 left-0 flex items-center pl-2">
                        <span className="text-xs font-medium text-white/90 drop-shadow-sm">
                          {percentage > 20 && day.visits}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}