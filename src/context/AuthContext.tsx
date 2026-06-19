import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/services/auth-api";
import type { AuthUser } from "@/lib/api-client";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isManager: boolean;
  hasPermission: (permission: string) => boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authApi.hasAccessToken()) {
      setUser(authApi.getStoredUser() ?? { identifier: "" });
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const u = await authApi.login(identifier, password);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    window.location.replace("/login");
  }, []);

  const isManager = useMemo(
    () => user?.userType === "MANAGER",
    [user],
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      const perms = user?.permissions;
      if (!perms?.length) return false;
      return perms.includes("*") || perms.includes(permission);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !isLoading && authApi.hasAccessToken(),
      isLoading,
      isManager,
      hasPermission,
      login,
      logout,
    }),
    [user, isLoading, isManager, hasPermission, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
