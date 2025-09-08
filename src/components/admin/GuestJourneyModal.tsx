'use client';

import { useEffect } from 'react';
import './modal-scrollbar.css';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminData } from '@/contexts/AdminDataContext';
import { getAcceptanceStatusDescription, getAcceptanceStatusColor } from '@/lib/acceptance-helpers';
import { 
  UserCheck, 
  Activity, 
  Mail, 
  QrCode, 
  UserPlus, 
  ShieldAlert, 
  Gift, 
  FileCheck, 
  UserX, 
  Ban, 
  Users, 
  ArrowRightLeft,
  Phone,
  MapPin,
  Calendar,
  CheckCircle
} from 'lucide-react';

interface GuestJourneyModalProps {
  isOpen: boolean;
  guestId: string | null;
  onClose: () => void;
}

export default function GuestJourneyModal({ isOpen, guestId, onClose }: GuestJourneyModalProps) {
  const { selectedGuest, isLoadingJourney, loadGuestJourney, clearSelectedGuest } = useAdminData();

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
      'users': Users,
      'arrow-right-left': ArrowRightLeft,
      'activity': Activity,
    };
    
    const IconComponent = iconMap[iconName] || Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/30';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/30';
      case 'error': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/30';
      default: return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30';
    }
  };

  // Load guest journey when guestId changes and modal opens
  useEffect(() => {
    if (isOpen && guestId && selectedGuest?.guest?.id !== guestId) {
      loadGuestJourney(guestId);
    }
  }, [isOpen, guestId, selectedGuest, loadGuestJourney]);

  // Clear selected guest when modal closes
  const handleClose = () => {
    clearSelectedGuest();
    onClose();
  };

  // Show loading state
  if (isLoadingJourney) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="sr-only">Loading Guest Profile</DialogTitle>
            <div className="h-6 w-48 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                      </div>
                      <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!selectedGuest) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guest Not Found</DialogTitle>
            <DialogDescription>
              The requested guest could not be loaded. Please try again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Guest Profile: {selectedGuest.guest.name}
          </DialogTitle>
          <DialogDescription>
            Complete visit history and timeline for {selectedGuest.guest.email}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Guest Profile Section */}
          <div className="lg:col-span-1 space-y-4">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{selectedGuest.guest.email}</span>
                  </div>
                  
                  {selectedGuest.guest.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{selectedGuest.guest.phone}</span>
                    </div>
                  )}
                  
                  {selectedGuest.guest.country && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{selectedGuest.guest.country}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Registered: {new Date(selectedGuest.guest.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {/* Dynamic Acceptance Status Badge */}
                  {selectedGuest.guest.acceptanceStatus ? (
                    (() => {
                      const status = selectedGuest.guest.acceptanceStatus;
                      const colors = getAcceptanceStatusColor(status);
                      const description = getAcceptanceStatusDescription(status);
                      
                      return (
                        <Badge 
                          variant="outline" 
                          className={`${colors.text} ${colors.bg} ${colors.border}`}
                          title={description}
                        >
                          {status.status === 'valid' ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : status.status === 'expired' ? (
                            <Activity className="h-3 w-3 mr-1" />
                          ) : null}
                          {status.status === 'valid' && status.type === 'visit-scoped' && status.daysUntilExpiry !== undefined && status.daysUntilExpiry <= 1
                            ? 'Terms Expiring Soon'
                            : status.status === 'valid' 
                            ? 'Terms Accepted'
                            : status.status === 'expired'
                            ? 'Terms Expired'
                            : 'No Terms'}
                        </Badge>
                      );
                    })()
                  ) : (
                    // Fallback to legacy field
                    selectedGuest.guest.termsAcceptedAt ? (
                      <Badge variant="outline" className="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Terms Accepted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/30">
                        Terms Pending
                      </Badge>
                    )
                  )}
                  
                  {selectedGuest.summary.isBlacklisted && (
                    <Badge variant="outline" className="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/30">
                      <Ban className="h-3 w-3 mr-1" />
                      Blacklisted
                    </Badge>
                  )}
                  
                  {selectedGuest.summary.discountsEarned > 0 && (
                    <Badge variant="outline" className="text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/30">
                      <Gift className="h-3 w-3 mr-1" />
                      Discount Eligible
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Visit Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Visit Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-blue-50 dark:bg-blue-500/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedGuest.summary.totalVisits}
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">Total Visits</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 dark:bg-green-500/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {selectedGuest.summary.totalInvitations}
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-300">Invitations</div>
                  </div>
                  <div className="text-center p-2 bg-purple-50 dark:bg-purple-500/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {selectedGuest.summary.uniqueHosts.total}
                    </div>
                    <div className="text-xs text-purple-700 dark:text-purple-300">Unique Hosts</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 dark:bg-orange-500/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {selectedGuest.summary.discountsEarned}
                    </div>
                    <div className="text-xs text-orange-700 dark:text-orange-300">Discounts</div>
                  </div>
                </div>
                
                {/* Host Transfer Indicator */}
                {selectedGuest.summary.hostTransferCount > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-500/20 rounded-lg border border-blue-200 dark:border-blue-500/30">
                    <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm text-blue-800 dark:text-blue-300">
                      {selectedGuest.summary.hostTransferCount} host transfer{selectedGuest.summary.hostTransferCount > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Host Relationships */}
            <Card className="min-h-[120px]">
              <CardHeader>
                <CardTitle className="text-sm">Host Relationships</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedGuest.summary.mostFrequentHost && (
                  <div>
                    <span className="text-sm font-medium text-foreground">Most Frequent Visit Host</span>
                    <p className="text-xs text-muted-foreground break-words">
                      {selectedGuest.summary.mostFrequentHost.name} ({selectedGuest.summary.mostFrequentHost.count} visits)
                    </p>
                  </div>
                )}
                {selectedGuest.summary.mostFrequentInviter && (
                  <div>
                    <span className="text-sm font-medium text-foreground">Most Frequent Inviter</span>
                    <p className="text-xs text-muted-foreground break-words">
                      {selectedGuest.summary.mostFrequentInviter.name} ({selectedGuest.summary.mostFrequentInviter.count} invitations)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Timeline Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activity Timeline
                </CardTitle>
                <CardDescription>
                  Chronological history of all guest activities and interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
                  {selectedGuest.timeline.map((event, index) => (
                    <div key={index} className={`flex items-start gap-3 p-3 rounded-lg border ${getSeverityColor(event.severity)}`}>
                      <div className="p-2 rounded-full bg-white dark:bg-gray-800 border">
                        {getIconComponent(event.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{event.title}</h4>
                            {/* Override Badge */}
                            {(event.data as Record<string, unknown>)?.overrideReason && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                Override
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        
                        {/* Acceptance Expiration Info */}
                        {event.type === 'terms_acceptance' && (event.data as Record<string, unknown>)?.expiresAt && (
                          <div className="mt-1">
                            <span className={`text-xs ${
                              (event.data as Record<string, unknown>).isExpired 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-muted-foreground'
                            }`}>
                              {(event.data as Record<string, unknown>).isExpired 
                                ? '⚠️ This acceptance has expired'
                                : `Valid until ${new Date((event.data as Record<string, unknown>).expiresAt).toLocaleDateString()}`}
                            </span>
                          </div>
                        )}
                        
                        {/* Additional Host Context */}
                        {(event.data as Record<string, unknown>)?.invitationHost && (event.data as Record<string, unknown>)?.isHostMismatch && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs">
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Mail className="h-3 w-3" />
                              <span>Originally invited by: {(event.data as Record<string, unknown>).invitationHost.name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 mt-1">
                              <UserCheck className="h-3 w-3" />
                              <span>Visited: {(event.data as Record<string, unknown>).hostName}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}