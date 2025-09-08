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
    <div className="min-h-screen bg-background">
      <div className="bg-surface-1 dark:bg-surface-1 border-b border-border-subtle dark:border-border-subtle shadow-sm dark:shadow-none">
        <div className="container mx-auto px-4 py-6">
          <PageHeader 
            title="Registration Complete!"
            subtitle="You're all set for your visit to Frontier Tower"
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6 p-6 bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30 rounded-lg">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                Successfully Registered!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400">
                Your profile has been completed and terms have been accepted. 
                Your host has been notified and will generate your QR code for check-in.
              </p>
            </div>
          </div>
        </div>

        {invitation && (
          <PageCard
            title="Visit Details"
            description="Information about your upcoming visit"
            icon={Clock}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your Name</p>
                  <p className="font-medium">{invitation.guest.name || 'Guest'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your Email</p>
                  <p className="font-medium">{invitation.guest.email}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Host</p>
                  <p className="font-medium">{invitation.host.name}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Visit Date</p>
                  <p className="font-medium">{formatDate(invitation.inviteDate)}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-3 flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  Next Steps
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>Your host will receive a notification about your registration</li>
                  <li>They will generate your QR code for entry</li>
                  <li>You&apos;ll receive the QR code via email before your visit</li>
                  <li>Present the QR code at the Frontier Tower check-in kiosk</li>
                </ol>
              </div>

              <div className="p-4 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>Important:</strong> Please check your email for the QR code before arriving at Frontier Tower. 
                  If you don&apos;t receive it by the morning of your visit, please contact your host at{' '}
                  <a href={`mailto:${invitation.host.email}`} className="underline">
                    {invitation.host.email}
                  </a>
                </p>
              </div>
            </div>
          </PageCard>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You can close this window now. We look forward to your visit!
          </p>
        </div>
      </div>
    </div>
  );
}