import { APP_CONFIG } from "@/config";
import { apiClient } from "@/lib/api-client";
import { buildQuery, unwrapPaginated, unwrapResponse } from "@/services/api";
import type { PaginatedResponse, ApiResponse } from "@/types";
import type { Permission, Role, UserWithRoles } from "@/types/access-control";

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapPermission(raw: unknown): Permission {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    description: r.description != null ? String(r.description) : null,
    createdAt: String(r.createdAt ?? r.created_at ?? ""),
  };
}

function mapRole(raw: unknown): Role {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    description: r.description != null ? String(r.description) : null,
    createdAt: String(r.createdAt ?? r.created_at ?? ""),
    permissionIds: Array.isArray(r.permissionIds) ? (r.permissionIds as string[]) : [],
  };
}

function mapUserWithRoles(raw: unknown): UserWithRoles {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    code: r.code != null ? Number(r.code) : null,
    email: r.email != null ? String(r.email) : null,
    firstName: String(r.firstName ?? r.first_name ?? ""),
    lastName: String(r.lastName ?? r.last_name ?? ""),
    userType: String(r.userType ?? r.user_type ?? ""),
    roleIds: Array.isArray(r.roleIds) ? (r.roleIds as string[]) : [],
    roleNames: Array.isArray(r.roleNames) ? (r.roleNames as string[]) : [],
  };
}

// ─── Mock implementations ─────────────────────────────────────────────────────

let _mockPermissions: Permission[] = [
  { id: "p1", name: "students.index", description: "View students list", createdAt: new Date().toISOString() },
  { id: "p2", name: "students.create", description: "Create students", createdAt: new Date().toISOString() },
  { id: "p3", name: "access-control.index", description: "View roles and permissions", createdAt: new Date().toISOString() },
  { id: "p4", name: "access-control.create", description: "Create roles and permissions", createdAt: new Date().toISOString() },
  { id: "p5", name: "access-control.update", description: "Update roles and permissions", createdAt: new Date().toISOString() },
  { id: "p6", name: "access-control.delete", description: "Delete roles and permissions", createdAt: new Date().toISOString() },
];

let _mockRoles: Role[] = [
  { id: "r1", name: "MANAGER", description: "Tenant administrator", createdAt: new Date().toISOString(), permissionIds: ["p1", "p2", "p3", "p4", "p5", "p6"] },
  { id: "r2", name: "TEACHER", description: "Teacher role", createdAt: new Date().toISOString(), permissionIds: ["p1"] },
];

let _mockUsers: UserWithRoles[] = [
  { id: "u1", code: 1001, email: "admin@school.com", firstName: "Admin", lastName: "User", userType: "MANAGER", roleIds: ["r1"], roleNames: ["MANAGER"] },
  { id: "u2", code: 1002, email: "teacher@school.com", firstName: "John", lastName: "Doe", userType: "TEACHER", roleIds: ["r2"], roleNames: ["TEACHER"] },
];

function paginate<T>(items: T[], page: number, limit: number): PaginatedResponse<T> {
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);
  return { data, total: items.length, page, limit, totalPages: Math.ceil(items.length / limit), message: "OK", success: true, statusCode: 200 };
}

