import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { CheckLineIcon, PlusIcon } from "../../icons";
import { outboundApi, type Outbound, type OutboundClient } from "../../lib/api";
import { errorClass, inputClass, labelClass, pageTitleClass, panelClass, primaryButtonClass, secondaryButtonClass, successClass, tableClass } from "../themeStyles";

const statuses: Record<Outbound["status"], string> = {
  draft: "Nháp", ready_to_pick: "Sẵn sàng soạn", picking: "Đang soạn", picked: "Đã soạn",
  checking: "Đang kiểm", needs_repick: "Cần soạn lại", shipped: "Đã xuất", cancelled: "Đã hủy",
};

export default function OutboundPage({ api = outboundApi }: { api?: OutboundClient }) {
  const [items, setItems] = useState<Outbound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [releasing, setReleasing] = useState("");

  useEffect(() => {
    api.listOutbounds().then(setItems).catch(() => setError("Không thể tải phiếu xuất.")).finally(() => setLoading(false));
  }, [api]);

  async function release(item: Outbound) {
    setReleasing(item.id);
    setError("");
    try {
      const result = await api.releaseOutbound(item.id);
      setItems((rows) => rows.map((row) => row.id === item.id ? { ...row, status: "ready_to_pick", reservedUntil: result.reservedUntil } : row));
    } catch {
      setError("Không thể release phiếu xuất. Kiểm tra tồn khả dụng.");
    } finally {
      setReleasing("");
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải phiếu xuất…</p>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className={pageTitleClass}>Phiếu xuất</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Giữ tồn theo FEFO trước khi soạn.</p></div>
      <Link to="/outbounds/create" className={primaryButtonClass}><PlusIcon className="h-4 w-4" />Thêm phiếu xuất</Link>
    </div>
    {error && <p role="alert" className={errorClass}>{error}</p>}
    <section className={`${panelClass} p-5`}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách phiếu xuất</h2>
      <div className="mt-3 overflow-x-auto"><table className={tableClass}>
        <thead><tr><th>Số phiếu</th><th>Trạng thái</th><th>Số dòng</th><th className="text-right!">Thao tác</th></tr></thead>
        <tbody>{items.length === 0 ? <tr><td colSpan={4} className="text-center text-gray-500 dark:text-gray-400">Chưa có phiếu xuất.</td></tr> : items.map((item) => (
          <tr key={item.id}><td className="font-medium">{item.documentNo}</td><td>{statuses[item.status]}</td><td>{item.lineCount}</td><td className="text-right">
            <button type="button" aria-label={`Release phiếu ${item.documentNo}`} disabled={item.status !== "draft" || releasing === item.id} onClick={() => release(item)} className={`${secondaryButtonClass} h-9 w-9 px-0`}><CheckLineIcon className="h-4 w-4" /></button>
          </td></tr>
        ))}</tbody>
      </table></div>
    </section>
  </div>;
}

type OutboundLineDraft = { key: string; productId: string; quantity: string };

function newLine(key: string): OutboundLineDraft {
  return { key, productId: "", quantity: "1" };
}

export function OutboundCreatePage({ api = outboundApi }: { api?: OutboundClient }) {
  const [products, setProducts] = useState<Awaited<ReturnType<OutboundClient["listProducts"]>>>([]);
  const [documentNo, setDocumentNo] = useState("");
  const [lines, setLines] = useState<OutboundLineDraft[]>([newLine("line-1")]);
  const nextLineId = useRef(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => setError("Không thể tải sản phẩm.")).finally(() => setLoading(false));
  }, [api]);

  function updateLine(key: string, patch: Partial<OutboundLineDraft>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function addLine() {
    setLines((current) => [...current, newLine(`line-${nextLineId.current++}`)]);
  }

  function removeLine(key: string) {
    setLines((current) => current.length === 1 ? current : current.filter((line) => line.key !== key));
    setLineErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const line of lines) {
      const quantity = Number(line.quantity);
      if (!line.productId) nextErrors[line.key] = "Phải chọn sản phẩm";
      else if (!Number.isFinite(quantity) || quantity <= 0) nextErrors[line.key] = "Số lượng phải lớn hơn 0";
    }
    setLineErrors(nextErrors);
    if (!documentNo.trim() || Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.createOutbound({ documentNo: documentNo.trim(), lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })) });
      setMessage("Đã tạo phiếu xuất");
      setDocumentNo("");
      setLines([newLine(`line-${nextLineId.current++}`)]);
      setLineErrors({});
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Không thể tạo phiếu xuất.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải biểu mẫu…</p>;

  return <div className="space-y-6">
    <div><h1 className={pageTitleClass}>Tạo phiếu xuất</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tạo nháp, sau đó release tại danh sách.</p></div>
    {error && <p role="alert" className={errorClass}>{error}</p>}
    {message && <p role="status" className={successClass}>{message}</p>}
    <form noValidate onSubmit={submit} className={`${panelClass} w-full  space-y-5 p-5`}>
      <label className={`${labelClass} block max-w-md`}>Số phiếu (*)<input required maxLength={80} className={inputClass} value={documentNo} onChange={(event) => setDocumentNo(event.target.value)} /></label>
      <div className="space-y-3">
        {lines.map((line, index) => <fieldset key={line.key} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.35fr)_auto] sm:items-end dark:border-gray-800">
          <legend className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Dòng {index + 1}</legend>
          <label className={labelClass}>Sản phẩm dòng {index + 1} (*)<select required className={inputClass} value={line.productId} onChange={(event) => updateLine(line.key, { productId: event.target.value })}><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></label>
          <label className={labelClass}>Số lượng dòng {index + 1} (*)<input required type="number" min="0.0001" step="0.0001" className={inputClass} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} /></label>
          <button type="button" disabled={lines.length === 1 || saving} className={secondaryButtonClass} aria-label={`Xóa dòng ${index + 1}`} onClick={() => removeLine(line.key)}>Xóa dòng</button>
          {lineErrors[line.key] && <p role="alert" className="text-sm text-error-600 sm:col-span-3">Dòng {index + 1}: {lineErrors[line.key]}</p>}
        </fieldset>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} className={secondaryButtonClass} onClick={addLine}>Thêm dòng</button>
        <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Đang lưu…" : "Tạo phiếu xuất"}</button>
        <Link to="/outbounds" className={secondaryButtonClass}>Quay lại</Link>
      </div>
    </form>
  </div>;
}
