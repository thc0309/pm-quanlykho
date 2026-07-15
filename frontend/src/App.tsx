import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import UsersPage, { PermissionsPage, RoleCreatePage, RolesPage, UserCreatePage } from "./features/admin/AccessPage";
import AuthPage from "./features/auth/AuthPage";
import { CategoriesPage, CategoryCreatePage, UnitCreatePage, UnitsPage } from "./features/catalog/CatalogPage";
import LocationsPage, { LocationCreatePage } from "./features/locations/LocationsPage";
import ProductsPage, { ProductCreatePage } from "./features/products/ProductsPage";
import PartnersPage, { PartnerCreatePage } from "./features/partners/PartnersPage";
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

  return (
    <Routes>
      <Route element={<AppLayout access={access} user={user} onLogout={logout} />}>
        <Route index element={<Dashboard />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Tổng quan kho</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Chọn chức năng từ menu bên trái để bắt đầu.
      </p>
    </div>
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
