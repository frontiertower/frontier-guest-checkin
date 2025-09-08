'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageCard } from '@/components/ui/page-card';
import { PageHeader } from '@/components/ui/page-header';
import { UserCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InvitationData {
  id: string;
  guest: {
    email: string;
    name?: string;
    country?: string;
    contactMethod?: string;
    contactValue?: string;
    profileCompleted: boolean;
  };
  host: {
    name: string;
  };
}

export default function GuestRegistrationPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const invitationId = params.invitationId as string;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    contactMethod: 'TELEGRAM' as 'TELEGRAM' | 'PHONE',
    contactValue: '',
  });

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
        
        // Pre-fill form if guest already has some data
        if (data.invitation.guest) {
          setFormData({
            name: data.invitation.guest.name || '',
            country: data.invitation.guest.country || '',
            contactMethod: data.invitation.guest.contactMethod || 'TELEGRAM',
            contactValue: data.invitation.guest.contactValue || '',
          });
        }

        // If profile already completed, redirect to accept terms
        if (data.invitation.guest.profileCompleted) {
          router.push(`/guest/accept/${invitationId}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.country || !formData.contactValue) {
      toast({ 
        title: 'Error', 
        description: 'Please fill in all required fields',
        variant: 'destructive' 
      });
      return;
    }

    try {
      const response = await fetch('/api/guest/complete-profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitationId,
          ...formData,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({ 
          title: 'Profile Completed!', 
          description: 'Now please accept the terms and conditions.' 
        });
        
        // Redirect to terms acceptance page
        router.push(`/guest/accept/${invitationId}`);
      } else {
        toast({ 
          title: 'Error', 
          description: data.error || 'Failed to save profile',
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ 
        title: 'Error', 
        description: 'Network error. Please try again.',
        variant: 'destructive' 
      });
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
            title="Complete Your Profile"
            subtitle={`Welcome! You've been invited by ${invitation.host.name} to visit Frontier Tower.`}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6 p-4 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-400">
              <p className="font-semibold">Step 1 of 2: Complete Your Profile</p>
              <p>Please provide your information below. After completing this form, you&apos;ll be asked to accept our terms and conditions.</p>
            </div>
          </div>
        </div>

        <PageCard
          title="Your Information"
          description={`Email: ${invitation.guest.email}`}
          icon={UserCheck}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Full Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-medium text-foreground">
                Country *
              </Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Enter your country"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Contact Method *
              </Label>
              <div className="flex gap-2">
                <Select 
                  value={formData.contactMethod}
                  onValueChange={(value: 'TELEGRAM' | 'PHONE') => 
                    setFormData({ ...formData, contactMethod: value })
                  }
                >
                  <SelectTrigger className="w-32 border border-border rounded-lg">
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

            <div className="pt-4 border-t">
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 rounded-lg font-medium text-sm transition-colors"
              >
                Continue to Terms & Conditions
              </Button>
            </div>
          </form>
        </PageCard>
      </div>
    </div>
  );
}