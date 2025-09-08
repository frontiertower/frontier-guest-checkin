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
      <div className="min-h-screen bg-background">
        <div className="bg-surface-1 dark:bg-surface-1 border-b border-border-subtle dark:border-border-subtle shadow-sm dark:shadow-none">
          <div className="container mx-auto px-4 py-6">
            <PageHeader 
              title="Loading..."
              subtitle="Please wait while we load your invitation"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-surface-1 dark:bg-surface-1 border-b border-border-subtle dark:border-border-subtle shadow-sm dark:shadow-none">
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
    <div className="min-h-screen bg-background">
      <div className="bg-surface-1 dark:bg-surface-1 border-b border-border-subtle dark:border-border-subtle shadow-sm dark:shadow-none">
        <div className="container mx-auto px-4 py-6">
          <PageHeader 
            title="Accept Terms & Conditions"
            subtitle={`Welcome ${invitation.guest.name || 'Guest'}! Please review and accept the terms below.`}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6 p-4 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-400">
              <p className="font-semibold">Step 2 of 2: Accept Terms</p>
              <p>After accepting these terms, your host will be able to generate your QR code for check-in.</p>
            </div>
          </div>
        </div>

        <PageCard
          title="Terms & Agreements"
          description="Please review and accept the following agreements"
          icon={FileText}
        >
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-sm mb-2">Terms and Conditions</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 max-h-48 overflow-y-auto">
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

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-sm mb-2">Visitor Agreement</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 max-h-48 overflow-y-auto">
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

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                />
                <label 
                  htmlFor="terms" 
                  className="text-sm cursor-pointer select-none"
                >
                  I have read and accept the Terms and Conditions
                </label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="visitor"
                  checked={visitorAgreementAccepted}
                  onCheckedChange={(checked) => setVisitorAgreementAccepted(checked as boolean)}
                />
                <label 
                  htmlFor="visitor" 
                  className="text-sm cursor-pointer select-none"
                >
                  I have read and accept the Visitor Agreement
                </label>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                onClick={handleAccept}
                disabled={!termsAccepted || !visitorAgreementAccepted || submitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept & Continue
                  </>
                )}
              </Button>
            </div>
          </div>
        </PageCard>
      </div>
    </div>
  );
}