import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { CheckLineIcon, PlusIcon } from "../../icons";
import { outboundApi, type Outbound, type OutboundClient } from "../../lib/api";

const panel = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const input = "mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
const primary = "inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const statuses: Record<Outbound["status"], string> = { draft: "Nháp", ready_to_pick: "Sẵn sàng soạn", picking: "Đang soạn", picked: "Đã soạn", checking: "Đang kiểm", needs_repick: "Cần soạn lại", shipped: "Đã xuất", cancelled: "Đã hủy" };

export default function OutboundPage({ api = outboundApi }: { api?: OutboundClient }) {
  const [items, setItems] = useState<Outbound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [releasing, setReleasing] = useState("");
  useEffect(() => { api.listOutbounds().then(setItems).catch(() => setError("Không thể tải phiếu xuất.")).finally(() => setLoading(false)); }, [api]);
  async function release(item: Outbound) {
    setReleasing(item.id); setError("");
    try {
      const result = await api.releaseOutbound(item.id);
      setItems(rows => rows.map(row => row.id === item.id ? { ...row, status: "ready_to_pick", reservedUntil: result.reservedUntil } : row));
    } catch { setError("Không thể release phiếu xuất. Kiểm tra tồn khả dụng."); }
    finally { setReleasing(""); }
  }
  if (loading) return <p role="status">Đang tải phiếu xuất…</p>;
  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Phiếu xuất</h1><p className="mt-1 text-sm text-gray-500">Giữ tồn theo FEFO trước khi soạn.</p></div><Link to="/outbounds/create" className={primary}><PlusIcon className="h-4 w-4" />Thêm phiếu xuất</Link></div>
    {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700">{error}</p>}
    <section className={panel}><h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách phiếu xuất</h2><div className="mt-3 overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800"><thead><tr className="text-left text-xs uppercase text-gray-500"><th className="px-4 py-3">Số phiếu</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Số dòng</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{items.length === 0 ? <tr><td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-500">Chưa có phiếu xuất.</td></tr> : items.map(item => <tr key={item.id}><td className="px-4 py-3 text-sm font-medium">{item.documentNo}</td><td className="px-4 py-3 text-sm">{statuses[item.status]}</td><td className="px-4 py-3 text-sm">{item.lineCount}</td><td className="px-4 py-3 text-right"><button type="button" aria-label={`Release phiếu ${item.documentNo}`} disabled={item.status !== "draft" || releasing === item.id} onClick={() => release(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 disabled:opacity-40"><CheckLineIcon className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></section>
  </div>;
}

export function OutboundCreatePage({ api = outboundApi }: { api?: OutboundClient }) {
  const [products, setProducts] = useState<Awaited<ReturnType<OutboundClient["listProducts"]>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api.listProducts().then(setProducts).catch(() => setError("Không thể tải sản phẩm.")).finally(() => setLoading(false)); }, [api]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setSaving(true); setError(""); setMessage("");
    try { await api.createOutbound({ documentNo: String(data.get("documentNo")).trim(), lines: [{ productId: String(data.get("productId")), quantity: Number(data.get("quantity")) }] }); setMessage("Đã tạo phiếu xuất"); form.reset(); }
    catch { setError("Không thể tạo phiếu xuất."); } finally { setSaving(false); }
  }
  if (loading) return <p role="status">Đang tải biểu mẫu…</p>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Tạo phiếu xuất</h1><p className="mt-1 text-sm text-gray-500">Tạo nháp, sau đó release tại danh sách.</p></div>{error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700">{message}</p>}<form onSubmit={submit} className={`grid gap-4 sm:grid-cols-2 ${panel}`}><label className="text-sm font-medium">Số phiếu<input name="documentNo" required maxLength={80} className={input} /></label><label className="text-sm font-medium">Sản phẩm<select name="productId" required className={input}><option value="">Chọn sản phẩm</option>{products.map(product => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></label><label className="text-sm font-medium">Số lượng<input name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required className={input} /></label><div className="flex items-end gap-3"><button type="submit" disabled={saving} className={primary}>{saving ? "Đang lưu…" : "Tạo phiếu xuất"}</button><Link to="/outbounds" className="inline-flex h-11 items-center px-4 text-sm">Quay lại</Link></div></form></div>;
}
