'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface OverrideDialogProps {
  open: boolean;
  onConfirm: (reason: string, password: string) => void;
  onCancel: () => void;
  currentCount: number;
  maxCount: number;
  guestName?: string;
  errorMessage?: string;
}

export function OverrideDialog({
  open,
  onConfirm,
  onCancel,
  currentCount,
  maxCount,
  guestName,
  errorMessage
}: OverrideDialogProps) {
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!reason.trim() || !password) {
      if (!password) {
        setPasswordError('Password is required');
      }
      return;
    }
    setIsSubmitting(true);
    setPasswordError(null);
    onConfirm(reason.trim(), password);
  };

  // Reset submitting state when dialog reopens (password error)
  React.useEffect(() => {
    if (open) {
      setIsSubmitting(false);
    }
  }, [open, errorMessage]);

  const handleCancel = () => {
    setReason('');
    setPassword('');
    setPasswordError(null);
    setIsSubmitting(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-lg bg-gradient-to-br from-destructive/5 via-card to-surface-1/50 border-2 border-destructive/30 rounded-xl shadow-2xl shadow-destructive/20 backdrop-blur-xl p-6 font-sans">
        {/* Header */}
        <div className="border-b border-destructive/20 pb-4 mb-6">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-destructive to-destructive-foreground bg-clip-text text-transparent mb-4 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-destructive/20 animate-pulse">
              <span className="text-destructive text-xl">🚨</span>
            </div>
            Security Override Required
          </h2>
          
          {/* Capacity Status with Visual Meter */}
          <div className="bg-gradient-to-r from-destructive/20 to-destructive/10 border border-destructive/30 rounded-lg p-4 shadow-inner">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-destructive/30 animate-pulse shadow-md shadow-destructive/20">
                <span className="text-2xl">👥</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-destructive uppercase tracking-wider">
                  Capacity Limit Exceeded
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Host has reached maximum concurrent guests
                </p>
              </div>
            </div>
            {/* Visual Capacity Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Current Capacity</span>
                <span className="font-mono font-bold text-foreground text-sm">{currentCount}/{maxCount}</span>
              </div>
              <div className="relative h-3 bg-surface-3/50 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-destructive to-destructive/60 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((currentCount / maxCount) * 100, 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </div>
                {/* Limit marker */}
                <div className="absolute top-0 bottom-0 right-0 w-px bg-destructive" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <div className="bg-destructive/20 text-destructive border border-destructive/30 text-xs font-bold shadow-sm shadow-destructive/10 px-2 py-1 rounded">
                  OVER LIMIT
                </div>
              </div>
            </div>
          </div>

          {/* Guest Name */}
          {guestName && (
            <div className="mt-4 p-3 bg-surface-2/30 rounded-lg border border-border/20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Requesting Guest
              </p>
              <p className="text-base text-foreground font-semibold flex items-center gap-2">
                <span className="text-lg">👤</span>
                {guestName}
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 bg-destructive/10 border-l-4 border-destructive rounded-r-lg p-3 shadow-sm shadow-destructive/10">
              <p className="text-sm text-destructive font-semibold flex items-center gap-2">
                <span>⚠️</span>
                {errorMessage}
              </p>
            </div>
          )}
        </div>
        
        {/* Form Fields */}
        <div className="space-y-6">
          {/* Reason Field */}
          <div>
            <Label 
              htmlFor="override-reason" 
              className="block text-sm font-medium text-foreground mb-2"
            >
              Override Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="override-reason"
              placeholder="Please provide a reason for this override (e.g., VIP guest, special event, emergency situation)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-border/50 rounded-lg p-3 text-sm text-foreground bg-surface-0/50 hover:bg-surface-1/50 focus:ring-2 focus:ring-destructive/50 focus:border-destructive/50 focus:bg-surface-1/50 resize-none min-h-[80px] placeholder:text-muted-foreground transition-all"
              disabled={isSubmitting}
            />
          </div>

          {/* Password Field */}
          <div>
            <Label 
              htmlFor="override-password" 
              className="block text-sm font-medium text-foreground mb-2"
            >
              Security Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="override-password"
              type="password"
              placeholder="Enter security override password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(null);
              }}
              className={`w-full border ${passwordError ? 'border-destructive ring-2 ring-destructive/30 bg-destructive/5' : 'border-border/50'} rounded-lg p-3 text-sm text-foreground bg-surface-0/50 hover:bg-surface-1/50 focus:ring-2 focus:ring-destructive/50 focus:border-destructive/50 focus:bg-surface-1/50 placeholder:text-muted-foreground transition-all`}
              disabled={isSubmitting}
            />
            {passwordError && (
              <p className="text-xs text-destructive font-medium mt-1">
                {passwordError}
              </p>
            )}
          </div>

          {/* Audit Notice */}
          <div className="bg-gradient-to-r from-info/10 to-info/5 border-l-4 border-info p-4 rounded-r-lg shadow-sm shadow-info/10">
            <p className="text-xs text-info font-semibold flex items-center gap-2">
              <span className="text-base">🔒</span>
              <span>Audit Notice: This override will be permanently logged with timestamp and authorization details</span>
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-destructive/20">
          <Button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 bg-muted hover:bg-muted-foreground/20 text-foreground px-4 py-3 rounded-lg font-medium border border-border/30 hover:border-border/50 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="mr-2">×</span>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason.trim() || !password || isSubmitting}
            className="flex-1 bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 text-destructive-foreground px-4 py-3 rounded-lg font-semibold disabled:from-muted disabled:to-muted disabled:text-muted-foreground shadow-md hover:shadow-lg hover:shadow-destructive/20 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">↻</span>
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>✓</span>
                Override & Check In
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}