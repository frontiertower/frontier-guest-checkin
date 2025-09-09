'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminData } from '@/contexts/AdminDataContext';
import { FileText } from 'lucide-react';

interface ReportsTabProps {
  isActive?: boolean;
}

export default function ReportsTab({ isActive = false }: ReportsTabProps) {
  const { executiveReport, isLoadingReport, loadExecutiveReport, getLocationContext } = useAdminData();
  const locationContext = getLocationContext();
  const [reportPeriod, setReportPeriod] = useState('weekly');

  // Load report when tab becomes active and we don't have cached data
  useEffect(() => {
    if (isActive && !executiveReport) {
      loadExecutiveReport(reportPeriod);
    }
  }, [isActive, executiveReport, loadExecutiveReport, reportPeriod]);

  // Reload when period changes
  useEffect(() => {
    if (isActive) {
      loadExecutiveReport(reportPeriod);
    }
  }, [reportPeriod, isActive, loadExecutiveReport]);

  // Show skeleton when loading (including when switching locations)
  if (isLoadingReport) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-48 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-9 w-40 bg-muted rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
                    <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-surface-1/50 overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-surface-0/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              Executive Summary Reports
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              {locationContext.isSingleLocation 
                ? `Analytics for ${locationContext.locationName}`
                : `Cross-location analytics (${locationContext.locationCount} locations)`}
            </CardDescription>
          </div>
          <Select value={reportPeriod} onValueChange={setReportPeriod}>
            <SelectTrigger className="w-40 bg-surface-0/50 border-border/50 hover:bg-surface-1/50 hover:border-primary/30 transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-elevated border-border/50">
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {executiveReport ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="relative overflow-hidden border-border/30 bg-gradient-to-br from-surface-1/50 to-surface-2/30 group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-info/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="relative pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Visits</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold text-foreground tracking-tight mb-2">
                    {executiveReport.metrics.totalVisits.value}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${executiveReport.metrics.totalVisits.change >= 0 ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                      {executiveReport.metrics.totalVisits.change >= 0 ? '↑' : '↓'}
                      {Math.abs(executiveReport.metrics.totalVisits.change)}%
                    </div>
                    <span className="text-xs text-muted-foreground">vs previous</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="relative overflow-hidden border-border/30 bg-gradient-to-br from-surface-1/50 to-surface-2/30 group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="relative pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unique Guests</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold text-foreground tracking-tight mb-2">
                    {executiveReport.metrics.uniqueGuests.value}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${executiveReport.metrics.uniqueGuests.change >= 0 ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                      {executiveReport.metrics.uniqueGuests.change >= 0 ? '↑' : '↓'}
                      {Math.abs(executiveReport.metrics.uniqueGuests.change)}%
                    </div>
                    <span className="text-xs text-muted-foreground">vs previous</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="relative overflow-hidden border-border/30 bg-gradient-to-br from-surface-1/50 to-surface-2/30 group hover:shadow-lg hover:shadow-success/5 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="relative pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold text-foreground tracking-tight">
                      {executiveReport.conversions.overallConversion}
                    </span>
                    <span className="text-xl font-bold text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Invites to check-ins</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/30 bg-gradient-to-br from-surface-1/50 to-surface-0/30">
                <CardHeader className="border-b border-border/20">
                  <CardTitle className="text-base font-semibold text-foreground">Top Countries</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {executiveReport.demographics.countries.slice(0, 5).map((country, index) => (
                      <div key={country.country} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground/50 w-4">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            {country.country}
                          </span>
                        </div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold">
                          {country.count} visitors
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/30 bg-gradient-to-br from-surface-1/50 to-surface-0/30">
                <CardHeader className="border-b border-border/20">
                  <CardTitle className="text-base font-semibold text-foreground">System Health</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-surface-2/30 border border-border/20 hover:border-border/40 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Override Rate</span>
                        <Badge 
                          variant={executiveReport.systemHealth.overrideRate > 10 ? "destructive" : "secondary"}
                          className={executiveReport.systemHealth.overrideRate > 10 
                            ? "bg-destructive/10 text-destructive border-destructive/20 shadow-sm shadow-destructive/10" 
                            : "bg-success/10 text-success border-success/20"}
                        >
                          {executiveReport.systemHealth.overrideRate}%
                        </Badge>
                      </div>
                      <div className="h-2 bg-surface-3/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${executiveReport.systemHealth.overrideRate > 10 ? 'bg-gradient-to-r from-destructive/60 to-destructive' : 'bg-gradient-to-r from-success/60 to-success'}`}
                          style={{ width: `${Math.min(executiveReport.systemHealth.overrideRate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-2/30 border border-border/20 hover:border-border/40 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">New Blacklists</span>
                        <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                          {executiveReport.systemHealth.blacklistGrowth}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Loading executive report...
          </p>
        )}
      </CardContent>
    </Card>
  );
}