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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Executive Summary Reports
            </CardTitle>
            <CardDescription>
              {locationContext.isSingleLocation 
                ? `Analytics for ${locationContext.locationName}`
                : `Cross-location analytics (${locationContext.locationCount} locations)`}
            </CardDescription>
          </div>
          <Select value={reportPeriod} onValueChange={setReportPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Visits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{executiveReport.metrics.totalVisits.value}</div>
                  <p className={`text-xs ${executiveReport.metrics.totalVisits.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {executiveReport.metrics.totalVisits.change >= 0 ? '+' : ''}{executiveReport.metrics.totalVisits.change}% from previous period
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Unique Guests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{executiveReport.metrics.uniqueGuests.value}</div>
                  <p className={`text-xs ${executiveReport.metrics.uniqueGuests.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {executiveReport.metrics.uniqueGuests.change >= 0 ? '+' : ''}{executiveReport.metrics.uniqueGuests.change}% from previous period
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{executiveReport.conversions.overallConversion}%</div>
                  <p className="text-xs text-muted-foreground">Invites to check-ins</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Countries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {executiveReport.demographics.countries.slice(0, 5).map((country) => (
                      <div key={country.country} className="flex items-center justify-between">
                        <span className="text-sm">{country.country}</span>
                        <Badge variant="outline">{country.count} visitors</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Override Rate</span>
                      <Badge variant={executiveReport.systemHealth.overrideRate > 10 ? "destructive" : "default"}>
                        {executiveReport.systemHealth.overrideRate}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">New Blacklists</span>
                      <Badge variant="outline">{executiveReport.systemHealth.blacklistGrowth}</Badge>
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