export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  kind: "master_admin" | "warehouse_admin" | "warehouse_user";
  warehouseId: string | null;
  mustChangePassword: boolean;
  status: "active" | "inactive";
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.message ?? "Không thể xử lý yêu cầu",
    );
  }
  return body as T;
}

export interface AuthClient {
  session(): Promise<SessionUser>;
  login(email: string, password: string): Promise<SessionUser>;
  changePassword(password: string): Promise<void>;
  logout(): Promise<void>;
}

export interface AccessInfo {
  userId: string;
  warehouseId: string | null;
  kind: SessionUser["kind"];
  permissions: string[];
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  kind: "warehouse_admin" | "warehouse_user";
  warehouseId: string;
  status: "active" | "inactive";
}

export interface AdminRole {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  permissions: string[];
}

export interface AdminClient {
  listUsers(): Promise<AdminUser[]>;
  createUser(input: { email: string; fullName: string }): Promise<{
    user: AdminUser;
    temporaryPassword: string;
  }>;
  setUserStatus(id: string, status: AdminUser["status"]): Promise<AdminUser>;
  listRoles(): Promise<AdminRole[]>;
  createRole(input: {
    code: string;
    name: string;
    permissions: string[];
  }): Promise<AdminRole>;
  setUserRoles(userId: string, roleIds: string[]): Promise<void>;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  barcode: string;
  name: string;
  type: "storage" | "staging" | "shipping";
  status: "active" | "inactive";
}

export interface LocationClient {
  listLocations(): Promise<WarehouseLocation[]>;
  createLocation(input: Pick<WarehouseLocation, "code" | "barcode" | "name" | "type">): Promise<WarehouseLocation>;
  findLocationByBarcode(barcode: string): Promise<WarehouseLocation>;
}

export const authApi: AuthClient = {
  async session() {
    return (await request<{ user: SessionUser }>("/api/auth/session")).user;
  },
  async login(email, password) {
    return (
      await request<{ user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
    ).user;
  },
  changePassword(password) {
    return request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
  logout() {
    return request("/api/auth/logout", { method: "POST" });
  },
};

export const accessApi = {
  async me() {
    return (await request<{ access: AccessInfo }>("/api/access/me")).access;
  },
};

export const adminApi: AdminClient = {
  async listUsers() {
    return (await request<{ data: AdminUser[] }>("/api/admin/users")).data;
  },
  async createUser(input) {
    return request("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async setUserStatus(id, status) {
    return (
      await request<{ user: AdminUser }>(`/api/admin/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
    ).user;
  },
  async listRoles() {
    return (await request<{ data: AdminRole[] }>("/api/admin/roles")).data;
  },
  async createRole(input) {
    return (
      await request<{ role: AdminRole }>("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).role;
  },
  setUserRoles(userId, roleIds) {
    return request(`/api/admin/users/${userId}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roleIds }),
    });
  },
};

export const locationApi: LocationClient = {
  async listLocations() {
    return (await request<{ data: WarehouseLocation[] }>("/api/locations")).data;
  },
  async createLocation(input) {
    return (await request<{ location: WarehouseLocation }>("/api/locations", { method: "POST", body: JSON.stringify(input) })).location;
  },
  async findLocationByBarcode(barcode) {
    return (await request<{ location: WarehouseLocation }>(`/api/locations/lookup/${encodeURIComponent(barcode)}`)).location;
  },
};
