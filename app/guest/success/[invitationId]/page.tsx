'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { PageCard } from '@/components/ui/page-card';
import { CheckCircle, Clock, Mail } from 'lucide-react';

interface InvitationData {
  id: string;
  inviteDate: string;
  guest: {
    name?: string;
    email: string;
  };
  host: {
    name: string;
    email: string;
  };
}

export default function GuestSuccessPage() {
  const params = useParams();
  const invitationId = params.invitationId as string;
  const [invitation, setInvitation] = useState<InvitationData | null>(null);

  useEffect(() => {
    fetchInvitation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationId]);

  const fetchInvitation = async () => {
    try {
      const response = await fetch(`/api/guest/invitation/${invitationId}`);
      const data = await response.json();
      if (response.ok) {
        setInvitation(data.invitation);
      }
    } catch (error) {
      console.error('Error fetching invitation:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-0 to-background relative overflow-hidden">
      {/* Subtle animated gradient orbs with success theme */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-success/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-48 w-96 h-96 bg-success/3 rounded-full blur-3xl animate-pulse delay-300" />
        <div className="absolute -bottom-48 right-1/3 w-96 h-96 bg-success/5 rounded-full blur-3xl animate-pulse delay-700" />
      </div>
      
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-border/30 shadow-sm relative z-10">
        <div className="container mx-auto px-4 py-6">
          <PageHeader 
            title="Registration Complete!"
            subtitle="You're all set for your visit to Frontier Tower"
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl relative z-10">
        <div className="mb-6 relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-success/20 to-success/10 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity" />
          <div className="relative p-6 bg-gradient-to-r from-success/15 to-success/5 border border-success/30 rounded-xl shadow-lg backdrop-blur-sm">
            <div className="flex items-start space-x-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-success/20 rounded-full blur" />
                <div className="relative p-2 rounded-full bg-success/20">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-success mb-2">
                  Successfully Registered!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your profile has been completed and terms have been accepted. 
                  Your host has been notified and will generate your QR code for check-in.
                </p>
              </div>
            </div>
          </div>
        </div>

        {invitation && (
          <PageCard
            title="Visit Details"
            description="Information about your upcoming visit"
            icon={Clock}
            className="shadow-xl border-border/30 hover:border-success/20 transition-all duration-300"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-0/30 rounded-xl border border-border/20">
                <div className="p-3 hover:bg-surface-1/30 rounded-lg transition-colors">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="opacity-70">👤</span> Your Name
                  </p>
                  <p className="font-semibold text-foreground">{invitation.guest.name || 'Guest'}</p>
                </div>
                
                <div className="p-3 hover:bg-surface-1/30 rounded-lg transition-colors">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="opacity-70">✉️</span> Your Email
                  </p>
                  <p className="font-semibold text-foreground">{invitation.guest.email}</p>
                </div>
                
                <div className="p-3 hover:bg-surface-1/30 rounded-lg transition-colors">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="opacity-70">🏢</span> Host
                  </p>
                  <p className="font-semibold text-foreground">{invitation.host.name}</p>
                </div>
                
                <div className="p-3 hover:bg-surface-1/30 rounded-lg transition-colors">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="opacity-70">📅</span> Visit Date
                  </p>
                  <p className="font-semibold text-foreground">{formatDate(invitation.inviteDate)}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/30">
                <h4 className="font-semibold text-base mb-4 flex items-center gap-2 text-foreground">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  Next Steps
                </h4>
                <ol className="space-y-3">
                  <li className="flex items-start gap-3 group">
                    <span className="flex-shrink-0 w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary group-hover:bg-primary/20 transition-colors">1</span>
                    <span className="text-sm text-muted-foreground">Your host will receive a notification about your registration</span>
                  </li>
                  <li className="flex items-start gap-3 group">
                    <span className="flex-shrink-0 w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary group-hover:bg-primary/20 transition-colors">2</span>
                    <span className="text-sm text-muted-foreground">They will generate your QR code for entry</span>
                  </li>
                  <li className="flex items-start gap-3 group">
                    <span className="flex-shrink-0 w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary group-hover:bg-primary/20 transition-colors">3</span>
                    <span className="text-sm text-muted-foreground">You'll receive the QR code via email before your visit</span>
                  </li>
                  <li className="flex items-start gap-3 group">
                    <span className="flex-shrink-0 w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary group-hover:bg-primary/20 transition-colors">4</span>
                    <span className="text-sm text-muted-foreground">Present the QR code at the Frontier Tower check-in kiosk</span>
                  </li>
                </ol>
              </div>

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-warning/10 to-transparent rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative p-5 bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/20 rounded-xl shadow-sm backdrop-blur-sm">
                  <p className="text-sm flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">⚠️</span>
                    <span>
                      <strong className="text-warning">Important:</strong>
                      <span className="text-muted-foreground"> Please check your email for the QR code before arriving at Frontier Tower. 
                      If you don't receive it by the morning of your visit, please contact your host at{' '}
                      <a href={`mailto:${invitation.host.email}`} className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2 transition-colors">
                        {invitation.host.email}
                      </a>
                      </span>
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </PageCard>
        )}

        <div className="mt-8 text-center p-6 bg-surface-0/30 rounded-xl border border-border/20">
          <div className="text-3xl mb-3">🎉</div>
          <p className="text-base font-medium text-foreground mb-2">
            You're All Set!
          </p>
          <p className="text-sm text-muted-foreground">
            You can close this window now. We look forward to your visit!
          </p>
        </div>
      </div>
    </div>
  );
}