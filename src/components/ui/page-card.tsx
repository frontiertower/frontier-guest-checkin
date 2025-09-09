import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  gradient?: boolean;
  className?: string;
  headerClassName?: string;
  children: React.ReactNode;
}

export function PageCard({ 
  title, 
  description, 
  icon: Icon, 
  gradient = false, 
  className,
  headerClassName,
  children 
}: PageCardProps) {
  return (
    <Card 
      className={cn(
        // Base card styling with enhanced elevation
        "text-card-foreground border rounded-xl overflow-hidden transition-all duration-300",
        // Enhanced shadows and depth
        "shadow-xl hover:shadow-2xl",
        // Base background with gradient option
        gradient 
          ? // Hero cards with special emphasis
            "bg-gradient-to-br from-primary/10 to-card border-primary/30 shadow-primary/10"
          : // Standard cards with subtle gradient
            "bg-gradient-to-br from-card to-surface-1/50 border-border/50 hover:border-primary/20",
        // Backdrop effects
        "backdrop-blur-sm",
        // Hover effects
        "hover:scale-[1.01]",
        className
      )}
    >
      <CardHeader className={cn(
        "border-b border-border/30 bg-surface-0/30",
        headerClassName
      )}>
        <CardTitle className={cn(
          "flex items-center gap-3 text-2xl font-bold",
          "bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent"
        )}>
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-muted-foreground mt-1">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}