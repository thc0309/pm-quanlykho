import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { CheckLineIcon, PlusIcon } from "../../icons";
import { outboundApi, type Outbound, type OutboundClient } from "../../lib/api";
import {
  errorClass,
  inputClass,
  labelClass,
  pageTitleClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successClass,
  tableClass,
} from "../themeStyles";

const statuses: Record<Outbound["status"], string> = {
  draft: "Nháp",
  ready_to_pick: "Sẵn sàng soạn",
  picking: "Đang soạn",
  picked: "Đã soạn",
  checking: "Đang kiểm",
  needs_repick: "Cần soạn lại",
  shipped: "Đã xuất",
  cancelled: "Đã hủy",
};

export default function OutboundPage({ api = outboundApi }: { api?: OutboundClient }) {
  const [items, setItems] = useState<Outbound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [releasing, setReleasing] = useState("");

  useEffect(() => {
    api.listOutbounds()
      .then(setItems)
      .catch(() => setError("Không thể tải phiếu xuất."))
      .finally(() => setLoading(false));
  }, [api]);

  async function release(item: Outbound) {
    setReleasing(item.id);
    setError("");
    try {
      const result = await api.releaseOutbound(item.id);
      setItems((rows) => rows.map((row) => row.id === item.id
        ? { ...row, status: "ready_to_pick", reservedUntil: result.reservedUntil }
        : row));
    } catch {
      setError("Không thể release phiếu xuất. Kiểm tra tồn khả dụng.");
    } finally {
      setReleasing("");
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải phiếu xuất…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={pageTitleClass}>Phiếu xuất</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Giữ tồn theo FEFO trước khi soạn.</p>
        </div>
        <Link to="/outbounds/create" className={primaryButtonClass}><PlusIcon className="h-4 w-4" />Thêm phiếu xuất</Link>
      </div>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <section className={`${panelClass} p-5`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách phiếu xuất</h2>
        <div className="mt-3 overflow-x-auto">
          <table className={tableClass}>
            <thead><tr><th>Số phiếu</th><th>Trạng thái</th><th>Số dòng</th><th className="text-right!">Action</th></tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-gray-500 dark:text-gray-400">Chưa có phiếu xuất.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.documentNo}</td>
                  <td>{statuses[item.status]}</td>
                  <td>{item.lineCount}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      aria-label={`Release phiếu ${item.documentNo}`}
                      disabled={item.status !== "draft" || releasing === item.id}
                      onClick={() => release(item)}
                      className={`${secondaryButtonClass} h-9 w-9 px-0`}
                    >
                      <CheckLineIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function OutboundCreatePage({ api = outboundApi }: { api?: OutboundClient }) {
  const [products, setProducts] = useState<Awaited<ReturnType<OutboundClient["listProducts"]>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.listProducts()
      .then(setProducts)
      .catch(() => setError("Không thể tải sản phẩm."))
      .finally(() => setLoading(false));
  }, [api]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.createOutbound({
        documentNo: String(data.get("documentNo")).trim(),
        lines: [{ productId: String(data.get("productId")), quantity: Number(data.get("quantity")) }],
      });
      setMessage("Đã tạo phiếu xuất");
      form.reset();
    } catch {
      setError("Không thể tạo phiếu xuất.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải biểu mẫu…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitleClass}>Tạo phiếu xuất</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tạo nháp, sau đó release tại danh sách.</p>
      </div>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      {message && <p role="status" className={successClass}>{message}</p>}
      <form onSubmit={submit} className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`}>
        <label className={labelClass}>Số phiếu<input name="documentNo" required maxLength={80} className={inputClass} /></label>
        <label className={labelClass}>Sản phẩm<select name="productId" required className={inputClass}><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></label>
        <label className={labelClass}>Số lượng<input name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required className={inputClass} /></label>
        <div className="flex items-end gap-3">
          <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Đang lưu…" : "Tạo phiếu xuất"}</button>
          <Link to="/outbounds" className={secondaryButtonClass}>Quay lại</Link>
        </div>
      </form>
    </div>
  );
}
