'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminData } from '@/contexts/AdminDataContext';
import { 
  Activity, 
  RefreshCw, 
  UserCheck, 
  QrCode, 
  UserPlus, 
  Ban, 
  ShieldAlert, 
  Gift, 
  FileCheck, 
  UserX, 
  Mail 
} from 'lucide-react';

interface ActivityItem {
  type: string;
  timestamp: string;
  title: string;
  description: string;
  icon: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  data: Record<string, unknown>;
}

interface ActivityTabProps {
  isActive?: boolean;
}

export default function ActivityTab({ isActive = false }: ActivityTabProps) {
  const { activities, isLoadingActivities, loadActivities, getLocationContext } = useAdminData();
  const locationContext = getLocationContext();

  // Load activities when tab becomes active and we don't have cached data
  useEffect(() => {
    if (isActive && activities.length === 0) {
      loadActivities();
    }
  }, [isActive, activities.length, loadActivities]);

  const handleRefresh = () => {
    loadActivities(true); // Force refresh
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
      'user-check': UserCheck,
      'qr-code': QrCode,
      'user-plus': UserPlus,
      'ban': Ban,
      'shield-alert': ShieldAlert,
      'gift': Gift,
      'file-check': FileCheck,
      'user-x': UserX,
      'mail': Mail,
    };
    
    const IconComponent = iconMap[iconName] || Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'bg-success/10 text-success border border-success/20 shadow-sm shadow-success/10';
      case 'warning': return 'bg-warning/10 text-warning border border-warning/20 shadow-sm shadow-warning/10';
      case 'error': return 'bg-destructive/10 text-destructive border border-destructive/20 shadow-sm shadow-destructive/10';
      default: return 'bg-info/10 text-info border border-info/20 shadow-sm shadow-info/10';
    }
  };

  const getSeverityGlow = (severity: string) => {
    switch (severity) {
      case 'success': return 'hover:shadow-md hover:shadow-success/20 hover:bg-success/15';
      case 'warning': return 'hover:shadow-md hover:shadow-warning/20 hover:bg-warning/15';
      case 'error': return 'hover:shadow-md hover:shadow-destructive/20 hover:bg-destructive/15';
      default: return 'hover:shadow-md hover:shadow-info/20 hover:bg-info/15';
    }
  };

  // Show skeleton when loading (including when switching locations)
  if (isLoadingActivities) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-24 bg-muted rounded animate-pulse" />
              <div className="h-9 w-20 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg">
                <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-surface-1/50 overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-surface-0/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              Live Activity Feed
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              {locationContext.isSingleLocation 
                ? `Recent activity at ${locationContext.locationName}`
                : `Recent activity ${locationContext.locationPhrase}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1.5 bg-success/10 text-success border-success/20 px-3 py-1">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse shadow-sm shadow-success"></div>
              <span className="text-xs font-medium">Auto-refresh: 30s</span>
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoadingActivities}
              className="border-border/50 hover:bg-accent/10 hover:border-primary/30 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingActivities ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-y-auto divide-y divide-border/20">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted/30 mb-4">
                <Activity className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">
                No recent activity found.
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Activities will appear here as they occur
              </p>
            </div>
          ) : (
            activities.map((activity, index) => (
              <div 
                key={index} 
                className={`flex items-start gap-4 p-4 transition-all duration-200 hover:bg-accent/5 ${getSeverityGlow(activity.severity)} group`}
              >
                <div className={`p-2.5 rounded-xl ${getSeverityColor(activity.severity)} transition-all duration-200 group-hover:scale-110`}>
                  {getIconComponent(activity.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {activity.title}
                    </h4>
                    <span className="text-xs text-muted-foreground/70 whitespace-nowrap flex-shrink-0">
                      {new Date(activity.timestamp).toLocaleString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {activity.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}