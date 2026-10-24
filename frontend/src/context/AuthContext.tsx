import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../lib/api';
import { UserProfile, SenderDTO, AuthResponse } from '../types/contracts';

export interface SenderWithStats extends SenderDTO {
  currentHourSentCount?: number;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  senders: SenderWithStats[];
  isLoading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithDemo: () => Promise<void>;
  logout: () => void;
  refreshSenders: () => Promise<void>;
  createSender: (name?: string, maxEmailsPerHour?: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('reachinbox_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('reachinbox_token');
  });
  const [senders, setSenders] = useState<SenderWithStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setSenders([]);
    localStorage.removeItem('reachinbox_token');
    localStorage.removeItem('reachinbox_user');
  }, []);

  const refreshSenders = useCallback(async () => {
    try {
      const res = await api.get('/senders');
      if (res.data?.success) {
        setSenders(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to refresh senders:', err);
    }
  }, []);

  // Load user profile and senders once on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('reachinbox_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data?.success) {
            setUser(res.data.data.user);
            setSenders(res.data.data.senders || []);
            localStorage.setItem('reachinbox_user', JSON.stringify(res.data.data.user));
          }
        } catch (err) {
          console.warn('Session verification failed, clearing auth state.');
          logout();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, [logout]);

  const handleAuthSuccess = useCallback((authData: AuthResponse & { senders?: SenderWithStats[] }) => {
    setToken(authData.token);
    setUser(authData.user);
    if (authData.senders) {
      setSenders(authData.senders);
    }
    localStorage.setItem('reachinbox_token', authData.token);
    localStorage.setItem('reachinbox_user', JSON.stringify(authData.user));
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const res = await api.post('/auth/google', { credential });
    if (res.data?.success) {
      handleAuthSuccess(res.data.data);
    } else {
      throw new Error(res.data?.error || 'Google login failed');
    }
  }, [handleAuthSuccess]);

  const loginWithDemo = useCallback(async () => {
    const res = await api.post('/auth/demo');
    if (res.data?.success) {
      handleAuthSuccess(res.data.data);
    } else {
      throw new Error(res.data?.error || 'Demo login failed');
    }
  }, [handleAuthSuccess]);

  const createSender = useCallback(async (name?: string, maxEmailsPerHour?: number) => {
    const res = await api.post('/senders', { name, maxEmailsPerHour });
    if (res.data?.success) {
      await refreshSenders();
    } else {
      throw new Error(res.data?.error || 'Failed to create sender');
    }
  }, [refreshSenders]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        senders,
        isLoading,
        loginWithGoogle,
        loginWithDemo,
        logout,
        refreshSenders,
        createSender,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
