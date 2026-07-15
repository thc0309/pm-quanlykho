import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import AccessPage, { AccessNavigation } from "./features/admin/AccessPage";
import AuthPage from "./features/auth/AuthPage";
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="/" className="font-semibold text-brand-700">Warehouse Suite</a>
          <div className="flex items-center gap-3 text-sm"><span>{user.fullName}</span><button onClick={logout} className="rounded-lg border border-gray-300 px-3 py-2">Đăng xuất</button></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr] sm:px-6">
        <nav aria-label="Điều hướng chính" className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3">
          <a href="/" className="rounded-lg px-3 py-2 hover:bg-gray-100">Tổng quan</a>
          <AccessNavigation permissions={access.permissions} />
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<div><h1 className="text-2xl font-semibold">Tổng quan kho</h1><p className="mt-2 text-gray-500">Chọn chức năng từ menu để bắt đầu.</p></div>} />
            <Route path="/admin/access" element={canManage ? <AccessPage /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Root() {
  const [user, setUser] = useState<SessionUser | null>(null);
  if (!user || user.mustChangePassword) return <AuthPage onAuthenticated={setUser} />;
  return <Workspace user={user} onLogout={() => setUser(null)} />;
}

export default function App() {
  return <BrowserRouter><Root /></BrowserRouter>;
}
