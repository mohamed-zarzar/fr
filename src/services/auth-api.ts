import { APP_CONFIG } from "@/config";
import {
  apiRequest,
  parseJson,
  STORAGE_KEYS,
  clearAuthSession,
  type AuthUser,
  type ApiWrappedError,
  type ApiWrappedSuccess,
} from "@/lib/api-client";

interface JwtPayload {
  sub?: string;
  userType?: string;
  roles?: string[];
  permissions?: string[];
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

function persistSession(tokens: TokenPair, user: AuthUser): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken);
  localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export const authApi = {
  /**
   * Real API: POST /auth/login with { identifier, password }.
   * Mock: no HTTP; stores opaque fake tokens so the app is "logged in".
   */
  async login(identifier: string, password: string): Promise<AuthUser> {
    const trimmed = identifier.trim();
    if (APP_CONFIG.USE_MOCK_API) {
      const tokens: TokenPair = {
        accessToken: `mock-access-${crypto.randomUUID()}`,
        refreshToken: `mock-refresh-${crypto.randomUUID()}`,
      };
      const user: AuthUser = { identifier: trimmed || "mock" };
      persistSession(tokens, user);
      return user;
    }

    const response = await apiRequest("auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ identifier: trimmed, password }),
    });

    const body = await parseJson<ApiWrappedSuccess<TokenPair> | ApiWrappedError>(response);

    if (!response.ok || !body || body.data === null) {
      const msg =
        body && "message" in body && typeof body.message === "string"
          ? body.message
          : "Login failed";
      throw new Error(msg);
    }

    const data = (body as ApiWrappedSuccess<TokenPair>).data;
    if (!data?.accessToken || !data?.refreshToken) {
      throw new Error("Invalid login response");
    }

    const payload = decodeJwtPayload(data.accessToken);
    const user: AuthUser = {
      identifier: trimmed,
      id: payload?.sub,
      userType: payload?.userType,
      roles: payload?.roles,
      permissions: payload?.permissions,
    };
    persistSession(data, user);
    return user;
  },

  logout(): void {
    clearAuthSession();
  },

  getStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AuthUser;
      if (parsed && typeof parsed.identifier === "string") return parsed;
    } catch {
      /* ignore */
    }
    return null;
  },

  hasAccessToken(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.accessToken);
  },
};
