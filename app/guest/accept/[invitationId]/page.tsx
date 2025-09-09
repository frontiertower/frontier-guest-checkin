'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PageCard } from '@/components/ui/page-card';
import { PageHeader } from '@/components/ui/page-header';
import { FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InvitationData {
  id: string;
  guest: {
    email: string;
    name?: string;
    profileCompleted: boolean;
    termsAcceptedAt?: string;
  };
  host: {
    name: string;
  };
}

export default function GuestAcceptancePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const invitationId = params.invitationId as string;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [visitorAgreementAccepted, setVisitorAgreementAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInvitation();
  }, [invitationId]);

  const fetchInvitation = async () => {
    try {
      const response = await fetch(`/api/guest/invitation/${invitationId}`);
      const data = await response.json();

      if (response.ok) {
        setInvitation(data.invitation);
        
        // Check if profile is completed
        if (!data.invitation.guest.profileCompleted) {
          router.push(`/guest/register/${invitationId}`);
          return;
        }

        // Check if already accepted terms
        if (data.invitation.guest.termsAcceptedAt) {
          router.push(`/guest/success/${invitationId}`);
        }
      } else {
        toast({ 
          title: 'Error', 
          description: data.error || 'Invalid invitation',
          variant: 'destructive' 
        });
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching invitation:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to load invitation',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!termsAccepted || !visitorAgreementAccepted) {
      toast({ 
        title: 'Error', 
        description: 'Please accept both agreements to continue',
        variant: 'destructive' 
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/guest/accept-terms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitationId,
          termsAccepted,
          visitorAgreementAccepted,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({ 
          title: 'Terms Accepted!', 
          description: 'Your host will now be notified to generate your QR code.' 
        });
        
        // Redirect to success page
        router.push(`/guest/success/${invitationId}`);
      } else {
        toast({ 
          title: 'Error', 
          description: data.error || 'Failed to accept terms',
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error accepting terms:', error);
      toast({ 
        title: 'Error', 
        description: 'Network error. Please try again.',
        variant: 'destructive' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-surface-0 to-background relative overflow-hidden">
        {/* Subtle animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 -right-48 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse delay-700" />
        </div>
        
        <div className="bg-surface-1/50 backdrop-blur-sm border-b border-border/30 shadow-sm">
          <div className="container mx-auto px-4 py-6">
            <PageHeader 
              title="Loading..."
              subtitle="Please wait while we load your invitation"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse flex items-center gap-3">
            <div className="w-3 h-3 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-surface-0 to-background relative overflow-hidden">
        {/* Subtle animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 -right-48 w-96 h-96 bg-destructive/3 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-destructive/3 rounded-full blur-3xl animate-pulse delay-700" />
        </div>
        
        <div className="bg-surface-1/50 backdrop-blur-sm border-b border-border/30 shadow-sm">
          <div className="container mx-auto px-4 py-6">
            <PageHeader 
              title="Invalid Invitation"
              subtitle="This invitation could not be found"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-0 to-background relative overflow-hidden">
      {/* Subtle animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse delay-700" />
      </div>
      
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-border/30 shadow-sm relative z-10">
        <div className="container mx-auto px-4 py-6">
          <PageHeader 
            title="Accept Terms & Conditions"
            subtitle={`Welcome ${invitation.guest.name || 'Guest'}! Please review and accept the terms below.`}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl relative z-10">
        <div className="mb-6 relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-success/10 to-transparent rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
          <div className="relative p-5 bg-gradient-to-r from-success/10 to-success/5 border border-success/20 rounded-xl shadow-sm backdrop-blur-sm">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-success/10">
                <AlertCircle className="w-5 h-5 text-success" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-success mb-1">Step 2 of 2: Accept Terms</p>
                <p className="text-muted-foreground">After accepting these terms, your host will be able to generate your QR code for check-in.</p>
              </div>
            </div>
          </div>
        </div>

        <PageCard
          title="Terms & Agreements"
          description="Please review and accept the following agreements"
          icon={FileText}
          className="shadow-xl border-border/30 hover:border-primary/20 transition-all duration-300"
        >
          <div className="space-y-6">
            <div className="p-5 bg-surface-1/50 rounded-xl border border-border/30 shadow-sm backdrop-blur-sm hover:border-border/50 transition-all">
              <h3 className="font-semibold text-base mb-3 text-foreground flex items-center gap-2">
                <span className="text-lg opacity-70">📜</span>
                Terms and Conditions
              </h3>
              <div className="text-sm text-muted-foreground space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                <p>By accepting these terms, you agree to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Follow all building security protocols</li>
                  <li>Wear your visitor badge at all times</li>
                  <li>Stay within designated visitor areas</li>
                  <li>Be accompanied by your host when required</li>
                  <li>Check out when leaving the premises</li>
                  <li>Comply with all Frontier Tower policies</li>
                </ul>
              </div>
            </div>

            <div className="p-5 bg-surface-1/50 rounded-xl border border-border/30 shadow-sm backdrop-blur-sm hover:border-border/50 transition-all">
              <h3 className="font-semibold text-base mb-3 text-foreground flex items-center gap-2">
                <span className="text-lg opacity-70">🤝</span>
                Visitor Agreement
              </h3>
              <div className="text-sm text-muted-foreground space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                <p>As a visitor to Frontier Tower, you acknowledge:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your visit is limited to the scheduled date and time</li>
                  <li>Photography may be restricted in certain areas</li>
                  <li>Confidential information must be protected</li>
                  <li>Emergency procedures must be followed</li>
                  <li>Visitor access may be revoked at any time</li>
                  <li>You are responsible for any damages caused</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-surface-0/30 rounded-xl border border-border/20">
              <div className="flex items-start space-x-3 group hover:bg-surface-1/30 p-3 rounded-lg transition-colors">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-0.5 border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label 
                  htmlFor="terms" 
                  className="text-sm cursor-pointer select-none text-foreground group-hover:text-primary transition-colors"
                >
                  I have read and accept the <span className="font-semibold">Terms and Conditions</span>
                </label>
              </div>

              <div className="flex items-start space-x-3 group hover:bg-surface-1/30 p-3 rounded-lg transition-colors">
                <Checkbox
                  id="visitor"
                  checked={visitorAgreementAccepted}
                  onCheckedChange={(checked) => setVisitorAgreementAccepted(checked as boolean)}
                  className="mt-0.5 border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label 
                  htmlFor="visitor" 
                  className="text-sm cursor-pointer select-none text-foreground group-hover:text-primary transition-colors"
                >
                  I have read and accept the <span className="font-semibold">Visitor Agreement</span>
                </label>
              </div>
            </div>

            <div className="pt-6 border-t border-border/30">
              <button
                onClick={handleAccept}
                disabled={!termsAccepted || !visitorAgreementAccepted || submitting}
                className="w-full bg-gradient-to-r from-success to-success-hover hover:from-success-hover hover:to-success text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl hover:shadow-success/20 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-success/30 disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none group"
              >
                <div className="flex items-center justify-center gap-3">
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                      <span className="text-lg font-bold">Processing...</span>
                    </>
                  ) : (
                    <>
                      <div className={`p-1.5 rounded-lg backdrop-blur-sm transition-all ${
                        termsAccepted && visitorAgreementAccepted 
                          ? "bg-white/10 group-hover:bg-white/20" 
                          : "bg-black/10"
                      }`}>
                        {termsAccepted && visitorAgreementAccepted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <span className="text-xl">⚠️</span>
                        )}
                      </div>
                      <span className="text-lg font-bold">
                        {termsAccepted && visitorAgreementAccepted 
                          ? 'Accept & Continue' 
                          : 'Please Accept Both Terms'}
                      </span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>
        </PageCard>
      </div>
    </div>
  );
}