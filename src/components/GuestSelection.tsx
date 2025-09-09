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
    <div className="bg-gradient-to-br from-card to-surface-1/50 rounded-xl border border-border/50 shadow-xl backdrop-blur-xl p-4 sm:p-6">
      <div className="text-center mb-6">
        <h2 className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-2">
          Select Guest to Check In
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose which guest you&apos;d like to check in from the QR code
        </p>
      </div>

      <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-2">
        {guests.map((guest, index) => (
          <Card 
            key={index} 
            className="group cursor-pointer bg-gradient-to-r from-surface-1/80 to-surface-2/50 hover:from-surface-2/80 hover:to-surface-3/60 transition-all duration-300 border-border/30 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transform hover:scale-[1.02]"
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary-hover/20 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:shadow-primary/20 transition-all">
                      <span className="text-primary font-bold text-lg">
                        {guest.n.split(' ').map(name => name[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-card opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{guest.n}</h3>
                    <p className="text-sm text-muted-foreground">{guest.e}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => onSelectGuest(guest)}
                  className="bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success text-success-foreground px-5 py-2.5 shadow-md hover:shadow-lg hover:shadow-success/20 transition-all font-medium"
                >
                  <span className="mr-2">✓</span>
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
          className="flex-1 border-border/50 hover:border-primary/30 hover:bg-accent/10 transition-all"
        >
          <span className="mr-2">←</span>
          Cancel & Scan Again
        </Button>
      </div>
    </div>
  );
}