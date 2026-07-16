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
      ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
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
  phone: string;
  avatarUrl: string | null;
  employeeCode: string | null;
  jobTitle: string | null;
  department: string | null;
  note: string | null;
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

export interface PermissionFeature {
  featureCode: string;
  featureLabel: string;
  actions: Array<{ action: string; label: string; code: string }>;
}

export interface AdminClient {
  listUsers(): Promise<AdminUser[]>;
  createUser(input: Pick<AdminUser, "email" | "fullName" | "phone"> & Partial<Pick<AdminUser, "employeeCode" | "jobTitle" | "department" | "note">>): Promise<{
    user: AdminUser;
    temporaryPassword: string;
  }>; 
  updateUser(id: string, input: Partial<Pick<AdminUser, "email" | "fullName" | "phone" | "employeeCode" | "jobTitle" | "department" | "note">>): Promise<AdminUser>;
  uploadUserAvatar(id: string, file: File): Promise<AdminUser>;
  setUserStatus(id: string, status: AdminUser["status"]): Promise<AdminUser>;
  listRoles(): Promise<AdminRole[]>;
  listPermissionCatalog(): Promise<PermissionFeature[]>;
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
  updateCategory(id: string, input: Pick<CatalogCategory, "name">): Promise<CatalogCategory>;
  setCategoryStatus(id: string, status: CatalogCategory["status"]): Promise<CatalogCategory>;
  listUnits(): Promise<CatalogUnit[]>;
  createUnit(input: {
    code: string;
    name: string;
    baseUnitId?: string;
    conversionFactor?: string;
  }): Promise<CatalogUnit>;
  updateUnit(id: string, input: Pick<CatalogUnit, "name">): Promise<CatalogUnit>;
  setUnitStatus(id: string, status: CatalogUnit["status"]): Promise<CatalogUnit>;
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

export interface Receipt {
  id: string;
  documentNo: string;
  status: "draft" | "confirmed" | "cancelled" | "reversed";
  lineCount: number;
  confirmedAt: string | null;
  createdAt: string;
}

export interface ReceiptInput {
  documentNo: string;
  lines: Array<{
    locationId: string;
    productId: string;
    quantity: number;
    lotCode?: string;
    serialCode?: string;
    manufacturedAt?: string;
    expiresAt?: string;
  }>;
}

export interface ReceiptClient {
  listReceipts(): Promise<Receipt[]>;
  createReceipt(input: ReceiptInput): Promise<{ id: string }>;
  confirmReceipt(id: string): Promise<{ alreadyConfirmed: boolean }>;
  listLocations(): Promise<Array<{ id: string; code: string; name: string }>>;
  listProducts(): Promise<Array<{
    id: string;
    sku: string;
    name: string;
    trackingMode: Product["trackingMode"];
    expiryManaged: boolean;
  }>>;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface InventoryBalance {
  id?: string;
  warehouseId: string;
  locationId: string;
  locationCode: string;
  productId: string;
  sku: string;
  productName: string;
  lotCode: string | null;
  serialCode: string | null;
  onHand: number;
  committed: number;
  available: number;
}

export interface InventoryLot {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  lotCode: string;
  manufacturedAt: string | null;
  expiresAt: string | null;
  onHand: number;
}

export interface InventorySerial {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  serialCode: string;
  status: "in_stock" | "issued" | "returned" | "scrapped";
  locationCode: string | null;
  onHand: number;
}

export interface InventoryMovement {
  id: string;
  documentNo: string;
  documentType: string;
  locationCode: string | null;
  productId: string;
  sku: string;
  productName: string;
  lotCode: string | null;
  serialCode: string | null;
  quantityDelta: number;
  createdAt: string;
}

type InventoryPage<T> = { data: T[]; pagination: PaginationInfo };
type InventoryParams = { page: number; q: string };

export interface InventoryClient {
  listBalances(params: InventoryParams): Promise<InventoryPage<InventoryBalance>>;
  listLots(params: InventoryParams): Promise<InventoryPage<InventoryLot>>;
  listSerials(params: InventoryParams): Promise<InventoryPage<InventorySerial>>;
  listMovements(params: InventoryParams): Promise<InventoryPage<InventoryMovement>>;
}

export interface Outbound {
  id: string;
  documentNo: string;
  status: "draft" | "ready_to_pick" | "picking" | "picked" | "checking" | "needs_repick" | "shipped" | "cancelled";
  lineCount: number;
  reservedUntil: string | null;
  createdAt: string;
}

export interface OutboundClient {
  listOutbounds(): Promise<Outbound[]>;
  createOutbound(input: { documentNo: string; lines: Array<{ productId: string; quantity: number }> }): Promise<{ id: string }>;
  releaseOutbound(id: string): Promise<{ alreadyReleased: boolean; reservedUntil: string }>;
  listProducts(): Promise<Array<{ id: string; sku: string; name: string }>>;
}
export interface PickingItem { id: string; documentNo: string; status: "ready_to_pick" | "picking" | "needs_repick"; pickerUserId: string | null; version: number }
export interface PickingClient {
  list(): Promise<PickingItem[]>;
  claim(id: string): Promise<{ resumed: boolean }>;
  scan(id: string, input: { locationBarcode: string; itemBarcode: string }): Promise<{ picked: number; required: number }>;
  confirm(id: string): Promise<void>;
}
export interface CheckingItem { id:string;documentNo:string;status:"picked"|"checking";checkerUserId:string|null;version:number }
export interface CheckingClient {list():Promise<CheckingItem[]>;claim(id:string):Promise<{resumed:boolean;version:number}>;scan(id:string,input:{locationBarcode:string;itemBarcode:string}):Promise<{checked:number;required:number}>;ship(id:string,input:{idempotencyKey:string;version:number}):Promise<{alreadyShipped:boolean}>}
export interface OutboundExceptionItem{id:string;documentNo:string;status:Outbound["status"];pickerUserId:string|null;checkerUserId:string|null;version:number}
export interface OutboundExceptionClient{list():Promise<OutboundExceptionItem[]>;mismatch(id:string):Promise<void>;approveShort(id:string,reason:string):Promise<void>;cancel(id:string,reason:string):Promise<void>;reassign(id:string,input:{pickerUserId?:string;checkerUserId?:string;reason:string}):Promise<void>}
export interface PurchaseOrder{id:string;orderNo:string;status:"draft"|"approved"|"closed"|"cancelled";supplierName:string;lineCount:number;outstandingQuantity:number}
export interface PurchasingClient{list():Promise<PurchaseOrder[]>;create(input:{orderNo:string;supplierId:string;lines:Array<{productId:string;quantity:number}>}):Promise<{id:string}>;approve(id:string):Promise<void>;listSuppliers():Promise<Array<{id:string;code:string;name:string}>>;listProducts():Promise<Array<{id:string;sku:string;name:string}>>}
export interface SalesDocument{id:string;documentNo:string;kind:"quote"|"order"|"invoice";status:string;customerName:string;total:number}
export interface SalesClient{list():Promise<SalesDocument[]>;create(input:{documentNo:string;kind:"quote"|"order";customerId:string;lines:Array<{productId:string;quantity:number;unitPrice:number;taxRate:number}>}):Promise<{id:string}>;approve(id:string):Promise<{outboundId:string|null}>;invoice(id:string,documentNo:string):Promise<{id:string}>;listCustomers():Promise<Array<{id:string;code:string;name:string}>>;listProducts():Promise<Array<{id:string;sku:string;name:string}>>}
export interface StockReturn{id:string;returnNo:string;kind:"customer"|"supplier";status:"draft"|"confirmed"|"cancelled";originalDocumentNo:string;lineCount:number}
export interface ReturnClient{list():Promise<StockReturn[]>;create(input:{returnNo:string;kind:"customer"|"supplier";originalDocumentId:string;lines:Array<{originalMovementId:string;quantity:number}>}):Promise<{id:string}>;confirm(id:string):Promise<{alreadyConfirmed:boolean}>}
export interface StockCount{id:string;countNo:string;status:"draft"|"submitted"|"confirmed"|"cancelled";lineCount:number;countedLines:number}
export interface StockCountClient{list():Promise<StockCount[]>;create(input:{countNo:string;stockBalanceIds:string[]}):Promise<{id:string}>;submit(id:string):Promise<void>;approve(id:string):Promise<void>;listBalances():Promise<InventoryBalance[]>}
export interface Transfer{id:string;transferNo:string;status:"draft"|"in_transit"|"received"|"cancelled"|"reversed";sourceWarehouse:string;targetWarehouse:string;lineCount:number;quantity:number}
export interface TransferClient{list():Promise<Transfer[]>;create(input:{transferNo:string;targetWarehouseId:string;lines:Array<{stockBalanceId:string;quantity:number}>}):Promise<{id:string}>;dispatch(id:string):Promise<void>;receive(id:string,input:{lines:Array<{transferLineId:string;targetLocationId:string}>}):Promise<void>;cancel(id:string):Promise<void>;listBalances():Promise<InventoryBalance[]>}
export interface DashboardSummary{onHand:number;committed:number;available:number;expiringLots:number;movementsToday:number}
export interface ReportRow{sku:string;productName:string;locationCode:string;lotCode:string|null;serialCode:string|null;onHand:number}
export interface ReportClient{dashboard():Promise<DashboardSummary>;inventory(params:{page:number;q:string}):Promise<{data:ReportRow[];pagination:PaginationInfo}>;exportUrl(q:string):string}
export interface PrintableDocument{document:{id:string;documentNo:string;documentType:string;status:string;confirmedAt:string;partnerName:string|null;warehouseName:string};lines:Array<{sku:string;productName:string;quantity:number;locationCode:string|null;lotCode:string|null;serialCode:string|null}>}
export interface PrintClient{document(id:string):Promise<PrintableDocument>;label(kind:string,id:string):Promise<{code:string;name:string;kind:string;expiresAt?:string}>}

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
  async updateUser(id, input) {
    return (
      await request<{ user: AdminUser }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
    ).user;
  },
  async uploadUserAvatar(id, file) {
    const body = new FormData();
    body.set("avatar", file);
    return (
      await request<{ user: AdminUser }>(`/api/admin/users/${id}/avatar`, {
        method: "POST",
        body,
      })
    ).user;
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
  async listPermissionCatalog() {
    return (await request<{ data: PermissionFeature[] }>("/api/admin/permissions")).data;
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
  async updateCategory(id, input) {
    return (await request<{ category: CatalogCategory }>(`/api/catalog/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) })).category;
  },
  async setCategoryStatus(id, status) {
    return (await request<{ category: CatalogCategory }>(`/api/catalog/categories/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })).category;
  },
  async listUnits() {
    return (await request<{ data: CatalogUnit[] }>("/api/catalog/units")).data;
  },
  async createUnit(input) {
    return (await request<{ unit: CatalogUnit }>("/api/catalog/units", { method: "POST", body: JSON.stringify(input) })).unit;
  },
  async updateUnit(id, input) {
    return (await request<{ unit: CatalogUnit }>(`/api/catalog/units/${id}`, { method: "PATCH", body: JSON.stringify(input) })).unit;
  },
  async setUnitStatus(id, status) {
    return (await request<{ unit: CatalogUnit }>(`/api/catalog/units/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })).unit;
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

export const receiptApi: ReceiptClient = {
  async listReceipts() {
    return (await request<{ data: Receipt[] }>("/api/receipts")).data;
  },
  async createReceipt(input) {
    return (await request<{ receipt: { id: string } }>("/api/receipts", {
      method: "POST",
      body: JSON.stringify(input),
    })).receipt;
  },
  async confirmReceipt(id) {
    return (await request<{ result: { alreadyConfirmed: boolean } }>(`/api/receipts/${id}/confirm`, { method: "POST" })).result;
  },
  async listLocations() {
    return (await request<{ data: WarehouseLocation[] }>("/api/locations")).data;
  },
  async listProducts() {
    return (await request<{ data: Product[] }>("/api/products")).data;
  },
};

function inventoryPath(resource: string, params: InventoryParams) {
  const query = new URLSearchParams({ page: String(params.page), pageSize: "20" });
  if (params.q) query.set("q", params.q);
  return `/api/inventory/${resource}?${query}`;
}

export const inventoryApi: InventoryClient = {
  listBalances(params) { return request(inventoryPath("balances", params)); },
  listLots(params) { return request(inventoryPath("lots", params)); },
  listSerials(params) { return request(inventoryPath("serials", params)); },
  listMovements(params) { return request(inventoryPath("movements", params)); },
};

export const outboundApi: OutboundClient = {
  async listOutbounds() { return (await request<{ data: Outbound[] }>("/api/outbounds?pageSize=50")).data; },
  async createOutbound(input) {
    return (await request<{ outbound: { id: string } }>("/api/outbounds", { method: "POST", body: JSON.stringify(input) })).outbound;
  },
  async releaseOutbound(id) {
    return (await request<{ result: { alreadyReleased: boolean; reservedUntil: string } }>(`/api/outbounds/${id}/release`, { method: "POST" })).result;
  },
  async listProducts() { return (await request<{ data: Product[] }>("/api/products?pageSize=100")).data; },
};
export const pickingApi: PickingClient = {
  async list() { return (await request<{ data: PickingItem[] }>("/api/picking?pageSize=50")).data; },
  async claim(id) { return (await request<{ result: { resumed: boolean } }>(`/api/picking/${id}/claim`, { method: "POST" })).result; },
  async scan(id,input) { return (await request<{ progress: { picked: number; required: number } }>(`/api/picking/${id}/scan`, { method: "POST", body: JSON.stringify(input) })).progress; },
  async confirm(id) { await request(`/api/picking/${id}/confirm`, { method: "POST" }); },
};
export const checkingApi:CheckingClient={async list(){return(await request<{data:CheckingItem[]}>("/api/checking?pageSize=50")).data;},async claim(id){return(await request<{result:{resumed:boolean;version:number}}>(`/api/checking/${id}/claim`,{method:"POST"})).result;},async scan(id,input){return(await request<{progress:{checked:number;required:number}}>(`/api/checking/${id}/scan`,{method:"POST",body:JSON.stringify(input)})).progress;},async ship(id,input){return(await request<{result:{alreadyShipped:boolean}}>(`/api/checking/${id}/ship`,{method:"POST",body:JSON.stringify(input)})).result;}};
export const outboundExceptionApi:OutboundExceptionClient={async list(){return(await request<{data:OutboundExceptionItem[]}>("/api/outbound-exceptions?pageSize=50")).data;},async mismatch(id){await request(`/api/outbound-exceptions/${id}/mismatch`,{method:"POST"});},async approveShort(id,reason){await request(`/api/outbound-exceptions/${id}/approve-short`,{method:"POST",body:JSON.stringify({reason})});},async cancel(id,reason){await request(`/api/outbound-exceptions/${id}/cancel`,{method:"POST",body:JSON.stringify({reason})});},async reassign(id,input){await request(`/api/outbound-exceptions/${id}/reassign`,{method:"POST",body:JSON.stringify(input)});}};
export const purchasingApi:PurchasingClient={async list(){return(await request<{data:PurchaseOrder[]}>("/api/purchase-orders?pageSize=50")).data;},async create(input){return(await request<{purchaseOrder:{id:string}}>("/api/purchase-orders",{method:"POST",body:JSON.stringify(input)})).purchaseOrder;},async approve(id){await request(`/api/purchase-orders/${id}/approve`,{method:"POST"});},async listSuppliers(){return(await request<{data:Partner[]}>("/api/partners?pageSize=100")).data.filter(p=>p.kind==="supplier");},async listProducts(){return(await request<{data:Product[]}>("/api/products?pageSize=100")).data;}};
export const salesApi:SalesClient={async list(){return(await request<{data:SalesDocument[]}>("/api/sales?pageSize=50")).data;},async create(input){return(await request<{document:{id:string}}>("/api/sales",{method:"POST",body:JSON.stringify(input)})).document;},async approve(id){return(await request<{result:{outboundId:string|null}}>(`/api/sales/${id}/approve`,{method:"POST"})).result;},async invoice(id,documentNo){return(await request<{invoice:{id:string}}>(`/api/sales/${id}/invoice`,{method:"POST",body:JSON.stringify({documentNo})})).invoice;},async listCustomers(){return(await request<{data:Partner[]}>("/api/partners?pageSize=100")).data.filter(p=>p.kind==="customer");},async listProducts(){return(await request<{data:Product[]}>("/api/products?pageSize=100")).data;}};
export const returnApi:ReturnClient={async list(){return(await request<{data:StockReturn[]}>("/api/returns?pageSize=50")).data;},async create(input){return(await request<{return:{id:string}}>("/api/returns",{method:"POST",body:JSON.stringify(input)})).return;},async confirm(id){return(await request<{result:{alreadyConfirmed:boolean}}>(`/api/returns/${id}/confirm`,{method:"POST"})).result;}};
export const stockCountApi:StockCountClient={async list(){return(await request<{data:StockCount[]}>("/api/stock-counts?pageSize=50")).data;},async create(input){return(await request<{stockCount:{id:string}}>("/api/stock-counts",{method:"POST",body:JSON.stringify(input)})).stockCount;},async submit(id){await request(`/api/stock-counts/${id}/submit`,{method:"POST"});},async approve(id){await request(`/api/stock-counts/${id}/approve`,{method:"POST"});},async listBalances(){return(await request<{data:InventoryBalance[]}>("/api/inventory/balances?pageSize=100")).data;}};
export const transferApi:TransferClient={async list(){return(await request<{data:Transfer[]}>("/api/transfers?pageSize=50")).data;},async create(input){return(await request<{transfer:{id:string}}>("/api/transfers",{method:"POST",body:JSON.stringify(input)})).transfer;},async dispatch(id){await request(`/api/transfers/${id}/dispatch`,{method:"POST"});},async receive(id,input){await request(`/api/transfers/${id}/receive`,{method:"POST",body:JSON.stringify(input)});},async cancel(id){await request(`/api/transfers/${id}/cancel`,{method:"POST"});},async listBalances(){return(await request<{data:InventoryBalance[]}>("/api/inventory/balances?pageSize=100")).data;}};
export const reportApi:ReportClient={async dashboard(){return(await request<{summary:DashboardSummary}>("/api/reports/dashboard")).summary;},inventory({page,q}){const p=new URLSearchParams({page:String(page),pageSize:"20"});if(q)p.set("q",q);return request(`/api/reports/inventory?${p}`);},exportUrl(q){const p=new URLSearchParams({limit:"5000"});if(q)p.set("q",q);return `/api/reports/inventory.csv?${p}`;}};
export const printApi:PrintClient={document(id){return request(`/api/print/documents/${id}`);},async label(kind,id){return(await request<{label:{code:string;name:string;kind:string;expiresAt?:string}}>(`/api/print/labels/${kind}/${id}`)).label;}};
