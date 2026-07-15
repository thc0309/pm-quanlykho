import { useEffect, useState, type FormEvent } from "react";

import {
  adminApi,
  type AdminClient,
  type AdminRole,
  type AdminUser,
} from "../../lib/api";

const permissionOptions = [
  ["outbound.pick", "Soạn hàng"],
  ["outbound.check", "Kiểm hàng"],
  ["outbound.ship", "Xuất hàng"],
  ["outbound.resolveDiscrepancy", "Xử lý sai lệch"],
] as const;

export function AccessNavigation({ permissions }: { permissions: string[] }) {
  if (!permissions.includes("*") && !permissions.includes("admin.access.manage")) {
    return null;
  }
  return <a href="/admin/access" className="rounded-lg px-3 py-2 hover:bg-gray-100">Người dùng &amp; role</a>;
}

export default function AccessPage({ api = adminApi }: { api?: AdminClient }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [userForm, setUserForm] = useState({ fullName: "", email: "" });
  const [roleForm, setRoleForm] = useState({ code: "", name: "", permissions: [] as string[] });
  const [assignment, setAssignment] = useState({ userId: "", roleIds: [] as string[] });

  useEffect(() => {
    Promise.all([api.listUsers(), api.listRoles()])
      .then(([nextUsers, nextRoles]) => {
        setUsers(nextUsers);
        setRoles(nextRoles);
      })
      .catch(() => setError("Không thể tải dữ liệu phân quyền"))
      .finally(() => setLoading(false));
  }, [api]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.createUser(userForm);
      setUsers((current) => [result.user, ...current]);
      setTemporaryPassword(result.temporaryPassword);
      setUserForm({ fullName: "", email: "" });
    } catch {
      setError("Không thể tạo người dùng");
    } finally {
      setBusy(false);
    }
  }

  async function createRole(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const role = await api.createRole(roleForm);
      setRoles((current) => [role, ...current]);
      setRoleForm({ code: "", name: "", permissions: [] });
    } catch {
      setError("Không thể tạo role");
    } finally {
      setBusy(false);
    }
  }

  async function assignRoles(event: FormEvent) {
    event.preventDefault();
    if (!assignment.userId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.setUserRoles(assignment.userId, assignment.roleIds);
      setNotice("Đã gán role");
    } catch {
      setError("Không thể gán role");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Đang tải phân quyền…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Người dùng &amp; role</h1>
        <p className="mt-1 text-sm text-gray-500">Quản lý quyền trong kho hiện tại.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-error-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-success-50 p-3 text-success-700">{notice}</p>}
      {temporaryPassword && (
        <div role="status" className="rounded-lg border border-warning-300 bg-warning-50 p-4">
          Mật khẩu tạm chỉ hiển thị lần này: <strong>{temporaryPassword}</strong>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={createUser} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Tạo người dùng</h2>
          <label className="block text-sm font-medium">Họ tên
            <input required value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" />
          </label>
          <label className="block text-sm font-medium">Email người dùng
            <input type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" />
          </label>
          <button disabled={busy} className="h-10 rounded-lg bg-brand-600 px-4 font-medium text-white disabled:opacity-60">Tạo người dùng</button>
        </form>

        <form onSubmit={createRole} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Tạo role</h2>
          <label className="block text-sm font-medium">Mã role
            <input required value={roleForm.code} onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" />
          </label>
          <label className="block text-sm font-medium">Tên role
            <input required value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Quyền</legend>
            {permissionOptions.map(([code, label]) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roleForm.permissions.includes(code)} onChange={(e) => setRoleForm({ ...roleForm, permissions: e.target.checked ? [...roleForm.permissions, code] : roleForm.permissions.filter((value) => value !== code) })} />
                {label}
              </label>
            ))}
          </fieldset>
          <button disabled={busy || roleForm.permissions.length === 0} className="h-10 rounded-lg bg-brand-600 px-4 font-medium text-white disabled:opacity-60">Tạo role</button>
        </form>
      </div>

      <form onSubmit={assignRoles} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Gán role cho người dùng</h2>
        <label className="block text-sm font-medium">Người dùng cần gán
          <select value={assignment.userId} onChange={(event) => setAssignment({ ...assignment, userId: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3">
            <option value="">Chọn người dùng</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.fullName} — {user.email}</option>)}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Role được gán</legend>
          {roles.length === 0 ? <p className="text-sm text-gray-500">Chưa có role.</p> : roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={assignment.roleIds.includes(role.id)} onChange={(event) => setAssignment({ ...assignment, roleIds: event.target.checked ? [...assignment.roleIds, role.id] : assignment.roleIds.filter((id) => id !== role.id) })} />
              Gán {role.name}
            </label>
          ))}
        </fieldset>
        <button disabled={busy || !assignment.userId || assignment.roleIds.length === 0} className="h-10 rounded-lg bg-brand-600 px-4 font-medium text-white disabled:opacity-60">Gán role</button>
      </form>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Role hiện có</h2>
        {roles.length === 0 ? <p className="mt-3 text-sm text-gray-500">Chưa có role.</p> : (
          <ul className="mt-3 divide-y divide-gray-100">{roles.map((role) => <li key={role.id} className="py-3"><strong>{role.name}</strong><span className="ml-2 text-sm text-gray-500">{role.permissions.join(", ")}</span></li>)}</ul>
        )}
      </section>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Người dùng</h2>
        {users.length === 0 ? <p className="mt-3 text-sm text-gray-500">Chưa có người dùng.</p> : (
          <ul className="mt-3 divide-y divide-gray-100">{users.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><span><strong>{item.fullName}</strong><span className="block text-sm text-gray-500">{item.email}</span></span><button onClick={async () => { const status = item.status === "active" ? "inactive" : "active"; const updated = await api.setUserStatus(item.id, status); setUsers((current) => current.map((user) => user.id === updated.id ? updated : user)); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">{item.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}</button></li>)}</ul>
        )}
      </section>
    </div>
  );
}
