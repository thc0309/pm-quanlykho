import { useEffect, useState } from "react";
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
  const canManage = access.permissions.includes("*") || access.permissions.includes("admin.access.manage");
  const canCatalog = canManage || access.permissions.includes("catalog.manage");
  const canProducts = canManage || access.permissions.includes("products.manage");
  const canPartners = canManage || access.permissions.includes("partners.manage");
  const canStock = canManage || access.permissions.includes("stock.manage");

  return (
    <Routes>
      <Route element={<AppLayout access={access} user={user} onLogout={logout} />}>
        <Route index element={<DashboardPage />} />
        <Route path="admin/access" element={<Navigate to="/admin/users" replace />} />
        <Route path="admin/users" element={canManage ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="admin/users/create" element={canManage ? <UserCreatePage /> : <Navigate to="/" replace />} />
        <Route path="admin/roles" element={canManage ? <RolesPage /> : <Navigate to="/" replace />} />
        <Route path="admin/roles/create" element={canManage ? <RoleCreatePage /> : <Navigate to="/" replace />} />
        <Route path="admin/permissions" element={canManage ? <PermissionsPage /> : <Navigate to="/" replace />} />
        <Route path="locations" element={canManage ? <LocationsPage /> : <Navigate to="/" replace />} />
        <Route path="locations/create" element={canManage ? <LocationCreatePage /> : <Navigate to="/" replace />} />
        <Route path="catalog" element={<Navigate to="/catalog/categories" replace />} />
        <Route path="catalog/categories" element={canCatalog ? <CategoriesPage /> : <Navigate to="/" replace />} />
        <Route path="catalog/categories/create" element={canCatalog ? <CategoryCreatePage /> : <Navigate to="/" replace />} />
        <Route path="catalog/units" element={canCatalog ? <UnitsPage /> : <Navigate to="/" replace />} />
        <Route path="catalog/units/create" element={canCatalog ? <UnitCreatePage /> : <Navigate to="/" replace />} />
        <Route path="products" element={canProducts ? <ProductsPage /> : <Navigate to="/" replace />} />
        <Route path="products/create" element={canProducts ? <ProductCreatePage /> : <Navigate to="/" replace />} />
        <Route path="partners" element={canPartners ? <PartnersPage /> : <Navigate to="/" replace />} />
        <Route path="partners/create" element={canPartners ? <PartnerCreatePage /> : <Navigate to="/" replace />} />
        <Route path="receipts" element={canStock ? <ReceiptPage /> : <Navigate to="/" replace />} />
        <Route path="receipts/create" element={canStock ? <ReceiptCreatePage /> : <Navigate to="/" replace />} />
        <Route path="inventory" element={canStock ? <InventoryPage /> : <Navigate to="/" replace />} />
        <Route path="outbounds" element={canStock ? <OutboundPage /> : <Navigate to="/" replace />} />
        <Route path="outbounds/create" element={canStock ? <OutboundCreatePage /> : <Navigate to="/" replace />} />
        <Route path="picking" element={canStock ? <PickingPage /> : <Navigate to="/" replace />} />
        <Route path="checking" element={canStock ? <CheckingPage /> : <Navigate to="/" replace />} />
        <Route path="outbound-exceptions" element={canStock ? <OutboundExceptions /> : <Navigate to="/" replace />} />
        <Route path="purchasing" element={canStock ? <PurchasingPage /> : <Navigate to="/" replace />} />
        <Route path="purchasing/create" element={canStock ? <PurchaseCreatePage /> : <Navigate to="/" replace />} />
        <Route path="sales" element={canStock ? <SalesPage /> : <Navigate to="/" replace />} />
        <Route path="sales/create" element={canStock ? <SalesCreatePage /> : <Navigate to="/" replace />} />
        <Route path="returns" element={canStock ? <ReturnsPage /> : <Navigate to="/" replace />} />
        <Route path="returns/create" element={canStock ? <ReturnCreatePage /> : <Navigate to="/" replace />} />
        <Route path="stock-counts" element={canStock ? <StockCountsPage /> : <Navigate to="/" replace />} />
        <Route path="stock-counts/create" element={canStock ? <StockCountCreatePage /> : <Navigate to="/" replace />} />
        <Route path="transfers" element={canStock ? <TransfersPage /> : <Navigate to="/" replace />} />
        <Route path="transfers/create" element={canStock ? <TransferCreatePage /> : <Navigate to="/" replace />} />
        <Route path="reports" element={canStock ? <ReportsPage /> : <Navigate to="/" replace />} />
        <Route path="print/documents/:id" element={canStock ? <PrintPage /> : <Navigate to="/" replace />} />
        <Route path="print/labels/:kind/:id" element={canStock ? <LabelPrintPage /> : <Navigate to="/" replace />} />
        <Route path="scanner" element={canStock ? <ScannerPage /> : <Navigate to="/" replace />} />
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
