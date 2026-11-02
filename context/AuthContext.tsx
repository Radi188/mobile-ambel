import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { authService } from '../services/auth.service';
import { branchesService } from '../services/branches.service';
import { storage } from '../lib/storage';
import { appEvents, EVENTS } from '../lib/appEvents';
import {
  Backend, BACKENDS, getApiBaseUrl, getBackend, loadServer, normaliseBaseUrl, savedUrlFor, setServer as saveServer,
} from '../lib/serverConfig';
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
  /** `identifier` is an email on BongPOS and a username on Ambel. */
  login: (identifier: string, password: string) => Promise<void>;
  /** Re-fetch the signed-in profile (pull-to-refresh on the account screen). */
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  switchBranch: (branchId: string | null) => Promise<void>;
  /** Which API this device signs in to: BongPOS or Ambel. */
  backend: Backend;
  /** That API's address (its production one unless changed on the login screen). */
  server: string;
  /**
   * Point the app at another backend, or another address for one. Everything
   * from the old server — the session and the branch it was scoped to — is
   * forgotten, so the next sign-in starts clean. Without `url` the backend's
   * saved address is used; its default (or '') forgets the override.
   */
  switchServer: (backend: Backend, url?: string) => Promise<string>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [backend, setBackend] = useState<Backend>(getBackend());
  const [server, setServer] = useState(getApiBaseUrl());

  const router = useRouter();
  const segments = useSegments();

  // Boot: restore the chosen server and the session cache before the first
  // request, then check the saved token is still good on that server.
  useEffect(() => {
    (async () => {
      const saved = await loadServer();
      setBackend(saved.backend);
      setServer(saved.url);
      await storage.init();
      const stored = storage.getTokenSync();
      if (stored) {
        try {
          const me = await authService.me();
          setToken(stored);
          setUser(me);
          setActiveBranchId(storage.getBranchIdSync());
        } catch {
          await storage.clear();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  // Any request answered 401 (expired or foreign token) signs the app out.
  useEffect(() => appEvents.on(EVENTS.AUTH_LOGOUT, () => { logout(); }), []);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) {
      router.replace('/(auth)/login');
    } else if (token && inAuth) {
      router.replace('/(tabs)');
    }
  }, [token, segments, isLoading]);

  const login = async (identifier: string, password: string) => {
    const data = await authService.login(identifier, password);
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
    await storage.clear();
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

  const switchServer = async (next: Backend, input?: string) => {
    const target = input === undefined ? await savedUrlFor(next) : normaliseBaseUrl(input) || BACKENDS[next].url;
    if (next === getBackend() && target === getApiBaseUrl()) return target;
    const saved = await saveServer(next, target);
    await logout();
    setBackend(saved.backend);
    setServer(saved.url);
    return saved.url;
  };

  return (
    <AuthContext.Provider
      value={{
        user, token, isLoading, activeBranchId, login, logout, switchBranch, refreshUser, backend, server, switchServer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
