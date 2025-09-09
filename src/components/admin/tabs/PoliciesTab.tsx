'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminData } from '@/contexts/AdminDataContext';
import { Settings, CheckCircle } from 'lucide-react';

interface PoliciesTabProps {
  isActive?: boolean;
}

export default function PoliciesTab({ isActive = false }: PoliciesTabProps) {
  const { policies, isLoadingPolicies, loadPolicies, updatePolicies, getLocationContext } = useAdminData();
  const locationContext = getLocationContext();
  const [policyForm, setPolicyForm] = useState({
    guestMonthlyLimit: 3,
    hostConcurrentLimit: 3
  });

  // Load policies when tab becomes active and we don't have cached data
  useEffect(() => {
    if (isActive && !policies) {
      loadPolicies();
    }
  }, [isActive, policies, loadPolicies]);

  // Update form when policies change
  useEffect(() => {
    if (policies) {
      setPolicyForm({
        guestMonthlyLimit: policies.guestMonthlyLimit,
        hostConcurrentLimit: policies.hostConcurrentLimit
      });
    }
  }, [policies]);

  const handlePolicyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePolicies(policyForm);
  };

  // Show skeleton when tab is active and loading without data
  if (isActive && isLoadingPolicies && !policies) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-48 bg-muted rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-48 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          System Policies
        </CardTitle>
        <CardDescription>
          {locationContext.isSingleLocation 
            ? `Configure business rules for ${locationContext.locationName}`
            : `Configure global business rules for all locations`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePolicyUpdate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="guestMonthlyLimit">Guest Monthly Limit</Label>
              <Input
                id="guestMonthlyLimit"
                type="number"
                min="1"
                max="100"
                value={policyForm.guestMonthlyLimit}
                onChange={(e) => setPolicyForm({
                  ...policyForm,
                  guestMonthlyLimit: parseInt(e.target.value)
                })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum visits per guest in a 30-day rolling window
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hostConcurrentLimit">Host Concurrent Limit</Label>
              <Input
                id="hostConcurrentLimit"
                type="number"
                min="1"
                max="50"
                value={policyForm.hostConcurrentLimit}
                onChange={(e) => setPolicyForm({
                  ...policyForm,
                  hostConcurrentLimit: parseInt(e.target.value)
                })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum active guests per host at any time
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Current Settings</p>
                {policies && policies.updatedAt && (
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(policies.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <Button type="submit">
                <CheckCircle className="h-4 w-4 mr-2" />
                Update Policies
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}