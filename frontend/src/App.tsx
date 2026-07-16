import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import UsersPage, { PermissionsPage, RoleCreatePage, RolesPage, UserCreatePage } from "./features/admin/AccessPage";
import AuthPage from "./features/auth/AuthPage";
import { CategoriesPage, CategoryCreatePage, UnitCreatePage, UnitsPage } from "./features/catalog/CatalogPage";
import LocationsPage, { LocationCreatePage } from "./features/locations/LocationsPage";
import InventoryPage from "./features/inventory/InventoryPage";
import OutboundPage, { OutboundCreatePage } from "./features/outbound/OutboundPage";
import PickingPage from "./features/picking/PickingPage";
import CheckingPage from "./features/checking/CheckingPage";
import OutboundExceptions from "./features/outbound/OutboundExceptions";
import PurchasingPage,{PurchaseCreatePage}from"./features/purchasing/PurchasingPage";
import SalesPage,{SalesCreatePage}from"./features/sales/SalesPage";
import ReturnsPage,{ReturnCreatePage}from"./features/returns/ReturnsPage";
import StockCountsPage,{StockCountCreatePage}from"./features/stock-counts/StockCountsPage";
import TransfersPage,{TransferCreatePage}from"./features/transfers/TransfersPage";
import ReportsPage,{DashboardPage}from"./features/reports/ReportsPage";
import PrintPage,{LabelPrintPage}from"./features/print/PrintPage";
import ScannerPage from"./features/scanner/ScannerPage";
import ProductsPage, { ProductCreatePage } from "./features/products/ProductsPage";
import PartnersPage, { PartnerCreatePage } from "./features/partners/PartnersPage";
import ReceiptPage, { ReceiptCreatePage } from "./features/receipts/ReceiptPage";
import { ScrollToTop } from "./components/common/ScrollToTop";
import AppLayout from "./layout/AppLayout";
import {
  accessApi,
  authApi,
  type AccessInfo,
  type SessionUser,
} from "./lib/api";
import { hasPermission } from "./lib/permissions";

function ForbiddenPage() {
  return <p role="alert" className="p-6 text-sm text-error-600">Bạn không có quyền truy cập trang này.</p>;
}

function Workspace({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    accessApi.me().then(setAccess).catch(() => setError("Không thể tải quyền truy cập"));
  }, []);

  async function logout() {
    await authApi.logout();
    onLogout();
  }

  if (error) return <p role="alert">{error}</p>;
  if (!access) return <p role="status">Đang tải ứng dụng…</p>;
  const allow = (permission: string, page: ReactNode) =>
    hasPermission(access.permissions, permission) ? page : <ForbiddenPage />;
  const catalogHome = hasPermission(access.permissions, "catalog.categories.view")
    ? <Navigate to="/catalog/categories" replace />
    : allow("catalog.units.view", <Navigate to="/catalog/units" replace />);

  return (
    <Routes>
      <Route element={<AppLayout access={access} user={user} onLogout={logout} />}>
        <Route index element={allow("reports.view", <DashboardPage />)} />
        <Route path="admin/access" element={allow("admin.users.view", <Navigate to="/admin/users" replace />)} />
        <Route path="admin/users" element={allow("admin.users.view", <UsersPage />)} />
        <Route path="admin/users/create" element={allow("admin.users.view", <UserCreatePage />)} />
        <Route path="admin/roles" element={allow("admin.roles.view", <RolesPage />)} />
        <Route path="admin/roles/create" element={allow("admin.roles.view", <RoleCreatePage />)} />
        <Route path="admin/permissions" element={allow("admin.roles.view", <PermissionsPage />)} />
        <Route path="locations" element={allow("locations.view", <LocationsPage />)} />
        <Route path="locations/create" element={allow("locations.view", <LocationCreatePage />)} />
        <Route path="catalog" element={catalogHome} />
        <Route path="catalog/categories" element={allow("catalog.categories.view", <CategoriesPage />)} />
        <Route path="catalog/categories/create" element={allow("catalog.categories.view", <CategoryCreatePage />)} />
        <Route path="catalog/units" element={allow("catalog.units.view", <UnitsPage />)} />
        <Route path="catalog/units/create" element={allow("catalog.units.view", <UnitCreatePage />)} />
        <Route path="products" element={allow("products.view", <ProductsPage />)} />
        <Route path="products/create" element={allow("products.view", <ProductCreatePage />)} />
        <Route path="partners" element={allow("partners.view", <PartnersPage />)} />
        <Route path="partners/create" element={allow("partners.view", <PartnerCreatePage />)} />
        <Route path="receipts" element={allow("receipts.view", <ReceiptPage />)} />
        <Route path="receipts/create" element={allow("receipts.view", <ReceiptCreatePage />)} />
        <Route path="inventory" element={allow("inventory.view", <InventoryPage />)} />
        <Route path="outbounds" element={allow("outbounds.view", <OutboundPage />)} />
        <Route path="outbounds/create" element={allow("outbounds.view", <OutboundCreatePage />)} />
        <Route path="picking" element={allow("picking.view", <PickingPage />)} />
        <Route path="checking" element={allow("checking.view", <CheckingPage />)} />
        <Route path="outbound-exceptions" element={allow("outbound.exceptions.view", <OutboundExceptions />)} />
        <Route path="purchasing" element={allow("purchasing.view", <PurchasingPage />)} />
        <Route path="purchasing/create" element={allow("purchasing.view", <PurchaseCreatePage />)} />
        <Route path="sales" element={allow("sales.view", <SalesPage />)} />
        <Route path="sales/create" element={allow("sales.view", <SalesCreatePage />)} />
        <Route path="returns" element={allow("returns.view", <ReturnsPage />)} />
        <Route path="returns/create" element={allow("returns.view", <ReturnCreatePage />)} />
        <Route path="stock-counts" element={allow("stockCounts.view", <StockCountsPage />)} />
        <Route path="stock-counts/create" element={allow("stockCounts.view", <StockCountCreatePage />)} />
        <Route path="transfers" element={allow("transfers.view", <TransfersPage />)} />
        <Route path="transfers/create" element={allow("transfers.view", <TransferCreatePage />)} />
        <Route path="reports" element={allow("reports.view", <ReportsPage />)} />
        <Route path="print/documents/:id" element={allow("print.print", <PrintPage />)} />
        <Route path="print/labels/:kind/:id" element={allow("print.print", <LabelPrintPage />)} />
        <Route path="scanner" element={allow("inventory.view", <ScannerPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Root() {
  const [user, setUser] = useState<SessionUser | null>(null);
  if (!user || user.mustChangePassword) return <AuthPage onAuthenticated={setUser} />;
  return <Workspace user={user} onLogout={() => setUser(null)} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Root />
    </BrowserRouter>
  );
}
