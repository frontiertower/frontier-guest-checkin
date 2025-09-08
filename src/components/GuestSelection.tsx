'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuestData } from '@/lib/qr-token';

interface GuestSelectionProps {
  guests: GuestData[];
  onSelectGuest: (guest: GuestData) => void;
  onCancel: () => void;
}

export function GuestSelection({ guests, onSelectGuest, onCancel }: GuestSelectionProps) {
  return (
    <div className="bg-card dark:bg-surface-2 rounded-xl border border-border/50 dark:border-border/30 shadow-lg dark:shadow-none backdrop-blur-sm p-4 sm:p-6">
      <div className="text-center mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
          Select Guest to Check In
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose which guest you&apos;d like to check in from the QR code
        </p>
      </div>

      <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
        {guests.map((guest, index) => (
          <Card key={index} className="cursor-pointer hover:bg-surface-3 dark:hover:bg-surface-3 transition-all duration-200 border-border/50 dark:border-border/30 bg-surface-1 dark:bg-surface-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-primary font-semibold">
                      {guest.n.split(' ').map(name => name[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-foreground">{guest.n}</h3>
                    <p className="text-sm text-muted-foreground">{guest.e}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => onSelectGuest(guest)}
                  className="bg-success hover:bg-success/90 text-success-foreground px-4 py-2"
                >
                  Select
                </Button>
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1 border-border/50 dark:border-border/30"
        >
          Cancel & Scan Again
        </Button>
      </div>
    </div>
  );
}