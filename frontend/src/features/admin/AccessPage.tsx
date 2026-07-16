import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Pagination, paginate } from "../../components/common/Pagination";
import {
  adminApi,
  ApiError,
  type AdminClient,
  type AdminRole,
  type AdminUser,
} from "../../lib/api";
import {
  CheckCircleIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  TrashBinIcon,
} from "../../icons";
import { ErrorNotice } from "./components/ErrorNotice";
import { PageHeader } from "./components/PageHeader";

export { AccessNavigation } from "./components/AccessNavigation";

export const permissionOptions = [
  ["outbound.pick", "Soạn hàng"],
  ["outbound.check", "Kiểm hàng"],
  ["outbound.ship", "Xuất hàng"],
  ["outbound.resolveDiscrepancy", "Xử lý sai lệch"],
] as const;

const panelClass =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-400";
const inputClass =
  "mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800";
const primaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const tableHeadClass =
  "bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-white/[0.03] dark:text-gray-400";
const tableCellClass = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

function useAdminData(api: AdminClient) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.listUsers(), api.listRoles()])
      .then(([nextUsers, nextRoles]) => {
        setUsers(nextUsers);
        setRoles(nextRoles);
      })
      .catch(() => setError("Không thể tải dữ liệu phân quyền. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  return { users, setUsers, roles, setRoles, loading, error, setError };
}

function normalizeRoleCode(value: string) {
  return value
    .trimStart()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}

type UserFormState = {
  fullName: string;
  email: string;
  phone: string;
  employeeCode: string;
  jobTitle: string;
  department: string;
  note: string;
};

const emptyUserForm: UserFormState = {
  fullName: "",
  email: "",
  phone: "",
  employeeCode: "",
  jobTitle: "",
  department: "",
  note: "",
};

function userFormFor(user?: AdminUser): UserFormState {
  return user ? {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    employeeCode: user.employeeCode ?? "",
    jobTitle: user.jobTitle ?? "",
    department: user.department ?? "",
    note: user.note ?? "",
  } : { ...emptyUserForm };
}

function createUserInput(form: UserFormState): Parameters<AdminClient["createUser"]>[0] {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    ...(form.employeeCode.trim() ? { employeeCode: form.employeeCode.trim() } : {}),
    ...(form.jobTitle.trim() ? { jobTitle: form.jobTitle.trim() } : {}),
    ...(form.department.trim() ? { department: form.department.trim() } : {}),
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
  };
}

function updateUserInput(form: UserFormState): Parameters<AdminClient["updateUser"]>[1] {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    employeeCode: form.employeeCode.trim() || null,
    jobTitle: form.jobTitle.trim() || null,
    department: form.department.trim() || null,
    note: form.note.trim() || null,
  };
}

function useAvatarPreview(file: File | null) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview;
}

