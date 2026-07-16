import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Pagination, paginate } from "../../components/common/Pagination";
import { PencilIcon, PlusIcon } from "../../icons";
import { partnerApi, type Partner, type PartnerClient } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const kindLabels: Record<Partner["kind"], string> = {
  customer: "Khách hàng",
  supplier: "Nhà cung cấp",
};

const panelClass =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const labelClass = "text-sm font-medium text-gray-700 dark:text-gray-400";
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
const rowActionClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function PartnersPage({ api = partnerApi, permissions = ["*"] }: { api?: PartnerClient; permissions?: readonly string[] }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", taxCode: "", phone: "", email: "", address: "" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const canCreate = hasPermission(permissions, "partners.create");
  const canUpdate = hasPermission(permissions, "partners.update");
  const canChangeStatus = hasPermission(permissions, "partners.delete");

  function startEdit(partner: Partner) {
    setEditingId(partner.id);
    setDraft({ name: partner.name, taxCode: partner.taxCode ?? "", phone: partner.phone ?? "", email: partner.email ?? "", address: partner.address ?? "" });
    setRowError(null);
  }

  async function savePartner(event: FormEvent<HTMLFormElement>, partner: Partner) {
    event.preventDefault();
    setBusyId(partner.id);
    setRowError(null);
    try {
      const updated = await api.updatePartner(partner.id, {
        name: draft.name.trim(),
        taxCode: draft.taxCode.trim() || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        address: draft.address.trim() || null,
      });
      setPartners((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
    } catch (caught) {
      setRowError({ id: partner.id, message: errorMessage(caught, "Không thể cập nhật đối tác") });
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(partner: Partner) {
    const nextStatus = partner.status === "active" ? "inactive" : "active";
    const action = nextStatus === "inactive" ? "vô hiệu hóa" : "kích hoạt";
    if (!window.confirm(`Bạn có chắc muốn ${action} đối tác ${partner.name}?`)) return;
    setBusyId(partner.id);
    setRowError(null);
    try {
      const updated = await api.setPartnerStatus(partner.id, nextStatus);
      setPartners((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setRowError({ id: partner.id, message: errorMessage(caught, `Không thể ${action} đối tác`) });
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    api.listPartners()
      .then(setPartners)
      .catch(() => setError("Không thể tải đối tác. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải đối tác…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Đối tác</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản lý khách hàng và nhà cung cấp theo kho.
          </p>
        </div>
        {canCreate && (
          <Link to="/partners/create" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" />
            Thêm đối tác
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách đối tác</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className="px-4 py-3">Tên đối tác</th>
                <th scope="col" className="px-4 py-3">Mã</th>
                <th scope="col" className="px-4 py-3">Loại</th>
                <th scope="col" className="px-4 py-3">Liên hệ</th>
                <th scope="col" className="px-4 py-3">Trạng thái</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>
                    Chưa có đối tác.
                  </td>
                </tr>
              ) : paginate(partners, page).map((partner) => (
                <Fragment key={partner.id}>
                <tr>
                  <td className={`${tableCellClass} font-medium text-gray-800 dark:text-white/90`}>{partner.name}</td>
                  <td className={tableCellClass}>{partner.code}</td>
                  <td className={tableCellClass}>{kindLabels[partner.kind]}</td>
                  <td className={tableCellClass}>{partner.phone || partner.email || "-"}</td>
                  <td className={tableCellClass}>{partner.status === "active" ? "Đang dùng" : "Tạm ngưng"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex items-center gap-2">
                      {canUpdate && editingId !== partner.id && (
                        <button type="button" disabled={busyId === partner.id} aria-label={`Sửa đối tác ${partner.name}`} title="Sửa đối tác" className={iconButtonClass} onClick={() => startEdit(partner)}>
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canChangeStatus && (
                        <button type="button" disabled={busyId === partner.id} aria-label={`${partner.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"} đối tác ${partner.name}`} className={rowActionClass} onClick={() => changeStatus(partner)}>
                          {busyId === partner.id ? "Đang xử lý…" : partner.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {(editingId === partner.id || rowError?.id === partner.id) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4">
                      {editingId === partner.id && (
                        <form className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-3 dark:bg-white/[0.03]" onSubmit={(event) => savePartner(event, partner)}>
                          <label className={labelClass}>Tên đối tác<input autoFocus required aria-label={`Tên đối tác ${partner.name}`} className={inputClass} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                          <label className={labelClass}>Mã số thuế<input aria-label={`Mã số thuế đối tác ${partner.name}`} className={inputClass} value={draft.taxCode} onChange={(event) => setDraft((current) => ({ ...current, taxCode: event.target.value }))} /></label>
                          <label className={labelClass}>Điện thoại<input aria-label={`Điện thoại đối tác ${partner.name}`} className={inputClass} value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
                          <label className={labelClass}>Email<input type="email" aria-label={`Email đối tác ${partner.name}`} className={inputClass} value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></label>
                          <label className={labelClass}>Địa chỉ<input aria-label={`Địa chỉ đối tác ${partner.name}`} className={inputClass} value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} /></label>
                          <div className="flex items-end gap-2">
                            <button type="submit" disabled={busyId === partner.id} className={primaryButtonClass} aria-label={`Lưu đối tác ${partner.name}`}>{busyId === partner.id ? "Đang lưu…" : "Lưu"}</button>
                            <button type="button" disabled={busyId === partner.id} className={secondaryButtonClass} onClick={() => setEditingId(null)}>Hủy</button>
                          </div>
                        </form>
                      )}
                      {rowError?.id === partner.id && <p role="alert" className="mt-2 text-sm text-error-600">{rowError.message}</p>}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={partners.length} onPageChange={setPage} />
      </section>
    </div>
  );
}

export function PartnerCreatePage({ api = partnerApi }: { api?: PartnerClient }) {
  const [form, setForm] = useState({ code: "", name: "", kind: "customer" as Partner["kind"], taxCode: "", phone: "", email: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function createPartner(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.createPartner(form);
      setNotice("Đã tạo đối tác");
      setForm({ code: "", name: "", kind: "customer", taxCode: "", phone: "", email: "", address: "" });
    } catch {
      setError("Không thể tạo đối tác. Kiểm tra mã hoặc thông tin liên hệ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Thêm đối tác</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Nhập thông tin khách hàng hoặc nhà cung cấp.
          </p>
        </div>
        <Link to="/partners" className={secondaryButtonClass}>Quay lại</Link>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">
          {notice}
        </p>
      )}

      <form onSubmit={createPartner} className={`grid gap-4 sm:grid-cols-2 ${panelClass}`}>
        <label className={labelClass}>
          Mã đối tác (*)
          <input required autoComplete="off" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Tên đối tác (*)
          <input required autoComplete="off" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Loại đối tác (*)
          <select required value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Partner["kind"] })} className={inputClass}>
            <option value="customer">Khách hàng</option>
            <option value="supplier">Nhà cung cấp</option>
          </select>
        </label>
        <label className={labelClass}>
          Mã số thuế
          <input autoComplete="off" value={form.taxCode} onChange={(event) => setForm({ ...form, taxCode: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Điện thoại
          <input autoComplete="off" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input type="email" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Địa chỉ
          <input autoComplete="off" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className={inputClass} />
        </label>
        <button type="submit" disabled={busy} className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}>
          Tạo đối tác
        </button>
      </form>
    </div>
  );
}
