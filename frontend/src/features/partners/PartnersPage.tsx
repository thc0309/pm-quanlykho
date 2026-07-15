import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Pagination, paginate } from "../../components/common/Pagination";
import { PencilIcon, PlusIcon, TrashBinIcon } from "../../icons";
import { partnerApi, type Partner, type PartnerClient } from "../../lib/api";

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

export default function PartnersPage({ api = partnerApi }: { api?: PartnerClient }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        <Link to="/partners/create" className={primaryButtonClass}>
          <PlusIcon className="h-4 w-4" />
          Thêm đối tác
        </Link>
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
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>
                    Chưa có đối tác.
                  </td>
                </tr>
              ) : paginate(partners, page).map((partner) => (
                <tr key={partner.id}>
                  <td className={`${tableCellClass} font-medium text-gray-800 dark:text-white/90`}>{partner.name}</td>
                  <td className={tableCellClass}>{partner.code}</td>
                  <td className={tableCellClass}>{kindLabels[partner.kind]}</td>
                  <td className={tableCellClass}>{partner.phone || partner.email || "-"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex gap-2">
                      <button type="button" disabled aria-label={`Sửa đối tác ${partner.name}`} title="Chưa hỗ trợ sửa đối tác" className={iconButtonClass}>
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button type="button" disabled aria-label={`Xóa đối tác ${partner.name}`} title="Chưa hỗ trợ xóa đối tác" className={iconButtonClass}>
                        <TrashBinIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
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
          Mã đối tác
          <input required autoComplete="off" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Tên đối tác
          <input required autoComplete="off" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Loại đối tác
          <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Partner["kind"] })} className={inputClass}>
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
