"use client"

import { useState, useEffect } from 'react';
import type { AuthUser } from '@/lib/auth';

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      // We'll use the invitations endpoint as a test for authentication
      const response = await fetch('/api/invitations', {
        credentials: 'include',
      });
      
      if (response.ok) {
        // If the request succeeds, we're authenticated
        // We can derive user info from the JWT if needed, but for now
        // we'll just set a basic authenticated state
        setUser({
          id: 'current-user',
          email: 'current@user.com',
          name: 'Current User',
          role: 'host' // Default role
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check if user is authenticated by trying to access a protected endpoint
    checkAuthStatus();
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      setUser(null);
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    logout,
  };
}