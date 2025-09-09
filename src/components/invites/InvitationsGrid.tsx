'use client';

import { useState, useEffect } from 'react';
import { PageCard } from '@/components/ui/page-card';
import { Calendar, Clock, UserCheck, RotateCcw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { InvitationGridSkeleton } from '@/components/skeletons';
import { formatDateInLA, formatCountdown } from '@/lib/timezone';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface Guest {
  id: string;
  name?: string; // Now nullable since guest fills this later
  email: string;
  profileCompleted?: boolean;
  termsAcceptedAt?: string;
}

interface Invitation {
  id: string;
  status: 'PENDING' | 'ACTIVATED' | 'CHECKED_IN' | 'EXPIRED';
  inviteDate: string;
  qrToken?: string;
  qrIssuedAt?: string;
  qrExpiresAt?: string;
  guest: Guest;
  createdAt: string;
}

interface InvitationsGridProps {
  selectedDate: string;
  refreshTrigger?: number;
}

export function InvitationsGrid({ selectedDate, refreshTrigger }: InvitationsGridProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInvitations = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/invitations?date=${selectedDate}`, {
          headers: getAuthHeaders()
        });
        
        if (response.ok) {
          const data = await response.json();
          // Sort invitations with priority: Ready guests first, then by status
          const sortedInvitations = (data.invitations || []).sort((a: Invitation, b: Invitation) => {
            const aReady = a.guest.profileCompleted && a.guest.termsAcceptedAt && a.status !== 'EXPIRED';
            const bReady = b.guest.profileCompleted && b.guest.termsAcceptedAt && b.status !== 'EXPIRED';
            
            // Ready guests first
            if (aReady && !bReady) return -1;
            if (!aReady && bReady) return 1;
            
            // Then by status priority: CHECKED_IN, EXPIRED, others
            const statusPriority = { 'CHECKED_IN': 1, 'EXPIRED': 2, 'ACTIVATED': 3, 'PENDING': 3 };
            return (statusPriority[a.status] || 3) - (statusPriority[b.status] || 3);
          });
          
          setInvitations(sortedInvitations);
        }
      } catch (error) {
        console.error('Error loading invitations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInvitations();
  }, [selectedDate, refreshTrigger]);

  // Systematic status components
  const getPrimaryStatus = (invitation: Invitation) => {
    const hasProfileCompleted = invitation.guest.profileCompleted;
    const hasTerms = !!invitation.guest.termsAcceptedAt;
    
    if (invitation.status === 'CHECKED_IN') {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-success/20 to-success/10 text-success border border-success/30 shadow-sm shadow-success/10">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Checked In
          </span>
        ),
        action: null
      };
    }
    
    if (invitation.status === 'EXPIRED') {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-destructive/20 to-destructive/10 text-destructive border border-destructive/30 shadow-sm shadow-destructive/10">
            <XCircle className="h-4 w-4 mr-2" />
            Expired
          </span>
        ),
        action: (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-info/10 text-info border border-info/20 shadow-sm">
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Generate New QR
          </span>
        )
      };
    }

    // New status for pending profile completion
    if (!hasProfileCompleted) {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-warning/20 to-warning/10 text-warning border border-warning/30 shadow-sm shadow-warning/10">
            <AlertCircle className="h-4 w-4 mr-2" />
            Awaiting Profile
          </span>
        ),
        action: null
      };
    }
    
    if (hasTerms) {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-success/25 to-success/15 text-success border border-success/35 shadow-md shadow-success/15 animate-pulse">
            <UserCheck className="h-4 w-4 mr-2" />
            Ready for Check-in
          </span>
        ),
        action: (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20 shadow-sm">
            <UserCheck className="h-3 w-3 mr-1.5" />
            On Your QR Code
          </span>
        )
      };
    }
    
    return {
      badge: (
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-warning/20 to-warning/10 text-warning border border-warning/30 shadow-sm shadow-warning/10">
          <Clock className="h-4 w-4 mr-2" />
          Awaiting Terms
        </span>
      ),
      action: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
          <span>Email Sent</span>
        </span>
      )
    };
  };

  return (
    <PageCard
      title="Today's Invitations"
      description={formatDateInLA(new Date(selectedDate))}
      icon={Calendar}
    >
      {isLoading ? (
        <InvitationGridSkeleton count={6} />
      ) : invitations.length === 0 ? (
        <div className="text-center py-12">
          <div className="relative inline-flex">
            <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full blur-xl opacity-50" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-muted to-muted-foreground/20 rounded-full flex items-center justify-center shadow-inner">
              <Calendar className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <p className="text-lg font-semibold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mt-4 mb-2">No invitations for this date</p>
          <p className="text-muted-foreground">Create your first invitation above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {invitations.map((invitation) => {
            const isReady = invitation.guest.profileCompleted && invitation.guest.termsAcceptedAt && invitation.status !== 'EXPIRED';
            const isCheckedIn = invitation.status === 'CHECKED_IN';
            
            return (
              <div 
                key={invitation.id} 
                className={`
                  relative border rounded-xl transition-all duration-300 p-4 group
                  ${isReady && !isCheckedIn
                    ? 'bg-gradient-to-br from-success/15 to-success/5 border-success/35 shadow-lg shadow-success/15 hover:shadow-xl hover:shadow-success/20 hover:scale-[1.03] ring-2 ring-success/25'
                    : isCheckedIn
                    ? 'bg-gradient-to-br from-surface-1/50 to-surface-2/30 border-border/30 hover:shadow-lg hover:scale-[1.02] opacity-90'
                    : 'bg-gradient-to-br from-card to-surface-1/50 border-border/50 hover:border-primary/20 hover:shadow-lg hover:scale-[1.02]'
                  }
                `}
              >
                {isReady && !isCheckedIn && (
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-success/30 to-success/10 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
                )}
                <div className="relative mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {invitation.guest.name || 'Pending Registration'}
                    </h3>
                    {isReady && !isCheckedIn && (
                      <div className="w-2.5 h-2.5 bg-success rounded-full animate-pulse flex-shrink-0 shadow-sm shadow-success"></div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 truncate">{invitation.guest.email}</p>
                  
                  <div className="space-y-2">
                    {getPrimaryStatus(invitation).badge}
                    {getPrimaryStatus(invitation).action && (
                      <div>{getPrimaryStatus(invitation).action}</div>
                    )}
                  </div>
                </div>
                
                {invitation.qrExpiresAt && invitation.status === 'ACTIVATED' && (
                  <div className="text-xs text-muted-foreground border-t border-border/30 pt-2 mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Expires {formatCountdown(new Date(invitation.qrExpiresAt))}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageCard>
  );
}