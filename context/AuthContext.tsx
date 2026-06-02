import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { authService } from '../services/auth.service';
import { storage } from '../lib/storage';
import { AuthUser } from '../types/api.types';

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    storage.getToken().then(async (stored) => {
      if (stored) {
        try {
          const me = await authService.me();
          setToken(stored);
          setUser(me);
        } catch {
          await storage.removeToken();
          await storage.removeBranchId();
        }
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) {
      router.replace('/(auth)/login');
    } else if (token && inAuth) {
      router.replace('/(tabs)');
    }
  }, [token, segments, isLoading]);

  const login = async (email: string, password: string) => {
    const data = await authService.login(email, password);
    await storage.setToken(data.accessToken);
    if (data.user.branchId) {
      await storage.setBranchId(data.user.branchId);
    } else {
      await storage.removeBranchId();
    }
    setToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    await storage.removeToken();
    await storage.removeBranchId();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
