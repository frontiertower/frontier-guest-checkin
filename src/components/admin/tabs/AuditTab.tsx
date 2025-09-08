'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminData } from '@/contexts/AdminDataContext';

interface AuditTabProps {
  recentOverrides?: Array<Record<string, unknown>>;
  isActive?: boolean;
}

export default function AuditTab({ recentOverrides, isActive = false }: AuditTabProps) {
  const { stats, isLoadingStats, loadStats } = useAdminData();
  
  // Use provided overrides or from stats
  const overrides = recentOverrides || stats?.recentOverrides || [];
  
  // Load stats when tab becomes active and we don't have cached data
  useEffect(() => {
    if (isActive && !stats && !recentOverrides) {
      loadStats();
    }
  }, [isActive, stats, recentOverrides, loadStats]);

  // Show skeleton when tab is active and loading without data
  if (isActive && isLoadingStats && !stats && !recentOverrides) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Override Activities</CardTitle>
        <CardDescription>Security override actions in the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        {overrides && overrides.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Override By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((override) => (
                <TableRow key={override.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{override.guestName}</p>
                      <p className="text-sm text-muted-foreground">{override.guestEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>{override.hostName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{override.overrideReason}</Badge>
                  </TableCell>
                  <TableCell>{override.overrideBy}</TableCell>
                  <TableCell>
                    {new Date(override.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No override activities in the last 30 days.
          </p>
        )}
      </CardContent>
    </Card>
  );
}