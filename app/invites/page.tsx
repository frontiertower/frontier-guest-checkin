'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDateInLA, formatCountdown, TIMEZONE_DISPLAY } from '@/lib/timezone';
import { QRCodeComponent } from '@/components/ui/qrcode';
import { generateMultiGuestQR } from '@/lib/qr-token';
import { QrCode, Copy, RotateCcw, UserCheck, Clock, Users, Calendar } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { PageHeader } from '@/components/ui/page-header';
import { PageCard } from '@/components/ui/page-card';
import { SearchInput } from '@/components/ui/search-input';
import { DataTable, type Column } from '@/components/ui/data-table';

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

interface GuestHistoryItem {
  id: string;
  name: string;
  email: string;
  recentVisits: number;
  lifetimeVisits: number;
  lastVisitDate?: string;
  hasDiscount: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function InvitesPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [guestHistory, setGuestHistory] = useState<GuestHistoryItem[]>([]);
  const [activeGuestCount, setActiveGuestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  // Guest history table columns
  const guestHistoryColumns: Column<GuestHistoryItem>[] = [
    {
      key: 'name',
      label: 'Guest',
      className: 'font-medium'
    },
    {
      key: 'email',
      label: 'Email'
    },
    {
      key: 'recentVisits',
      label: 'Visits (30d)'
    },
    {
      key: 'lifetimeVisits',
      label: 'Lifetime Visits'
    },
    {
      key: 'lastVisitDate',
      label: 'Last Visit',
      render: (value) => value ? formatDateInLA(new Date(value)) : 'Never'
    },
    {
      key: 'hasDiscount',
      label: 'Discount Sent?',
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-gray-100 text-gray-800 border border-gray-200'
        }`}>
          {value ? 'Yes' : 'No'}
        </span>
      )
    }
  ];

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    country: '',
    contactMethod: 'TELEGRAM' as 'TELEGRAM' | 'PHONE',
    contactValue: '',
    inviteDate: new Date().toISOString().split('T')[0],
  });

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
      setIsLoading(true);
      
      // Load current user if not already loaded
      if (!currentUser) {
        // Try to load from localStorage first
        const storedUser = localStorage.getItem('current-user');
        if (storedUser) {
          try {
            setCurrentUser(JSON.parse(storedUser));
          } catch {
            // If parsing fails, fetch from API
            const userRes = await fetch('/api/auth/me', {
              headers: getAuthHeaders()
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              setCurrentUser(userData.user);
            }
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
        }
      }
      
      // Load today's invitations
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
      }
      
      // Load guest history
      const historyRes = await fetch(`/api/guests/history?query=${searchTerm}`, {
        headers: getAuthHeaders()
      });
      const historyData = await historyRes.json();
      
      if (historyRes.ok) {
        setGuestHistory(historyData.guests || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Error loading data', description: 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, searchTerm, currentUser, toast]);

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

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          ...formData,
          termsAccepted: true, // Host acknowledges they will send terms to guest
          visitorAgreementAccepted: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({ 
          title: 'Invitation Sent!', 
          description: 'Guest will receive an email to accept terms before QR generation.' 
        });
        setFormData({
          name: '',
          email: '',
          country: '',
          contactMethod: 'TELEGRAM',
          contactValue: '',
          inviteDate: new Date().toISOString().split('T')[0],
        });
        loadData();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to create invitation' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.' });
    }
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

  // Systematic status components - single source of truth
  const getPrimaryStatus = (invitation: Invitation) => {
    const hasTerms = !!invitation.guest.termsAcceptedAt;
    
    if (invitation.status === 'CHECKED_IN') {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Checked In
          </span>
        ),
        action: null
      };
    }
    
    if (invitation.status === 'EXPIRED') {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            Expired
          </span>
        ),
        action: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <RotateCcw className="h-3 w-3 mr-2" />
            Generate New QR
          </span>
        )
      };
    }
    
    if (hasTerms) {
      return {
        badge: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            Ready
          </span>
        ),
        action: (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <UserCheck className="h-3 w-3 mr-2" />
            On Your QR
          </span>
        )
      };
    }
    
    return {
      badge: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="h-3 w-3 mr-2" />
          Awaiting Terms
        </span>
      ),
      action: (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
          <span>Email Sent</span>
        </span>
      )
    };
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <PageHeader
          title="Frontier Tower"
          subtitle={`Welcome, ${currentUser?.name || 'Host'}`}
          actions={
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Active Guests: {activeGuestCount}/3</span>
              </div>
              <p className="text-xs text-gray-700">
                Times shown in {TIMEZONE_DISPLAY}
              </p>
            </>
          }
        />

        {/* Host QR Code Section */}
        {hostQRData && (
          <PageCard
            title="Your Check-in QR Code"
            description={`${invitations.filter(inv => inv.guest.termsAcceptedAt && inv.status !== 'EXPIRED').length} guest(s) available for check-in`}
            icon={QrCode}
            gradient={true}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                <p className="mb-2">This QR code contains all guests who have accepted the terms.</p>
                <p className="text-xs text-gray-600">Show this at the kiosk to check in your guests.</p>
              </div>
              <Button
                onClick={() => setQrModalData({ 
                  isOpen: true, 
                  hostQR: hostQRData
                })}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Show QR Code
              </Button>
            </div>
          </PageCard>
        )}

        {/* Create Invitation Form */}
        <PageCard
          title="Create Invitation"
          description="Send an invitation email to a guest. They must accept terms via email before QR activation."
          icon={UserCheck}
        >
            <form onSubmit={handleCreateInvitation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm font-medium text-gray-700">Country *</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Contact Method *</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={formData.contactMethod}
                      onValueChange={(value: 'TELEGRAM' | 'PHONE') => 
                        setFormData({ ...formData, contactMethod: value })
                      }
                    >
                      <SelectTrigger className="w-32 border border-gray-300 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TELEGRAM">Telegram</SelectItem>
                        <SelectItem value="PHONE">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={formData.contactMethod === 'TELEGRAM' ? '@username' : '+1234567890'}
                      value={formData.contactValue}
                      onChange={(e) => setFormData({ ...formData, contactValue: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inviteDate" className="text-sm font-medium text-gray-700">Invite Date</Label>
                  <Input
                    id="inviteDate"
                    type="date"
                    value={formData.inviteDate}
                    onChange={(e) => setFormData({ ...formData, inviteDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>📧 Email Workflow:</strong> After creating the invitation, your guest will receive 
                    an email to accept the Terms & Conditions and Visitor Agreement before you can generate their QR code.
                  </p>
                </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium text-sm transition-colors">
                Create Invitation
              </Button>
            </form>
        </PageCard>

        {/* Today's Invitations */}
        <PageCard
          title="Today's Invitations"
          description={formatDateInLA(new Date(selectedDate))}
          icon={Calendar}
          headerClassName="flex items-center justify-between"
        >
          <div className="absolute top-4 right-6">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>
            {invitations.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-gray-500" />
                </div>
                <p className="text-lg font-medium text-gray-800 mb-2">No invitations for this date</p>
                <p className="text-gray-600">Create your first invitation above to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {invitations.map((invitation) => (
                  <Card key={invitation.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
                    <div className="p-3">
                      {/* Compact Guest Header */}
                      <div className="mb-2">
                        <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">{invitation.guest.name}</h3>
                        <p className="text-xs text-gray-600 mb-2 truncate">{invitation.guest.email}</p>
                        
                        {/* Status & Action in Stack */}
                        <div className="space-y-2">
                          {getPrimaryStatus(invitation).badge}
                          {getPrimaryStatus(invitation).action && (
                            <div>{getPrimaryStatus(invitation).action}</div>
                          )}
                        </div>
                      </div>
                      
                      {/* Compact Expiry Info */}
                      {invitation.qrExpiresAt && invitation.status === 'ACTIVATED' && (
                        <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                          Expires {formatCountdown(new Date(invitation.qrExpiresAt))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </PageCard>

        {/* Guest History */}
        <PageCard
          title="Guest History"
          description="Search and view guest visit statistics"
        >
          <div className="space-y-4">
            <SearchInput
              placeholder="Search guests by name or email..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
            <DataTable
              data={guestHistory}
              columns={guestHistoryColumns}
              emptyMessage={searchTerm ? 'No guests found matching your search.' : 'No guest history available.'}
            />
          </div>
        </PageCard>

        {/* QR Code Modal */}
        <Dialog 
          open={qrModalData.isOpen} 
          onOpenChange={(open) => setQrModalData({ isOpen: open })}
        >
          <DialogContent className="sm:max-w-md bg-white border-gray-300">
            <DialogHeader>
              <DialogTitle className="text-gray-800">
                {qrModalData.hostQR ? 'Your Check-in QR Code' : `QR Code - ${qrModalData.invitation?.guest.name}`}
              </DialogTitle>
              <DialogDescription className="text-gray-700">
                {qrModalData.hostQR 
                  ? 'Show this QR code at the kiosk to check in your guests' 
                  : 'Show this QR code to the guest for check-in'}
              </DialogDescription>
            </DialogHeader>
            
            {(qrModalData.invitation || qrModalData.hostQR) && (
              <div className="space-y-4">
                <Card className="p-8">
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
                        <p className="text-sm text-gray-800">No QR data available</p>
                      </div>
                    )}
                    {!qrModalData.hostQR && (
                      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-xs font-mono text-gray-700 break-all leading-relaxed">
                          {qrModalData.invitation?.qrToken || 'No token available'}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
                
                {!qrModalData.hostQR && qrModalData.countdown && (
                  qrModalData.countdown === 'EXPIRED' ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-center">
                        <p className="text-sm text-red-800 mb-1">Time remaining:</p>
                        <p className="text-2xl font-mono font-semibold text-red-600">
                          EXPIRED
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-center">
                        <p className="text-sm text-green-800 mb-1">Time remaining:</p>
                        <p className="text-2xl font-mono font-semibold text-green-800">
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