function UserProfileFields({
  form,
  setForm,
  setAvatar,
  previewUrl,
  onFileError,
}: {
  form: UserFormState;
  setForm: (form: UserFormState) => void;
  setAvatar: (file: File | null) => void;
  previewUrl?: string | null;
  onFileError: (message: string) => void;
}) {
  const field = (name: keyof UserFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [name]: event.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>Họ tên (*)<input required autoComplete="name" value={form.fullName} onChange={field("fullName")} className={inputClass} /></label>
      <label className={labelClass}>Email người dùng (*)<input type="email" required autoComplete="email" spellCheck={false} value={form.email} onChange={field("email")} className={inputClass} /></label>
      <label className={labelClass}>Số điện thoại (*)<input type="tel" required autoComplete="tel" value={form.phone} onChange={field("phone")} className={inputClass} /></label>
      <label className={labelClass}>Mã nhân viên<input maxLength={50} autoComplete="off" value={form.employeeCode} onChange={field("employeeCode")} className={inputClass} /></label>
      <label className={labelClass}>Chức danh<input maxLength={100} autoComplete="organization-title" value={form.jobTitle} onChange={field("jobTitle")} className={inputClass} /></label>
      <label className={labelClass}>Bộ phận<input maxLength={100} autoComplete="organization" value={form.department} onChange={field("department")} className={inputClass} /></label>
      <label className={`${labelClass} sm:col-span-2`}>Ghi chú<textarea maxLength={500} value={form.note} onChange={field("note")} className={`${inputClass} min-h-24 py-3`} /></label>
      <label className={`${labelClass} sm:col-span-2`}>
        Ảnh đại diện
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file && file.size > 5 * 1024 * 1024) {
              event.target.value = "";
              onFileError("Ảnh đại diện không được vượt quá 5 MB");
              return;
            }
            setAvatar(file);
          }}
          className={`${inputClass} py-2`}
        />
      </label>
      {previewUrl && (
        <img src={previewUrl} alt="Xem trước ảnh đại diện" className="h-20 w-20 rounded-full object-cover" />
      )}
    </div>
  );
}

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function UsersPage({ api = adminApi }: { api?: AdminClient }) {
  const { users, setUsers, loading, error, setError } = useAdminData(api);
  const [busy, setBusy] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(emptyUserForm);
  const [avatar, setAvatar] = useState<File | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const avatarPreview = useAvatarPreview(avatar);
  const pagedUsers = paginate(users, userPage);

  async function toggleUserStatus(item: AdminUser) {
    setBusy(true);
    setError("");
    try {
      const status = item.status === "active" ? "inactive" : "active";
      const updated = await api.setUserStatus(item.id, status);
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
    } catch {
      setError("Không thể cập nhật trạng thái người dùng.");
    } finally {
      setBusy(false);
    }
  }

  function startEditing(user: AdminUser) {
    setEditing(user);
    setEditForm(userFormFor(user));
    setAvatar(null);
    setError("");
  }

  function cancelEditing() {
    setEditing(null);
    setAvatar(null);
    editButtonRef.current?.focus();
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      let updated = await api.updateUser(editing.id, updateUserInput(editForm));
      if (avatar) updated = await api.uploadUserAvatar(editing.id, avatar);
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      setEditing(null);
      setAvatar(null);
    } catch (cause) {
      setError(apiMessage(cause, "Không thể cập nhật người dùng."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải người dùng…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Người dùng"
        description="Tạo, vô hiệu hóa và gán vai trò cho người dùng trong kho hiện tại."
        actions={(
          <Link to="/admin/users/create" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" />
            Thêm người dùng
          </Link>
        )}
      />
      <ErrorNotice message={error} />

      {editing && (
        <form onSubmit={saveUser} aria-label={`Sửa ${editing.fullName}`} className={`space-y-4 ${panelClass}`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Sửa người dùng</h2>
          <UserProfileFields
            form={editForm}
            setForm={setEditForm}
            setAvatar={setAvatar}
            previewUrl={avatarPreview || editing.avatarUrl}
            onFileError={setError}
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={primaryButtonClass}>Lưu thay đổi</button>
            <button type="button" onClick={cancelEditing} className={secondaryButtonClass}>Hủy chỉnh sửa</button>
          </div>
        </form>
      )}

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Người dùng hiện có</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[760px] divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className="px-4 py-3">Người dùng</th>
                <th scope="col" className="px-4 py-3">Điện thoại</th>
                <th scope="col" className="px-4 py-3">Bộ phận / chức danh</th>
                <th scope="col" className="px-4 py-3">Trạng thái</th>
                <th scope="col" className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>
                    Chưa có người dùng.
                  </td>
                </tr>
              ) : pagedUsers.map((item) => (
                <tr key={item.id}>
                  <td className={tableCellClass}>
                    <div className="flex items-center gap-3">
                      {item.avatarUrl ? (
                        <img src={item.avatarUrl} alt={`Ảnh đại diện của ${item.fullName}`} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span role="img" aria-label={`Chưa có ảnh đại diện của ${item.fullName}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {item.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                        </span>
                      )}
                      <span><strong className="block text-gray-800 dark:text-white/90">{item.fullName}</strong><span>{item.email}</span></span>
                    </div>
                  </td>
                  <td className={tableCellClass}>{item.phone}</td>
                  <td className={tableCellClass}>{[item.department, item.jobTitle].filter(Boolean).join(" / ") || "—"}</td>
                  <td className={tableCellClass}>{item.status === "active" ? "Đang hoạt động" : "Đã vô hiệu hóa"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="flex justify-end gap-2">
                      <button
                        ref={editing?.id === item.id ? editButtonRef : undefined}
                        type="button"
                        disabled={busy}
                        onClick={() => startEditing(item)}
                        aria-label={`Sửa ${item.fullName}`}
                        title="Sửa"
                        className={iconButtonClass}
                      ><PencilIcon className="h-4 w-4" /></button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleUserStatus(item)}
                        aria-label={`${item.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"} ${item.fullName}`}
                        title={item.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
                        className={iconButtonClass}
                      >
                        {item.status === "active" ? <TrashBinIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={userPage} totalItems={users.length} onPageChange={setUserPage} />
      </section>
    </div>
  );
}

export function UserCreatePage({ api = adminApi }: { api?: AdminClient }) {
  const { users, setUsers, roles, loading, error, setError } = useAdminData(api);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [avatar, setAvatar] = useState<File | null>(null);
  const avatarPreview = useAvatarPreview(avatar);
  const [assignment, setAssignment] = useState({ userId: "", roleIds: [] as string[] });

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.createUser(createUserInput(userForm));
      let savedUser = result.user;
      if (avatar) {
        try {
          savedUser = await api.uploadUserAvatar(result.user.id, avatar);
        } catch (cause) {
          setError(apiMessage(cause, "Đã tạo người dùng nhưng không thể tải ảnh đại diện."));
        }
      }
      setUsers((current) => [savedUser, ...current]);
      setAssignment((current) => ({ ...current, userId: result.user.id }));
      setTemporaryPassword(result.temporaryPassword);
      setUserForm(userFormFor());
      setAvatar(null);
    } catch (cause) {
      setError(apiMessage(cause, "Không thể tạo người dùng. Kiểm tra email đã tồn tại hay chưa."));
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
      setNotice("Đã gán vai trò");
    } catch {
      setError("Không thể gán vai trò. Hãy kiểm tra người dùng và quyền hiện tại.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải form người dùng…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thêm người dùng"
        description="Nhập thông tin người dùng và gán vai trò sau khi tạo."
        actions={<Link to="/admin/users" className={secondaryButtonClass}>Quay lại</Link>}
      />
      <ErrorNotice message={error} />
      {notice && (
        <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">
          {notice}
        </p>
      )}
      {temporaryPassword && (
        <div role="status" className="rounded-lg border border-warning-300 bg-warning-50 p-4 text-sm text-warning-800 dark:border-warning-700 dark:bg-warning-500/15 dark:text-warning-300">
          Mật khẩu tạm chỉ hiển thị lần này: <strong className="break-all">{temporaryPassword}</strong>
        </div>
      )}

      <form onSubmit={createUser} className={`space-y-4 ${panelClass}`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Thông tin người dùng</h2>
        <UserProfileFields
          form={userForm}
          setForm={setUserForm}
          setAvatar={setAvatar}
          previewUrl={avatarPreview}
          onFileError={setError}
        />
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          Tạo người dùng
        </button>
      </form>

      <form onSubmit={assignRoles} className={`space-y-4 ${panelClass}`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Vai trò</h2>
        <label className={labelClass}>
          Người dùng cần gán (*)
          <select
            name="assignedUser"
            required
            autoComplete="off"
            value={assignment.userId}
            onChange={(event) => setAssignment({ ...assignment, userId: event.target.value })}
            className={inputClass}
          >
            <option value="">Chọn người dùng</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.fullName} — {user.email}</option>
            ))}
          </select>
        </label>
        <fieldset aria-required="true" className="space-y-2">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-400">Vai trò được gán (*)</legend>
          {roles.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có vai trò.</p>
          ) : roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={assignment.roleIds.includes(role.id)}
                onChange={(event) =>
                  setAssignment({
                    ...assignment,
                    roleIds: event.target.checked
                      ? [...assignment.roleIds, role.id]
                      : assignment.roleIds.filter((id) => id !== role.id),
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus-visible:ring-brand-500 dark:border-gray-700"
              />
              Gán {role.name}
            </label>
          ))}
        </fieldset>
        <button type="submit" disabled={busy || !assignment.userId || assignment.roleIds.length === 0} className={primaryButtonClass}>
          Gán vai trò
        </button>
      </form>
    </div>
  );
}

export function RolesPage({ api = adminApi }: { api?: AdminClient }) {
  const { roles, loading, error } = useAdminData(api);
  const [rolePage, setRolePage] = useState(1);
  const pagedRoles = paginate(roles, rolePage);

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải vai trò…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vai trò"
        description="Tạo vai trò và chọn các quyền nghiệp vụ được phép dùng."
        actions={(
          <Link to="/admin/roles/create" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" />
            Thêm vai trò
          </Link>
        )}
      />
      <ErrorNotice message={error} />

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Vai trò hiện có</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className="px-4 py-3">Tên vai trò</th>
                <th scope="col" className="px-4 py-3">Mã</th>
                <th scope="col" className="px-4 py-3">Quyền</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>
                    Chưa có vai trò.
                  </td>
                </tr>
              ) : pagedRoles.map((role) => (
                <tr key={role.id}>
                  <td className={`${tableCellClass} font-medium text-gray-800 dark:text-white/90`}>{role.name}</td>
                  <td className={tableCellClass}>{role.code}</td>
                  <td className={tableCellClass}>{role.permissions.join(", ")}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex gap-2">
                      <button type="button" disabled aria-label={`Sửa vai trò ${role.name}`} title="Chưa hỗ trợ sửa vai trò" className={iconButtonClass}>
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button type="button" disabled aria-label={`Xóa vai trò ${role.name}`} title="Chưa hỗ trợ xóa vai trò" className={iconButtonClass}>
                        <TrashBinIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={rolePage} totalItems={roles.length} onPageChange={setRolePage} />
      </section>
    </div>
  );
}

export function RoleCreatePage({ api = adminApi }: { api?: AdminClient }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [roleForm, setRoleForm] = useState({ code: "", name: "", permissions: [] as string[] });

  async function createRole(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.createRole(roleForm);
      setNotice("Đã tạo vai trò");
      setRoleForm({ code: "", name: "", permissions: [] });
    } catch {
      setError("Không thể tạo vai trò. Kiểm tra mã vai trò đã tồn tại hay chưa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thêm vai trò"
        description="Nhập mã, tên và quyền nghiệp vụ cho vai trò mới."
        actions={<Link to="/admin/roles" className={secondaryButtonClass}>Quay lại</Link>}
      />
      <ErrorNotice message={error} />
      {notice && (
        <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">
          {notice}
        </p>
      )}

      <form onSubmit={createRole} className={`space-y-4 ${panelClass}`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Thông tin vai trò</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Mã vai trò (*)
            <input
              name="roleCode"
              required
              autoComplete="off"
              spellCheck={false}
              pattern="[a-z][a-z0-9_-]*"
              value={roleForm.code}
              onChange={(event) => setRoleForm({ ...roleForm, code: normalizeRoleCode(event.target.value) })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Tên vai trò (*)
            <input
              name="roleName"
              required
              autoComplete="off"
              value={roleForm.name}
              onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
              className={inputClass}
            />
          </label>
        </div>
        <fieldset aria-required="true" className="space-y-2">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-400">Quyền (*)</legend>
          {permissionOptions.map(([code, label]) => (
            <label key={code} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={roleForm.permissions.includes(code)}
                onChange={(event) =>
                  setRoleForm({
                    ...roleForm,
                    permissions: event.target.checked
                      ? [...roleForm.permissions, code]
                      : roleForm.permissions.filter((value) => value !== code),
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus-visible:ring-brand-500 dark:border-gray-700"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <button type="submit" disabled={busy || roleForm.permissions.length === 0} className={primaryButtonClass}>
          Tạo vai trò
        </button>
      </form>
    </div>
  );
}

export function PermissionsPage() {
  const permissions = useMemo(
    () => permissionOptions.map(([code, label]) => ({ code, label })),
    [],
  );
  const [permissionPage, setPermissionPage] = useState(1);
  const pagedPermissions = paginate(permissions, permissionPage);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permission"
        description="Danh sách quyền nghiệp vụ dùng để gán cho vai trò."
      />
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Quyền hiện có</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className="px-4 py-3">Tên quyền</th>
                <th scope="col" className="px-4 py-3">Mã quyền</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {pagedPermissions.map((permission) => (
                <tr key={permission.code}>
                  <td className={`${tableCellClass} font-medium text-gray-800 dark:text-white/90`}>{permission.label}</td>
                  <td className={tableCellClass}>
                    <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                      {permission.code}
                    </code>
                  </td>
                  <td className={`${tableCellClass} text-right`}>
                    <button type="button" disabled aria-label={`Xem quyền ${permission.label}`} title="Danh mục quyền cố định" className={iconButtonClass}>
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={permissionPage} totalItems={permissions.length} onPageChange={setPermissionPage} />
      </section>
    </div>
  );
}

export default UsersPage;
