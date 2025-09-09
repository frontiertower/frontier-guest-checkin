'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, Ban, RotateCcw, Eye } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';

interface Guest {
  id: string;
  name: string;
  email: string;
  country?: string;
  isBlacklisted: boolean;
  recentVisits: number;
  lifetimeVisits: number;
  lastVisitDate?: string;
  hasDiscount: boolean;
  createdAt: string;
}

interface GuestsTabProps {
  onViewJourney?: (guestId: string) => void;
  isActive?: boolean;
}

export default function GuestsTab({ onViewJourney, isActive = false }: GuestsTabProps) {
  const { guests, isLoadingGuests, loadGuests, blacklistToggle, getLocationContext } = useAdminData();
  const locationContext = getLocationContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBlacklisted, setShowBlacklisted] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');

  // Load guests when tab becomes active and we don't have cached data
  useEffect(() => {
    if (isActive && guests.length === 0) {
      loadGuests(searchTerm, showBlacklisted);
    }
  }, [isActive, guests.length, loadGuests, searchTerm, showBlacklisted]);

  // Reload when search terms change
  useEffect(() => {
    if (isActive) {
      loadGuests(searchTerm, showBlacklisted);
    }
  }, [searchTerm, showBlacklisted, isActive, loadGuests]);

  const handleBlacklistToggle = (guestId: string, action: 'blacklist' | 'unblacklist') => {
    blacklistToggle(guestId, action);
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


  // Show skeleton when loading (including when switching locations)
  if (isLoadingGuests) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mb-4" />
          <div className="flex flex-wrap gap-2">
            <div className="h-10 flex-1 min-w-64 bg-muted rounded animate-pulse" />
            <div className="h-10 w-40 bg-muted rounded animate-pulse" />
            <div className="h-10 w-32 bg-muted rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-surface-1/50 overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-surface-0/30">
        <CardTitle className="text-lg font-semibold text-foreground">Guest Management</CardTitle>
        <CardDescription className="text-muted-foreground">
          {locationContext.isSingleLocation 
            ? `Guests who have visited ${locationContext.locationName}`
            : `All guests ${locationContext.locationPhrase}`}
        </CardDescription>
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-64">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 rounded bg-primary/10">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <Input
              placeholder="Search guests by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 bg-surface-0/50 border-border/50 focus:border-primary/50 focus:bg-surface-1/50 transition-all"
            />
          </div>
          
          <Select value={quickFilter} onValueChange={setQuickFilter}>
            <SelectTrigger className="w-40 bg-surface-0/50 border-border/50 hover:bg-surface-1/50 hover:border-primary/30 transition-all">
              <Filter className="h-4 w-4 mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-elevated border-border/50">
              <SelectItem value="all">All Guests</SelectItem>
              <SelectItem value="frequent">Frequent Visitors</SelectItem>
              <SelectItem value="new">New (7 days)</SelectItem>
              <SelectItem value="blacklisted">Blacklisted</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showBlacklisted ? "default" : "outline"}
            onClick={() => setShowBlacklisted(!showBlacklisted)}
            className={showBlacklisted ? "bg-destructive hover:bg-destructive/90 shadow-md shadow-destructive/20" : "border-border/50 hover:bg-accent/10 hover:border-primary/30"}
          >
            {showBlacklisted ? "Show All" : "Show Blacklisted"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {getFilteredGuests().length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted/30 mb-4">
              <Search className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm">
              {searchTerm ? 'No guests found matching your search.' : 'No guests found.'}
            </p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Try adjusting your filters or search terms
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 bg-surface-0/30 hover:bg-surface-0/50">
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guest</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Country</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Visits (30d)</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Total Visits</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredGuests().map((guest) => (
                  <TableRow key={guest.id} className="border-border/20 hover:bg-accent/5 transition-colors group">
                    <TableCell className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {guest.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {guest.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {guest.country || <span className="text-muted-foreground/50 italic">Unknown</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full bg-info/10 text-info border border-info/20">
                        {guest.recentVisits}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                        {guest.lifetimeVisits}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {guest.isBlacklisted && (
                          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 shadow-sm shadow-destructive/10">
                            Blacklisted
                          </Badge>
                        )}
                        {guest.hasDiscount && (
                          <Badge variant="secondary" className="bg-success/10 text-success border-success/20 shadow-sm shadow-success/10">
                            Discount
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewJourney?.(guest.id)}
                          className="border-border/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Journey
                        </Button>
                        {guest.isBlacklisted ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBlacklistToggle(guest.id, 'unblacklist')}
                            className="border-success/30 text-success hover:bg-success/10 hover:border-success/50 transition-all"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Unban
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleBlacklistToggle(guest.id, 'blacklist')}
                            className="bg-destructive/80 hover:bg-destructive shadow-sm shadow-destructive/20 hover:shadow-md hover:shadow-destructive/30 transition-all"
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" />
                            Blacklist
                          </Button>
                        )}
                      </div>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}