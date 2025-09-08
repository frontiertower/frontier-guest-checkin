'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCountdown, TIMEZONE_DISPLAY } from '@/lib/timezone';
import { QRCodeComponent } from '@/components/ui/qrcode';
import { generateMultiGuestQR } from '@/lib/qr-token';
import { QrCode, Copy, RotateCcw, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { PageCard } from '@/components/ui/page-card';
import { UserHeaderSkeleton, HostQRSkeleton } from '@/components/skeletons';
import { CreateInvitationForm } from '@/components/invites/CreateInvitationForm';
import { InvitationsGrid } from '@/components/invites/InvitationsGrid';
import { GuestHistorySection } from '@/components/invites/GuestHistorySection';

// Helper function to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface Guest {
  id: string;
  name: string;
  email: string;
  country?: string;
  contactMethod?: 'TELEGRAM' | 'PHONE';
  contactValue?: string;
}

interface Invitation {
  id: string;
  status: 'PENDING' | 'ACTIVATED' | 'CHECKED_IN' | 'EXPIRED';
  inviteDate: string;
  qrToken?: string;
  qrIssuedAt?: string;
  qrExpiresAt?: string;
  guest: Guest & {
    termsAcceptedAt?: string;
  };
  createdAt: string;
}


interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function InvitesPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activeGuestCount, setActiveGuestCount] = useState(0);
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Granular loading states
  const [loadingStates, setLoadingStates] = useState({
    user: true,
    hostQR: true
  });
  const { toast } = useToast();



  // QR Modal state
  const [qrModalData, setQrModalData] = useState<{
    isOpen: boolean;
    invitation?: Invitation;
    hostQR?: string;
    countdown?: string;
  }>({ isOpen: false });

  // Host QR state
  const [hostQRData, setHostQRData] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      // Load current user if not already loaded
      if (!currentUser) {
        setLoadingStates(prev => ({ ...prev, user: true }));
        // Try to load from localStorage first
        const storedUser = localStorage.getItem('current-user');
        if (storedUser) {
          try {
            setCurrentUser(JSON.parse(storedUser));
            setLoadingStates(prev => ({ ...prev, user: false }));
          } catch {
            // If parsing fails, fetch from API
            const userRes = await fetch('/api/auth/me', {
              headers: getAuthHeaders()
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              setCurrentUser(userData.user);
            }
            setLoadingStates(prev => ({ ...prev, user: false }));
          }
        } else {
          // No stored user, fetch from API
          const userRes = await fetch('/api/auth/me', {
            headers: getAuthHeaders()
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setCurrentUser(userData.user);
          }
          setLoadingStates(prev => ({ ...prev, user: false }));
        }
      }
      
      // Load today's invitations for host QR
      setLoadingStates(prev => ({ ...prev, hostQR: true }));
      const invitesRes = await fetch(`/api/invitations?date=${selectedDate}`, {
        headers: getAuthHeaders()
      });
      const invitesData = await invitesRes.json();
      
      if (invitesRes.ok) {
        setInvitations(invitesData.invitations || []);
        
        // Calculate active guest count
        const activeCount = invitesData.invitations?.filter((inv: Invitation) => 
          inv.status === 'CHECKED_IN' && 
          inv.qrExpiresAt && 
          new Date(inv.qrExpiresAt) > new Date()
        ).length || 0;
        setActiveGuestCount(activeCount);
        
        // Generate host QR data for guests who accepted terms
        const acceptedGuests = invitesData.invitations?.filter((inv: Invitation) => 
          inv.guest.termsAcceptedAt && inv.status !== 'EXPIRED'
        ) || [];
        
        if (acceptedGuests.length > 0) {
          const qrData = generateMultiGuestQR(
            acceptedGuests.map((inv: Invitation) => ({
              email: inv.guest.email,
              name: inv.guest.name
            }))
          );
          setHostQRData(qrData);
        } else {
          setHostQRData(null);
        }
        setLoadingStates(prev => ({ ...prev, hostQR: false }));
      } else {
        setLoadingStates(prev => ({ ...prev, hostQR: false }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Error loading data', description: 'Please try again.' });
      // Set all loading states to false on error
      setLoadingStates({
        user: false,
        hostQR: false
      });
    }
  }, [selectedDate, currentUser, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update countdown for QR modal
  useEffect(() => {
    if (!qrModalData.isOpen || !qrModalData.invitation?.qrExpiresAt) return;

    const interval = setInterval(() => {
      const countdown = formatCountdown(new Date(qrModalData.invitation!.qrExpiresAt!));
      setQrModalData(prev => ({ ...prev, countdown }));
      
      if (countdown === '00:00') {
        clearInterval(interval);
        setQrModalData(prev => ({ ...prev, countdown: 'EXPIRED' }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [qrModalData.isOpen, qrModalData.invitation]);

  const handleInvitationCreated = () => {
    // Trigger refresh of invitations and host QR
    setRefreshTrigger(prev => prev + 1);
    loadData();
  };




  const copyQRToken = () => {
    if (qrModalData.invitation?.qrToken) {
      navigator.clipboard.writeText(qrModalData.invitation.qrToken);
      toast({ title: 'Copied', description: 'QR code token copied to clipboard!' });
    }
  };

  const regenerateQR = async () => {
    // Not used with multi-guest QR system
    toast({ title: 'Info', description: 'QR regeneration not available' });
  };



  // No longer show full-page skeleton - render layout immediately with selective skeletons

  return (
    <div className="min-h-screen bg-muted">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header - show skeleton while loading user data */}
        {loadingStates.user ? (
          <UserHeaderSkeleton />
        ) : (
          <PageHeader
            title="Frontier Tower"
            subtitle={`Welcome, ${currentUser?.name || 'Host'}`}
            actions={
              <>
                <div className="bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Active Guests: {activeGuestCount}/3</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Times shown in {TIMEZONE_DISPLAY}
                </p>
              </>
            }
          />
        )}

        {/* Host QR Code Section - Always show at top when guests are ready, show skeleton while loading */}
        {loadingStates.hostQR ? (
          <HostQRSkeleton />
        ) : (
          hostQRData && (
            <div className="animate-pulse-border">
              <PageCard
                title="Your Check-in QR Code"
                description={`${invitations.filter(inv => inv.guest.termsAcceptedAt && inv.status !== 'EXPIRED').length} guest(s) ready to check in!`}
                icon={QrCode}
                gradient={true}
              >
                <div className="space-y-6">
                  {/* Ready guests list with better hierarchy */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">
                        Ready for check-in:
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {invitations.filter(inv => inv.guest.termsAcceptedAt && inv.status !== 'EXPIRED').map(inv => (
                        <div key={inv.id} className="bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30 rounded-lg px-4 py-3">
                          <div className="text-base font-semibold text-green-800 dark:text-green-300">
                            {inv.guest.name || 'Guest'}
                          </div>
                          <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                            {inv.guest.email}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Engaging CTA button */}
                  <div className="space-y-2">
                    <button
                      onClick={() => setQrModalData({ 
                        isOpen: true, 
                        hostQR: hostQRData
                      })}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-green-500/50 cursor-pointer"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <QrCode className="h-6 w-6" />
                        <div className="text-center">
                          <div className="text-lg font-bold">Show QR Code</div>
                          <div className="text-sm opacity-90">Check in your guests</div>
                        </div>
                      </div>
                    </button>
                    <p className="text-xs text-center text-muted-foreground">
                      Present this QR code at the kiosk to check in all ready guests
                    </p>
                  </div>
                </div>
              </PageCard>
            </div>
          )
        )}

        {/* Create Invitation Form - Comes after QR code if it exists */}
        <CreateInvitationForm onInvitationCreated={handleInvitationCreated} />

        {/* Today's Invitations - Independent component with own loading */}
        <InvitationsGrid selectedDate={selectedDate} refreshTrigger={refreshTrigger} />

        {/* Guest History - Independent component with own loading */}
        <GuestHistorySection />

        {/* QR Code Modal */}
        <Dialog 
          open={qrModalData.isOpen} 
          onOpenChange={(open) => setQrModalData({ isOpen: open })}
        >
          <DialogContent className="sm:max-w-md bg-card border border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {qrModalData.hostQR ? 'Your Check-in QR Code' : `QR Code - ${qrModalData.invitation?.guest.name}`}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {qrModalData.hostQR 
                  ? 'Show this QR code at the kiosk to check in your guests' 
                  : 'Show this QR code to the guest for check-in'}
              </DialogDescription>
            </DialogHeader>
            
            {(qrModalData.invitation || qrModalData.hostQR) && (
              <div className="space-y-4">
                <div className="p-8 bg-card border border-border rounded-lg">
                  <div className="text-center flex flex-col items-center justify-center">
                    {(qrModalData.hostQR || qrModalData.invitation?.qrToken) ? (
                      <QRCodeComponent 
                        value={qrModalData.hostQR || qrModalData.invitation?.qrToken || ''}
                        size={256}
                        className="mb-4"
                        onError={(error) => {
                          console.error('QR Code generation failed:', error);
                          toast({ 
                            title: 'QR Code Error', 
                            description: 'Failed to generate QR code. Please try regenerating.' 
                          });
                        }}
                      />
                    ) : (
                      <div className="text-center">
                        <div className="text-6xl mb-4">❌</div>
                        <p className="text-sm text-foreground">No QR data available</p>
                      </div>
                    )}
                    {!qrModalData.hostQR && (
                      <div className="mt-4 p-3 bg-muted border border-border rounded-lg">
                        <p className="text-xs font-mono text-muted-foreground break-all leading-relaxed">
                          {qrModalData.invitation?.qrToken || 'No token available'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {!qrModalData.hostQR && qrModalData.countdown && (
                  qrModalData.countdown === 'EXPIRED' ? (
                    <div className="bg-red-500/10 dark:bg-red-500/20 border border-red-500/20 dark:border-red-500/30 rounded-lg p-4">
                      <div className="text-center">
                        <p className="text-sm text-red-700 dark:text-red-400 mb-1">Time remaining:</p>
                        <p className="text-2xl font-mono font-semibold text-red-600 dark:text-red-400">
                          EXPIRED
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30 rounded-lg p-4">
                      <div className="text-center">
                        <p className="text-sm text-green-700 dark:text-green-400 mb-1">Time remaining:</p>
                        <p className="text-2xl font-mono font-semibold text-green-700 dark:text-green-400">
                          {qrModalData.countdown || '00:00'}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
            
            <DialogFooter className="flex gap-3 pt-2">
              {!qrModalData.hostQR && (
                <>
                  <Button 
                    onClick={copyQRToken}
                    variant="secondary"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Token
                  </Button>
                  <Button 
                    onClick={regenerateQR}
                    variant="default"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Regenerate
                  </Button>
                </>
              )}
              {qrModalData.hostQR && (
                <Button 
                  onClick={() => setQrModalData({ isOpen: false })}
                  variant="default"
                >
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}