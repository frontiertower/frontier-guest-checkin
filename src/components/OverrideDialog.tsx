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
      <DialogContent className="max-w-lg bg-card dark:bg-elevated border border-border/50 dark:border-border/30 rounded-xl shadow-lg dark:shadow-none backdrop-blur-sm p-6 font-sans">
        {/* Header */}
        <div className="border-b border-border-subtle dark:border-border-subtle pb-4 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Security Override Required
          </h2>
          
          {/* Capacity Status */}
          <div className="bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 dark:border-destructive/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-destructive text-xl">⚠️</span>
              <p className="text-sm font-medium text-destructive dark:text-destructive">
                Capacity Limit Exceeded
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Active Guests: <span className="font-mono font-semibold text-foreground">{currentCount}/{maxCount}</span>
              </span>
              <div className="bg-destructive text-destructive-foreground px-2 py-1 text-xs font-medium rounded">
                OVER LIMIT
              </div>
            </div>
          </div>

          {/* Guest Name */}
          {guestName && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Requesting Guest
              </p>
              <p className="text-sm text-foreground font-medium">
                {guestName}
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 dark:border-destructive/30 rounded-lg p-3">
              <p className="text-sm text-destructive dark:text-destructive font-medium">
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
              className="w-full border border-border/50 dark:border-border/30 rounded-lg p-3 text-sm text-foreground bg-background dark:bg-surface focus:ring-2 focus:ring-ring focus:border-ring resize-none min-h-[80px] placeholder:text-muted-foreground"
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
              className={`w-full border ${passwordError ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/50 dark:border-border/30'} rounded-lg p-3 text-sm text-foreground bg-background dark:bg-surface focus:ring-2 focus:ring-ring focus:border-ring placeholder:text-muted-foreground`}
              disabled={isSubmitting}
            />
            {passwordError && (
              <p className="text-xs text-destructive font-medium mt-1">
                {passwordError}
              </p>
            )}
          </div>

          {/* Audit Notice */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
            <p className="text-xs text-blue-800 font-medium">
              Audit Notice: This override will be permanently logged with timestamp and authorization details
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-gray-200">
          <Button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason.trim() || !password || isSubmitting}
            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-lg font-medium disabled:bg-muted disabled:text-muted-foreground"
          >
            {isSubmitting ? 'Processing...' : 'Override & Check In'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}