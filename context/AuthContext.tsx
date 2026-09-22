import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { authService } from '../services/auth.service';
import { branchesService } from '../services/branches.service';
import { storage } from '../lib/storage';
import { AuthUser } from '../types/api.types';

// Super admins land on this branch by default; they can switch away from the dashboard.
const DEFAULT_ADMIN_BRANCH_NAME = 'Toul Tompong';

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  // Branch the app's requests are currently scoped to (via the x-branch-id header).
  // null = every branch (super admins can switch through them one by one).
  activeBranchId: string | null;
  login: (username: string, password: string) => Promise<void>;
  /** Re-fetch the signed-in profile (pull-to-refresh on the account screen). */
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  switchBranch: (branchId: string | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    storage.getToken().then(async (stored) => {
      if (stored) {
        try {
          const me = await authService.me();
          setToken(stored);
          setUser(me);
          setActiveBranchId(await storage.getBranchId());
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

  const login = async (username: string, password: string) => {
    const data = await authService.login(username, password);
    await storage.setToken(data.accessToken);

    // Resolve the branch requests should start scoped to:
    // the account's own branch, or — for super admins without one — Toul Tompong.
    let branchId = data.user.branchId ?? null;
    if (!branchId && data.user.role === 'super_admin') {
      try {
        const branches = await branchesService.getBranches();
        const match = (branches ?? []).find(
          (b) => b.name.trim().toLowerCase() === DEFAULT_ADMIN_BRANCH_NAME.toLowerCase()
        );
        branchId = match?._id ?? null;
      } catch {
        // Fall back to all branches if the lookup fails.
      }
    }

    if (branchId) {
      await storage.setBranchId(branchId);
    } else {
      await storage.removeBranchId();
    }
    setToken(data.accessToken);
    setUser(data.user);
    setActiveBranchId(branchId);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      setUser(await authService.me());
    } catch {
      // A failed refresh shouldn't sign anyone out — keep the cached profile.
    }
  };

  const logout = async () => {
    await storage.removeToken();
    await storage.removeBranchId();
    setToken(null);
    setUser(null);
    setActiveBranchId(null);
  };

  // Point every subsequent request at a single branch (or all branches when null).
  const switchBranch = async (branchId: string | null) => {
    if (branchId) {
      await storage.setBranchId(branchId);
    } else {
      await storage.removeBranchId();
    }
    setActiveBranchId(branchId);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, activeBranchId, login, logout, switchBranch, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
