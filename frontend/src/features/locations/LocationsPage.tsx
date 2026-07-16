import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Pagination, paginate } from "../../components/common/Pagination";
import { locationApi, type LocationClient, type WarehouseLocation } from "../../lib/api";
import { PencilIcon, PlusIcon, TrashBinIcon } from "../../icons";

const typeLabels: Record<WarehouseLocation["type"], string> = {
  storage: "Lưu trữ",
  staging: "Chờ kiểm",
  shipping: "Xuất hàng",
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

export default function LocationsPage({ api = locationApi }: { api?: LocationClient }) {
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locationPage, setLocationPage] = useState(1);
  const pagedLocations = paginate(locations, locationPage);

  useEffect(() => {
    api.listLocations()
      .then(setLocations)
      .catch(() => setError("Không thể tải vị trí kho. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải vị trí…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Vị trí kho</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản lý kệ lưu trữ, khu chờ kiểm và khu xuất hàng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/locations/create" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" />
            Thêm vị trí
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách vị trí</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className="px-4 py-3">Tên vị trí</th>
                <th scope="col" className="px-4 py-3">Mã</th>
                <th scope="col" className="px-4 py-3">Barcode</th>
                <th scope="col" className="px-4 py-3">Loại</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>
                    Chưa có vị trí.
                  </td>
                </tr>
              ) : pagedLocations.map((location) => (
                <tr key={location.id}>
                  <td className={`${tableCellClass} font-medium text-gray-800 dark:text-white/90`}>{location.name}</td>
                  <td className={tableCellClass}>{location.code}</td>
                  <td className={tableCellClass}>{location.barcode}</td>
                  <td className={tableCellClass}>{typeLabels[location.type]}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex gap-2">
                      <button type="button" disabled aria-label={`Sửa vị trí ${location.name}`} title="Chưa hỗ trợ sửa vị trí" className={iconButtonClass}>
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button type="button" disabled aria-label={`Xóa vị trí ${location.name}`} title="Chưa hỗ trợ xóa vị trí" className={iconButtonClass}>
                        <TrashBinIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={locationPage} totalItems={locations.length} onPageChange={setLocationPage} />
      </section>
    </div>
  );
}

export function LocationCreatePage({ api = locationApi }: { api?: LocationClient }) {
  const [form, setForm] = useState({ code: "", barcode: "", name: "", type: "storage" as WarehouseLocation["type"] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function createLocation(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.createLocation(form);
      setNotice("Đã tạo vị trí");
      setForm({ code: "", barcode: "", name: "", type: "storage" });
    } catch {
      setError("Không thể tạo vị trí. Kiểm tra mã vị trí hoặc barcode đã tồn tại hay chưa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Thêm vị trí</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Nhập thông tin kệ lưu trữ, khu chờ kiểm hoặc khu xuất hàng.
          </p>
        </div>
        <Link to="/locations" className={secondaryButtonClass}>Quay lại</Link>
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

      <form onSubmit={createLocation} className={`grid gap-4 sm:grid-cols-2 ${panelClass}`}>
        <label className={labelClass}>
          Mã vị trí (*)
          <input
            name="locationCode"
            required
            autoComplete="off"
            spellCheck={false}
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Barcode (*)
          <input
            name="barcode"
            required
            autoComplete="off"
            spellCheck={false}
            value={form.barcode}
            onChange={(event) => setForm({ ...form, barcode: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Tên vị trí (*)
          <input
            name="locationName"
            required
            autoComplete="off"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Loại vị trí (*)
          <select
            name="locationType"
            required
            autoComplete="off"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as WarehouseLocation["type"] })}
            className={inputClass}
          >
            <option value="storage">Lưu trữ</option>
            <option value="staging">Chờ kiểm</option>
            <option value="shipping">Xuất hàng</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}
        >
          Tạo vị trí
        </button>
      </form>
    </div>
  );
}
