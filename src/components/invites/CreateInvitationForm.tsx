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
              className="bg-surface-0/50 border-border/50 hover:bg-surface-1/50 hover:border-primary/30 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-surface-1/50 transition-all"
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
              className="bg-surface-0/50 border-border/50 hover:bg-surface-1/50 hover:border-primary/30 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-surface-1/50 transition-all"
            />
          </div>
        </div>

        <div className="pt-6">
          <div className="bg-gradient-to-br from-surface-1/50 to-surface-2/30 border border-border/30 rounded-xl p-5 shadow-inner">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-sm shadow-primary"></span>
                <span className="text-sm font-semibold text-primary">
                  How it works
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 group hover:scale-[1.02] transition-transform">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg blur opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center shadow-sm">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full shadow-sm shadow-primary/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">1. Email sent</p>
                  <p className="text-xs text-muted-foreground">Guest receives invitation</p>
                </div>
              </div>
              <div className="flex items-start gap-3 group hover:scale-[1.02] transition-transform">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-success/20 to-success/10 rounded-lg blur opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex-shrink-0 w-10 h-10 bg-gradient-to-br from-success/20 to-success/10 rounded-lg flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full shadow-sm shadow-success/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">2. Profile & terms</p>
                  <p className="text-xs text-muted-foreground">Guest completes signup</p>
                </div>
              </div>
              <div className="flex items-start gap-3 group hover:scale-[1.02] transition-transform">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-success/20 to-success/10 rounded-lg blur opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex-shrink-0 w-10 h-10 bg-gradient-to-br from-success/20 to-success/10 rounded-lg flex items-center justify-center shadow-sm">
                    <QrCode className="h-4 w-4 text-success" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse shadow-sm shadow-success/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">3. Ready to scan</p>
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
            className="w-full bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary text-primary-foreground font-semibold py-5 px-6 rounded-xl shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-primary/30 cursor-pointer disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none group"
          >
            <div className="flex items-center justify-center gap-4">
              {isLoading ? (
                <>
                  <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                  <span className="text-lg font-bold">Sending Invitation...</span>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                    <Mail className="h-6 w-6" />
                  </div>
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