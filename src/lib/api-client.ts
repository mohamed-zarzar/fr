import { APP_CONFIG } from "@/config";

/** Static tenant UUID for all API requests (per product requirement). */
export const TENANT_ID = APP_CONFIG.TENANT_ID;

export const STORAGE_KEYS = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  user: "auth_user",
} as const;

export type AuthUser = {
  /** Value used at login: code, full name, or email */
  identifier: string;
  id?: string;
  userType?: string;
  roles?: string[];
  permissions?: string[];
};

function buildUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = APP_CONFIG.BASE_URL.replace(/\/$/, "");
  const p = path.replace(/^\//, "");
  return `${base}/${p}`;
}

function getDefaultHeaders(includeAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "x-tenant-id": TENANT_ID,
  };
  if (includeAuth) {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Clears tokens and persisted user (used on logout and 401). */
export function clearAuthSession(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
}

function redirectToLoginIfNeeded(): void {
  const path = window.location.pathname;
  if (path === "/login" || path.startsWith("/login/")) return;
  window.location.replace("/login");
}

export type ApiWrappedSuccess<T> = {
  statusCode: number;
  data: T;
  message: string;
  error: null;
};

export type ApiWrappedError = {
  statusCode: number;
  data: null;
  message: string;
  error: unknown;
};

/**
 * Low-level fetch with tenant + optional Bearer token.
 * @param skipAuth - omit Authorization (e.g. login). Still sends `x-tenant-id`.
 */
export async function apiRequest(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<Response> {
  const { skipAuth = false, headers: initHeaders, ...rest } = options;

  const merged = new Headers();
  const defaults = getDefaultHeaders(!skipAuth);
  Object.entries(defaults).forEach(([k, v]) => merged.set(k, v));

  if (rest.body != null && !merged.has("Content-Type")) {
    // Let the browser set multipart boundary for FormData
    if (!(rest.body instanceof FormData)) {
      merged.set("Content-Type", "application/json");
    }
  }

  if (initHeaders) {
    new Headers(initHeaders).forEach((value, key) => merged.set(key, value));
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    headers: merged,
  });

  if (response.status === 401 && !skipAuth) {
    clearAuthSession();
    redirectToLoginIfNeeded();
  }

  return response;
}

/** Parse JSON body; returns null if empty or non-JSON. */
export async function parseJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const apiClient = {
  get(path: string, init?: RequestInit) {
    return apiRequest(path, { ...init, method: "GET" });
  },
  post(path: string, body?: unknown, init?: RequestInit) {
    return apiRequest(path, {
      ...init,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : init?.body,
    });
  },
  put(path: string, body?: unknown, init?: RequestInit) {
    return apiRequest(path, {
      ...init,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : init?.body,
    });
  },
  patch(path: string, body?: unknown, init?: RequestInit) {
    return apiRequest(path, {
      ...init,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : init?.body,
    });
  },
  delete(path: string, init?: RequestInit) {
    return apiRequest(path, { ...init, method: "DELETE" });
  },
};
