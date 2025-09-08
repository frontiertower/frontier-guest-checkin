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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20 dark:border-green-500/30">
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
            Checked In
          </span>
        ),
        action: null
      };
    }
    
    if (invitation.status === 'EXPIRED') {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/20 dark:border-red-500/30">
            <XCircle className="h-4 w-4 mr-2 text-red-600 dark:text-red-400" />
            Expired
          </span>
        ),
        action: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30">
            <RotateCcw className="h-3 w-3 mr-2" />
            Generate New QR
          </span>
        )
      };
    }

    // New status for pending profile completion
    if (!hasProfileCompleted) {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30">
            <AlertCircle className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
            Awaiting Profile
          </span>
        ),
        action: null
      };
    }
    
    if (hasTerms) {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-500/15 dark:bg-green-500/25 text-green-700 dark:text-green-400 border border-green-500/25 dark:border-green-500/35 shadow-sm">
            <UserCheck className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
            Ready for Check-in
          </span>
        ),
        action: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20 dark:border-green-500/30">
            <UserCheck className="h-3 w-3 mr-2" />
            On Your QR Code
          </span>
        )
      };
    }
    
    return {
      badge: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30">
          <Clock className="h-4 w-4 mr-2 text-amber-600 dark:text-amber-400" />
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
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground mb-2">No invitations for this date</p>
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
                  bg-card border rounded-lg shadow-sm transition-all p-3
                  ${isReady && !isCheckedIn
                    ? 'border-green-500/30 shadow-green-500/10 shadow-lg hover:shadow-green-500/20 hover:scale-[1.03] ring-1 ring-green-500/20'
                    : 'border-border hover:shadow-md hover:scale-[1.02]'
                  }
                `}
              >
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {invitation.guest.name || 'Pending Registration'}
                    </h3>
                    {isReady && !isCheckedIn && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 truncate">{invitation.guest.email}</p>
                  
                  <div className="space-y-2">
                    {getPrimaryStatus(invitation).badge}
                    {getPrimaryStatus(invitation).action && (
                      <div>{getPrimaryStatus(invitation).action}</div>
                    )}
                  </div>
                </div>
                
                {invitation.qrExpiresAt && invitation.status === 'ACTIVATED' && (
                  <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                    Expires {formatCountdown(new Date(invitation.qrExpiresAt))}
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