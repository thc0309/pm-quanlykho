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

export interface CatalogCategory {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  status: "active" | "inactive";
}

export interface CatalogUnit {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  baseUnitId: string | null;
  conversionFactor: string;
  status: "active" | "inactive";
}

export interface CatalogClient {
  listCategories(): Promise<CatalogCategory[]>;
  createCategory(input: Pick<CatalogCategory, "code" | "name">): Promise<CatalogCategory>;
  listUnits(): Promise<CatalogUnit[]>;
  createUnit(input: {
    code: string;
    name: string;
    baseUnitId?: string;
    conversionFactor?: string;
  }): Promise<CatalogUnit>;
}

export interface Product {
  id: string;
  warehouseId: string;
  categoryId: string | null;
  baseUnitId: string | null;
  sku: string;
  name: string;
  productType: "stock" | "non_stock" | "service";
  trackingMode: "none" | "lot" | "serial";
  expiryManaged: boolean;
  fefoEnabled: boolean;
  status: "active" | "inactive";
  barcodes: string[];
}

export interface ProductClient {
  listProducts(): Promise<Product[]>;
  createProduct(input: {
    sku: string;
    name: string;
    productType: Product["productType"];
    trackingMode: Product["trackingMode"];
    expiryManaged: boolean;
    fefoEnabled: boolean;
    barcodes: string[];
  }): Promise<Product>;
  findProductByBarcode(barcode: string): Promise<Product>;
}

export interface Partner {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  kind: "customer" | "supplier";
  taxCode: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "active" | "inactive";
}

export interface PartnerClient {
  listPartners(): Promise<Partner[]>;
  createPartner(input: Omit<Partner, "id" | "warehouseId" | "status">): Promise<Partner>;
  updatePartner(id: string, input: Partial<Pick<Partner, "name" | "taxCode" | "phone" | "email" | "address">>): Promise<Partner>;
  setPartnerStatus(id: string, status: Partner["status"]): Promise<Partner>;
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

export const catalogApi: CatalogClient = {
  async listCategories() {
    return (await request<{ data: CatalogCategory[] }>("/api/catalog/categories")).data;
  },
  async createCategory(input) {
    return (await request<{ category: CatalogCategory }>("/api/catalog/categories", { method: "POST", body: JSON.stringify(input) })).category;
  },
  async listUnits() {
    return (await request<{ data: CatalogUnit[] }>("/api/catalog/units")).data;
  },
  async createUnit(input) {
    return (await request<{ unit: CatalogUnit }>("/api/catalog/units", { method: "POST", body: JSON.stringify(input) })).unit;
  },
};

export const productApi: ProductClient = {
  async listProducts() {
    return (await request<{ data: Product[] }>("/api/products")).data;
  },
  async createProduct(input) {
    return (await request<{ product: Product }>("/api/products", { method: "POST", body: JSON.stringify(input) })).product;
  },
  async findProductByBarcode(barcode) {
    return (await request<{ product: Product }>(`/api/products/lookup/${encodeURIComponent(barcode)}`)).product;
  },
};

export const partnerApi: PartnerClient = {
  async listPartners() {
    return (await request<{ data: Partner[] }>("/api/partners")).data;
  },
  async createPartner(input) {
    return (await request<{ partner: Partner }>("/api/partners", { method: "POST", body: JSON.stringify(input) })).partner;
  },
  async updatePartner(id, input) {
    return (await request<{ partner: Partner }>(`/api/partners/${id}`, { method: "PATCH", body: JSON.stringify(input) })).partner;
  },
  async setPartnerStatus(id, status) {
    return (await request<{ partner: Partner }>(`/api/partners/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })).partner;
  },
};
