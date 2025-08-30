'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { toast } = useToast();

  const loadActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/activity');
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setHasLoaded(true);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load activity feed. Please refresh.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadActivities();
  };

  useEffect(() => {
    if (isActive && !hasLoaded) {
      loadActivities();
    }
  }, [isActive, hasLoaded, loadActivities]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    
    if (isActive && hasLoaded) {
      // Only set up auto-refresh if tab is active and has loaded
      interval = setInterval(loadActivities, 30000); // Auto-refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, hasLoaded, loadActivities]);

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
      case 'success': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  if (!isActive || isLoading) {
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Activity Feed
            </CardTitle>
            <CardDescription>Recent system events and activities</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Auto-refresh: 30s
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {activities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No recent activity found.
            </p>
          ) : (
            activities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted">
                <div className={`p-2 rounded-full ${getSeverityColor(activity.severity)}`}>
                  {getIconComponent(activity.icon)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{activity.title}</h4>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}