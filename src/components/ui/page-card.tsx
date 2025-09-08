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
        // Base card styling with proper elevation
        "text-card-foreground border border-border/50 rounded-xl overflow-hidden",
        // Light mode: enhanced shadows and subtle gradient
        "bg-card shadow-lg",
        // Dark mode: elevated surface with architectural depth
        "dark:shadow-none dark:border-border/30",
        // Subtle backdrop blur for premium feel
        "backdrop-blur-sm",
        // Simplified solid colors - use semantic classes
        gradient 
          ? // Special styling for hero cards  
            "bg-primary/5 dark:bg-muted border-primary/20 dark:border-primary/30"
          : // Standard card styling
            "bg-card",
        className
      )}
    >
      <CardHeader className={cn(headerClassName)}>
        <CardTitle className={cn(
          "flex items-center gap-2 text-2xl font-bold",
          "text-foreground dark:text-foreground"
        )}>
          {Icon && <Icon className="h-6 w-6 text-primary" />}
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-muted-foreground dark:text-muted-foreground">
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