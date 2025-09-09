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
    <div className="min-h-screen bg-background relative">
      {/* Subtle background gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-20 pointer-events-none" />
      
      <div className="container mx-auto px-4 py-8 space-y-8 relative">
        {/* Header - show skeleton while loading user data */}
        {loadingStates.user ? (
          <UserHeaderSkeleton />
        ) : (
          <PageHeader
            title="Frontier Tower"
            subtitle={`Welcome, ${currentUser?.name || 'Host'}`}
            actions={
              <>
                <div className="relative">
                  <div className="bg-gradient-to-r from-info/10 to-info/5 border border-info/20 rounded-lg px-4 py-2 shadow-sm shadow-info/10">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-info/20 backdrop-blur-sm">
                        <Users className="h-4 w-4 text-info" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-info">Active Guests: {activeGuestCount}/3</span>
                        {/* Visual capacity meter */}
                        <div className="mt-1 h-1.5 bg-surface-3/50 rounded-full overflow-hidden w-24">
                          <div 
                            className={`h-full transition-all duration-500 rounded-full ${
                              activeGuestCount === 0 ? 'bg-muted-foreground/30' :
                              activeGuestCount < 3 ? 'bg-gradient-to-r from-info to-info/60' :
                              'bg-gradient-to-r from-warning to-warning/60'
                            }`}
                            style={{ width: `${Math.min((activeGuestCount / 3) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
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
            <div className="relative">
              {/* Glow effect for hero card */}
              <div className="absolute -inset-1 bg-gradient-to-r from-success/20 to-success/10 rounded-xl blur-xl opacity-50" />
              <PageCard
                title="Your Check-in QR Code"
                description={`${invitations.filter(inv => inv.guest.termsAcceptedAt && inv.status !== 'EXPIRED').length} guest(s) ready to check in!`}
                icon={QrCode}
                gradient={true}
                className="relative border-success/30 shadow-xl shadow-success/10 bg-gradient-to-br from-success/10 to-card"
              >
                <div className="space-y-6">
                  {/* Ready guests list with enhanced visual hierarchy */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/20 border border-success/30">
                        <span className="w-2 h-2 bg-success rounded-full animate-pulse shadow-sm shadow-success"></span>
                        <span className="text-sm font-semibold text-success">
                          Ready for check-in:
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {invitations.filter(inv => inv.guest.termsAcceptedAt && inv.status !== 'EXPIRED').map((inv, index) => (
                        <div key={inv.id} className="group relative">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-success/30 to-success/10 rounded-xl blur opacity-60 group-hover:opacity-100 transition-opacity" />
                          <div className="relative bg-gradient-to-r from-success/15 to-success/10 border border-success/30 rounded-xl px-4 py-3 hover:shadow-lg hover:shadow-success/10 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-success/30 to-success/20 rounded-full flex items-center justify-center shadow-md shadow-success/20">
                                <span className="text-success font-bold text-sm">
                                  {inv.guest.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'G'}
                                </span>
                              </div>
                              <div>
                                <div className="text-base font-semibold text-foreground">
                                  {inv.guest.name || 'Guest'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {inv.guest.email}
                                </div>
                              </div>
                              <div className="ml-auto">
                                <span className="text-xs text-success font-medium">✓ Ready</span>
                              </div>
                            </div>
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
                      className="w-full bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 text-success-foreground font-semibold py-5 px-6 rounded-xl shadow-lg hover:shadow-xl hover:shadow-success/20 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-success/30 cursor-pointer group"
                    >
                      <div className="flex items-center justify-center gap-4">
                        <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                          <QrCode className="h-7 w-7" />
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold tracking-tight">Show QR Code</div>
                          <div className="text-sm opacity-90 mt-0.5">Check in your guests at the kiosk</div>
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

        {/* Enhanced QR Code Modal */}
        <Dialog 
          open={qrModalData.isOpen} 
          onOpenChange={(open) => setQrModalData({ isOpen: open })}
        >
          <DialogContent className="sm:max-w-md bg-gradient-to-br from-card to-surface-1/50 border-2 border-border/50 shadow-2xl backdrop-blur-xl">
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
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl blur-xl opacity-30" />
                  <div className="relative p-8 bg-gradient-to-br from-surface-1/50 to-surface-2/30 border border-primary/20 rounded-xl shadow-inner">
                    <div className="text-center flex flex-col items-center justify-center">
                      {(qrModalData.hostQR || qrModalData.invitation?.qrToken) ? (
                        <div className="relative">
                          <div className="absolute -inset-2 bg-gradient-to-r from-primary/30 to-success/30 rounded-lg blur-md opacity-50" />
                          <QRCodeComponent 
                            value={qrModalData.hostQR || qrModalData.invitation?.qrToken || ''}
                            size={256}
                            className="relative mb-4 rounded-lg shadow-xl"
                            onError={(error) => {
                              console.error('QR Code generation failed:', error);
                              toast({ 
                                title: 'QR Code Error', 
                                description: 'Failed to generate QR code. Please try regenerating.' 
                              });
                            }}
                          />
                        </div>
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
                </div>
                
                {!qrModalData.hostQR && qrModalData.countdown && (
                  qrModalData.countdown === 'EXPIRED' ? (
                    <div className="bg-gradient-to-r from-destructive/20 to-destructive/10 border border-destructive/30 rounded-lg p-4 shadow-sm shadow-destructive/10">
                      <div className="text-center">
                        <p className="text-sm text-destructive font-medium mb-1">Time remaining:</p>
                        <p className="text-2xl font-mono font-bold text-destructive flex items-center justify-center gap-2">
                          <span className="text-xl">⏱️</span>
                          EXPIRED
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-success/20 to-success/10 border border-success/30 rounded-lg p-4 shadow-sm shadow-success/10">
                      <div className="text-center">
                        <p className="text-sm text-success font-medium mb-1">Time remaining:</p>
                        <p className="text-2xl font-mono font-bold text-success flex items-center justify-center gap-2">
                          <span className="text-xl animate-pulse">⏱️</span>
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
                    className="cursor-pointer"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Token
                  </Button>
                  <Button 
                    onClick={regenerateQR}
                    variant="default"
                    className="cursor-pointer"
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
                  className="cursor-pointer"
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