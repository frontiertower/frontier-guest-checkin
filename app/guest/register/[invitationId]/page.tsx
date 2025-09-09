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
            title="Complete Your Profile"
            subtitle={`Welcome! You've been invited by ${invitation.host.name} to visit Frontier Tower.`}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl relative z-10">
        <div className="mb-6 relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-info/10 to-transparent rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity" />
          <div className="relative p-5 bg-gradient-to-r from-info/10 to-info/5 border border-info/20 rounded-xl shadow-sm backdrop-blur-sm">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-info/10">
                <AlertCircle className="w-5 h-5 text-info" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-info mb-1">Step 1 of 2: Complete Your Profile</p>
                <p className="text-muted-foreground">Please provide your information below. After completing this form, you&apos;ll be asked to accept our terms and conditions.</p>
              </div>
            </div>
          </div>
        </div>

        <PageCard
          title="Your Information"
          description={`Email: ${invitation.guest.email}`}
          icon={UserCheck}
          className="shadow-xl border-border/30 hover:border-primary/20 transition-all duration-300"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="text-base opacity-80">👤</span>
                Full Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
                required
                className="bg-surface-0/50 border-border/50 hover:bg-surface-1/50 hover:border-primary/30 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-surface-1/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="text-base opacity-80">🌍</span>
                Country *
              </Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Enter your country"
                required
                className="bg-surface-0/50 border-border/50 hover:bg-surface-1/50 hover:border-primary/30 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-surface-1/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="text-base opacity-80">📞</span>
                Contact Method *
              </Label>
              <div className="flex gap-2">
                <Select 
                  value={formData.contactMethod}
                  onValueChange={(value: 'TELEGRAM' | 'PHONE') => 
                    setFormData({ ...formData, contactMethod: value })
                  }
                >
                  <SelectTrigger className="w-32 bg-surface-0/50 border-border/50 hover:bg-surface-1/50 hover:border-primary/30 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    <SelectItem value="TELEGRAM">Telegram</SelectItem>
                    <SelectItem value="PHONE">Phone</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={formData.contactMethod === 'TELEGRAM' ? '@username' : '+1234567890'}
                  value={formData.contactValue}
                  onChange={(e) => setFormData({ ...formData, contactValue: e.target.value })}
                  required
                  className="bg-surface-0/50 border-border/50 hover:bg-surface-1/50 hover:border-primary/30 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-surface-1/50 transition-all"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border/30">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary text-primary-foreground font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-primary/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:from-muted disabled:to-muted disabled:hover:scale-100 group"
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-lg font-bold">Continue to Terms & Conditions</span>
                  <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                    <span className="text-lg">→</span>
                  </div>
                </div>
              </button>
            </div>
          </form>
        </PageCard>
      </div>
    </div>
  );
}