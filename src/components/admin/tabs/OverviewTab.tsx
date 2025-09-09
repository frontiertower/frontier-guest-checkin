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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.totalGuests}</div>
            <p className="text-xs text-muted-foreground">
              {locationContext.isSingleLocation 
                ? `Registered at ${locationContext.locationName}`
                : `Total across all locations`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.activeVisits}</div>
            <p className="text-xs text-muted-foreground">
              {locationContext.isSingleLocation 
                ? `Currently at ${locationContext.locationName}`
                : `Currently ${locationContext.locationPhrase}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Visits</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overview.todayVisits}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.overview.weekVisits - stats.overview.todayVisits} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discount Conversions</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.system.discountsSent}</div>
            <p className="text-xs text-muted-foreground">
              Took up membership offer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Hosts</CardTitle>
            <CardDescription>
              {locationContext.isSingleLocation 
                ? `Most active hosts at ${locationContext.locationName}`
                : `Most active hosts ${locationContext.locationPhrase}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topHosts.slice(0, 5).map((host, index) => (
                <div key={host.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{host.name}</p>
                      <p className="text-sm text-muted-foreground">{host.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{host.visitCount} visits</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Trend</CardTitle>
            <CardDescription>
              {locationContext.isSingleLocation 
                ? `Daily visits at ${locationContext.locationName}`
                : `Daily visits ${locationContext.locationPhrase}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.dailyTrends.map((day) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className="text-sm">{new Date(day.date).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted h-2 rounded">
                      <div 
                        className="bg-primary h-2 rounded" 
                        style={{ 
                          width: `${(day.visits / Math.max(...stats.dailyTrends.map(d => d.visits))) * 100}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8">{day.visits}</span>
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