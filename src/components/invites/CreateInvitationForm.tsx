'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageCard } from '@/components/ui/page-card';
import { UserCheck, Loader2, Mail, CheckCircle2, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export function CreateInvitationForm({ onInvitationCreated }: { onInvitationCreated?: () => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    inviteDate: new Date().toISOString().split('T')[0],
  });

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({ 
          title: 'Invitation Sent!', 
          description: 'Guest will receive an email to complete their profile and accept terms.' 
        });
        setFormData({
          email: '',
          inviteDate: new Date().toISOString().split('T')[0],
        });
        // Notify parent component to refresh data
        onInvitationCreated?.();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to create invitation' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageCard
      title="Create Invitation"
      description="Send an invitation email to a guest. They will complete their profile and accept terms via email."
      icon={UserCheck}
    >
      <form onSubmit={handleCreateInvitation} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground">Guest Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="guest@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inviteDate" className="text-sm font-medium text-foreground">Visit Date</Label>
            <Input
              id="inviteDate"
              type="date"
              value={formData.inviteDate}
              onChange={(e) => setFormData({ ...formData, inviteDate: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="pt-6">
          <div className="bg-muted border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              <span className="text-sm font-semibold text-foreground">
                How it works
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-muted-foreground/10 rounded-lg flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Email sent</p>
                  <p className="text-xs text-muted-foreground">Guest receives invitation</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-muted-foreground/10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Profile & terms</p>
                  <p className="text-xs text-muted-foreground">Guest completes signup</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-muted-foreground/10 rounded-lg flex items-center justify-center">
                  <QrCode className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Ready to scan</p>
                  <p className="text-xs text-muted-foreground">Appears in your QR above</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <div className="flex items-center justify-center gap-3">
              {isLoading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-lg font-bold">Sending Invitation...</span>
                </>
              ) : (
                <>
                  <Mail className="h-6 w-6" />
                  <span className="text-lg font-bold">Send Invitation</span>
                </>
              )}
            </div>
          </button>
        </div>
      </form>
    </PageCard>
  );
}