const mockApi = {
  permissions: {
    getAll: async (params: { page: number; limit: number; search?: string }): Promise<PaginatedResponse<Permission>> => {
      let items = _mockPermissions;
      if (params.search) items = items.filter((p) => p.name.includes(params.search!));
      return paginate(items, params.page, params.limit);
    },
    sync: async (): Promise<ApiResponse<{ synced: number }>> => ({
      data: { synced: _mockPermissions.length },
      message: "Synced",
      success: true,
      statusCode: 200,
    }),
    create: async (data: { name: string; description?: string }): Promise<ApiResponse<Permission>> => {
      const p: Permission = { id: crypto.randomUUID(), name: data.name, description: data.description ?? null, createdAt: new Date().toISOString() };
      _mockPermissions.push(p);
      return { data: p, message: "Created", success: true, statusCode: 201 };
    },
    update: async (id: string, data: { name?: string; description?: string }): Promise<ApiResponse<Permission>> => {
      const idx = _mockPermissions.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error("Not found");
      _mockPermissions[idx] = { ..._mockPermissions[idx], ...data };
      return { data: _mockPermissions[idx], message: "Updated", success: true, statusCode: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<null>> => {
      _mockPermissions = _mockPermissions.filter((p) => p.id !== id);
      return { data: null, message: "Deleted", success: true, statusCode: 200 };
    },
  },
  roles: {
    getAll: async (params: { page: number; limit: number; search?: string }): Promise<PaginatedResponse<Role>> => {
      let items = _mockRoles;
      if (params.search) items = items.filter((r) => r.name.includes(params.search!));
      return paginate(items, params.page, params.limit);
    },
    create: async (data: { name: string; description?: string; permissionIds?: string[] }): Promise<ApiResponse<Role>> => {
      const r: Role = { id: crypto.randomUUID(), name: data.name, description: data.description ?? null, createdAt: new Date().toISOString(), permissionIds: data.permissionIds ?? [] };
      _mockRoles.push(r);
      return { data: r, message: "Created", success: true, statusCode: 201 };
    },
    update: async (id: string, data: { name?: string; description?: string; permissionIds?: string[] }): Promise<ApiResponse<Role>> => {
      const idx = _mockRoles.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error("Not found");
      _mockRoles[idx] = { ..._mockRoles[idx], ...data };
      return { data: _mockRoles[idx], message: "Updated", success: true, statusCode: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<null>> => {
      _mockRoles = _mockRoles.filter((r) => r.id !== id);
      return { data: null, message: "Deleted", success: true, statusCode: 200 };
    },
  },
  users: {
    getAll: async (params: { page: number; limit: number; search?: string }): Promise<PaginatedResponse<UserWithRoles>> => {
      let items = _mockUsers;
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
      }
      return paginate(items, params.page, params.limit);
    },
    setRoles: async (userId: string, roleIds: string[]): Promise<ApiResponse<null>> => {
      const idx = _mockUsers.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        _mockUsers[idx].roleIds = roleIds;
        _mockUsers[idx].roleNames = roleIds.map((rid) => _mockRoles.find((r) => r.id === rid)?.name ?? rid);
      }
      return { data: null, message: "Updated", success: true, statusCode: 200 };
    },
  },
};

// ─── Real API implementations ─────────────────────────────────────────────────

const realApi = {
  permissions: {
    getAll: async (params: { page: number; limit: number; search?: string }): Promise<PaginatedResponse<Permission>> => {
      const qs = buildQuery({ page: params.page, limit: params.limit, search: params.search });
      const res = await apiClient.get(`permissions${qs}`);
      return unwrapPaginated(res, mapPermission);
    },
    sync: async (): Promise<ApiResponse<{ synced: number }>> => {
      const res = await apiClient.post("permissions/sync");
      return unwrapResponse<{ synced: number }>(res);
    },
    create: async (data: { name: string; description?: string }): Promise<ApiResponse<Permission>> => {
      const res = await apiClient.post("permissions", data);
      return unwrapResponse<Permission>(res);
    },
    update: async (id: string, data: { name?: string; description?: string }): Promise<ApiResponse<Permission>> => {
      const res = await apiClient.patch(`permissions/${id}`, data);
      return unwrapResponse<Permission>(res);
    },
    delete: async (id: string): Promise<ApiResponse<null>> => {
      const res = await apiClient.delete(`permissions/${id}`);
      return unwrapResponse<null>(res);
    },
  },
  roles: {
    getAll: async (params: { page: number; limit: number; search?: string }): Promise<PaginatedResponse<Role>> => {
      const qs = buildQuery({ page: params.page, limit: params.limit, search: params.search });
      const res = await apiClient.get(`roles${qs}`);
      return unwrapPaginated(res, mapRole);
    },
    create: async (data: { name: string; description?: string; permissionIds?: string[] }): Promise<ApiResponse<Role>> => {
      const res = await apiClient.post("roles", data);
      return unwrapResponse<Role>(res);
    },
    update: async (id: string, data: { name?: string; description?: string; permissionIds?: string[] }): Promise<ApiResponse<Role>> => {
      const res = await apiClient.patch(`roles/${id}`, data);
      return unwrapResponse<Role>(res);
    },
    delete: async (id: string): Promise<ApiResponse<null>> => {
      const res = await apiClient.delete(`roles/${id}`);
      return unwrapResponse<null>(res);
    },
  },
  users: {
    getAll: async (params: { page: number; limit: number; search?: string }): Promise<PaginatedResponse<UserWithRoles>> => {
      const qs = buildQuery({ page: params.page, limit: params.limit, search: params.search });
      const res = await apiClient.get(`roles/users${qs}`);
      return unwrapPaginated(res, mapUserWithRoles);
    },
    setRoles: async (userId: string, roleIds: string[]): Promise<ApiResponse<null>> => {
      const res = await apiClient.patch(`roles/users/${userId}`, { roleIds });
      return unwrapResponse<null>(res);
    },
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const accessControlApi = APP_CONFIG.USE_MOCK_API ? mockApi : realApi;
