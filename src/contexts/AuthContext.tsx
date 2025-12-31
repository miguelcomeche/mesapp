import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users for initial development
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'admin@mesapp.com': {
    password: 'admin123',
    user: {
      id: '1',
      email: 'admin@mesapp.com',
      name: 'Admin User',
      role: 'admin',
      restaurantId: 'rest-1',
      createdAt: new Date(),
    },
  },
  'manager@mesapp.com': {
    password: 'manager123',
    user: {
      id: '2',
      email: 'manager@mesapp.com',
      name: 'Floor Manager',
      role: 'manager',
      restaurantId: 'rest-1',
      createdAt: new Date(),
    },
  },
  'waiter@mesapp.com': {
    password: 'waiter123',
    user: {
      id: '3',
      email: 'waiter@mesapp.com',
      name: 'John Waiter',
      role: 'waiter',
      restaurantId: 'rest-1',
      createdAt: new Date(),
    },
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('mesapp_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('mesapp_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const demoUser = DEMO_USERS[email.toLowerCase()];
    
    if (demoUser && demoUser.password === password) {
      setUser(demoUser.user);
      localStorage.setItem('mesapp_user', JSON.stringify(demoUser.user));
      setIsLoading(false);
      return true;
    }
    
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mesapp_user');
  };

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
