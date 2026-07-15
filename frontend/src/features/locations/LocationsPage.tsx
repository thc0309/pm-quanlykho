import { useEffect, useState, type FormEvent } from "react";

import { locationApi, type LocationClient, type WarehouseLocation } from "../../lib/api";

const typeLabels: Record<WarehouseLocation["type"], string> = {
  storage: "Lưu trữ",
  staging: "Chờ kiểm",
  shipping: "Xuất hàng",
};

export function LocationsNavigation({ permissions }: { permissions: string[] }) {
  if (!permissions.includes("*") && !permissions.includes("admin.access.manage")) return null;
  return <a href="/locations" className="rounded-lg px-3 py-2 hover:bg-gray-100">Vị trí kho</a>;
}

export default function LocationsPage({ api = locationApi }: { api?: LocationClient }) {
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [form, setForm] = useState({ code: "", barcode: "", name: "", type: "storage" as WarehouseLocation["type"] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => setError("Không thể tải vị trí kho")).finally(() => setLoading(false));
  }, [api]);

  async function createLocation(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const location = await api.createLocation(form);
      setLocations((current) => [...current, location]);
      setForm({ code: "", barcode: "", name: "", type: "storage" });
    } catch {
      setError("Không thể tạo vị trí; hãy kiểm tra mã và barcode trùng");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Đang tải vị trí…</p>;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Vị trí kho</h1><p className="mt-1 text-sm text-gray-500">Quản lý kệ lưu trữ, khu chờ kiểm và khu xuất hàng.</p></div>
    {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-error-700">{error}</p>}
    <form onSubmit={createLocation} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
      <label className="text-sm font-medium">Mã vị trí<input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" /></label>
      <label className="text-sm font-medium">Barcode<input required value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" /></label>
      <label className="text-sm font-medium">Tên vị trí<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" /></label>
      <label className="text-sm font-medium">Loại vị trí<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as WarehouseLocation["type"] })} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3"><option value="storage">Lưu trữ</option><option value="staging">Chờ kiểm</option><option value="shipping">Xuất hàng</option></select></label>
      <button disabled={busy} className="h-10 rounded-lg bg-brand-600 px-4 font-medium text-white disabled:opacity-60 sm:col-span-2 sm:w-fit">Tạo vị trí</button>
    </form>
    <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-semibold">Danh sách vị trí</h2>{locations.length === 0 ? <p className="mt-3 text-sm text-gray-500">Chưa có vị trí.</p> : <ul className="mt-3 divide-y divide-gray-100">{locations.map((location) => <li key={location.id} className="flex flex-wrap justify-between gap-2 py-3"><span><strong>{location.name}</strong><span className="block text-sm text-gray-500">{location.code} · {location.barcode}</span></span><span className="text-sm text-gray-600">{typeLabels[location.type]}</span></li>)}</ul>}</section>
  </div>;
}
