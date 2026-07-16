import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { CheckLineIcon, PlusIcon } from "../../icons";
import { receiptApi, type Receipt, type ReceiptClient, type ReceiptInput } from "../../lib/api";

const panelClass = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const labelClass = "text-sm font-medium text-gray-700 dark:text-gray-400";
const inputClass = "mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
const primaryButtonClass = "inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass = "inline-flex h-11 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const iconButtonClass = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const tableCellClass = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

const statusLabels: Record<Receipt["status"], string> = {
  draft: "Nháp",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy",
  reversed: "Đã đảo",
};

export default function ReceiptPage({ api = receiptApi }: { api?: ReceiptClient }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState("");

  useEffect(() => {
    api.listReceipts().then(setReceipts).catch(() => setError("Không thể tải phiếu nhập.")).finally(() => setLoading(false));
  }, [api]);

  async function confirm(receipt: Receipt) {
    setConfirming(receipt.id);
    setError("");
    try {
      await api.confirmReceipt(receipt.id);
      setReceipts((items) => items.map((item) => item.id === receipt.id ? { ...item, status: "confirmed" } : item));
    } catch {
      setError("Không thể xác nhận phiếu nhập.");
    } finally {
      setConfirming("");
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải phiếu nhập…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Phiếu nhập</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Nhận hàng theo vị trí, lô và serial.</p></div>
        <Link to="/receipts/create" className={primaryButtonClass}><PlusIcon className="h-4 w-4" />Thêm phiếu nhập</Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách phiếu nhập</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"><tr><th className="px-4 py-3">Số phiếu</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Số dòng</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {receipts.length === 0 ? <tr><td colSpan={4} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>Chưa có phiếu nhập.</td></tr> : receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className={`${tableCellClass} font-medium`}>{receipt.documentNo}</td><td className={tableCellClass}>{statusLabels[receipt.status]}</td><td className={tableCellClass}>{receipt.lineCount}</td>
                  <td className={`${tableCellClass} text-right`}>
                    {receipt.status === "confirmed" && <Link to={`/print/documents/${receipt.id}`} className="mr-2 inline-flex h-9 items-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">In phiếu</Link>}
                    <button type="button" disabled={receipt.status !== "draft" || confirming === receipt.id} onClick={() => confirm(receipt)} aria-label={`Xác nhận phiếu ${receipt.documentNo}`} className={iconButtonClass}><CheckLineIcon className="h-4 w-4" /></button>
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

type ReceiptLineDraft = {
  key: string;
  productId: string;
  locationId: string;
  quantity: string;
  lotCode: string;
  serialCode: string;
  manufacturedAt: string;
  expiresAt: string;
};

function newLine(key: string): ReceiptLineDraft {
  return { key, productId: "", locationId: "", quantity: "1", lotCode: "", serialCode: "", manufacturedAt: "", expiresAt: "" };
}

export function ReceiptCreatePage({ api = receiptApi }: { api?: ReceiptClient }) {
  const [products, setProducts] = useState<Awaited<ReturnType<ReceiptClient["listProducts"]>>>([]);
  const [locations, setLocations] = useState<Awaited<ReturnType<ReceiptClient["listLocations"]>>>([]);
  const [documentNo, setDocumentNo] = useState("");
  const [lines, setLines] = useState<ReceiptLineDraft[]>([newLine("line-1")]);
  const nextLineId = useRef(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.listProducts(), api.listLocations()])
      .then(([nextProducts, nextLocations]) => { setProducts(nextProducts); setLocations(nextLocations); })
      .catch(() => setError("Không thể tải sản phẩm hoặc vị trí."))
      .finally(() => setLoading(false));
  }, [api]);

  function productFor(line: ReceiptLineDraft) {
    return products.find((product) => product.id === line.productId);
  }

  function updateLine(key: string, patch: Partial<ReceiptLineDraft>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function changeProduct(line: ReceiptLineDraft, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(line.key, {
      productId,
      quantity: product?.trackingMode === "serial" ? "1" : line.quantity,
      lotCode: "",
      serialCode: "",
      manufacturedAt: "",
      expiresAt: "",
    });
    setLineErrors((current) => ({ ...current, [line.key]: "" }));
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

  function buildLine(line: ReceiptLineDraft): ReceiptInput["lines"][number] {
    const product = productFor(line)!;
    const result: ReceiptInput["lines"][number] = { locationId: line.locationId, productId: line.productId, quantity: Number(line.quantity) };
    if (product.trackingMode === "lot") {
      result.lotCode = line.lotCode.trim();
      if (line.manufacturedAt) result.manufacturedAt = line.manufacturedAt;
      if (line.expiresAt) result.expiresAt = line.expiresAt;
    } else if (product.trackingMode === "serial") {
      result.serialCode = line.serialCode.trim();
    }
    return result;
  }

  async function createReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const line of lines) {
      const product = productFor(line);
      const quantity = Number(line.quantity);
      if (!product) nextErrors[line.key] = "Phải chọn sản phẩm";
      else if (!line.locationId) nextErrors[line.key] = "Phải chọn vị trí";
      else if (!Number.isFinite(quantity) || quantity <= 0) nextErrors[line.key] = "Số lượng phải lớn hơn 0";
      else if (product.trackingMode === "lot" && !line.lotCode.trim()) nextErrors[line.key] = "Phải nhập mã lô";
      else if (product.expiryManaged && !line.expiresAt) nextErrors[line.key] = "Phải nhập hạn dùng";
      else if (product.trackingMode === "serial" && !line.serialCode.trim()) nextErrors[line.key] = "Phải nhập serial";
      else if (product.trackingMode === "serial" && quantity !== 1) nextErrors[line.key] = "Sản phẩm serial phải có số lượng bằng 1";
    }
    setLineErrors(nextErrors);
    if (!documentNo.trim() || Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.createReceipt({ documentNo: documentNo.trim(), lines: lines.map(buildLine) });
      setSuccess("Đã tạo phiếu nhập");
      setDocumentNo("");
      setLines([newLine(`line-${nextLineId.current++}`)]);
      setLineErrors({});
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Không thể tạo phiếu nhập. Kiểm tra tracking và hạn dùng.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status">Đang tải biểu mẫu…</p>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Tạo phiếu nhập</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tạo phiếu nháp rồi xác nhận tại danh sách.</p></div>
      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">{success}</p>}
      <form noValidate onSubmit={createReceipt} className={`max-w-6xl space-y-5 ${panelClass}`}>
        <label className={`${labelClass} block max-w-md`}>Số phiếu (*)<input required maxLength={80} className={inputClass} value={documentNo} onChange={(event) => setDocumentNo(event.target.value)} /></label>
        <div className="space-y-4">
          {lines.map((line, index) => {
            const product = productFor(line);
            return (
              <fieldset key={line.key} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-800">
                <legend className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Dòng {index + 1}</legend>
                <label className={labelClass}>Sản phẩm dòng {index + 1} (*)<select required className={inputClass} value={line.productId} onChange={(event) => changeProduct(line, event.target.value)}><option value="">Chọn sản phẩm</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}</select></label>
                <label className={labelClass}>Vị trí dòng {index + 1} (*)<select required className={inputClass} value={line.locationId} onChange={(event) => updateLine(line.key, { locationId: event.target.value })}><option value="">Chọn vị trí</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
                <label className={labelClass}>Số lượng dòng {index + 1} (*)<input required type="number" min="0.0001" max={product?.trackingMode === "serial" ? 1 : undefined} step="0.0001" className={inputClass} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} /></label>
                {product?.trackingMode === "lot" && <label className={labelClass}>Mã lô dòng {index + 1} (*)<input required maxLength={120} className={inputClass} value={line.lotCode} onChange={(event) => updateLine(line.key, { lotCode: event.target.value })} /></label>}
                {product?.trackingMode === "serial" && <label className={labelClass}>Serial dòng {index + 1} (*)<input required maxLength={120} className={inputClass} value={line.serialCode} onChange={(event) => updateLine(line.key, { serialCode: event.target.value })} /></label>}
                {product?.trackingMode === "lot" && <label className={labelClass}>Ngày sản xuất dòng {index + 1}<input type="date" className={inputClass} value={line.manufacturedAt} onChange={(event) => updateLine(line.key, { manufacturedAt: event.target.value })} /></label>}
                {product?.expiryManaged && <label className={labelClass}>Hạn dùng dòng {index + 1} (*)<input type="date" required className={inputClass} value={line.expiresAt} onChange={(event) => updateLine(line.key, { expiresAt: event.target.value })} /></label>}
                <div className="flex items-end"><button type="button" disabled={lines.length === 1 || saving} className={secondaryButtonClass} aria-label={`Xóa dòng ${index + 1}`} onClick={() => removeLine(line.key)}>Xóa dòng</button></div>
                {lineErrors[line.key] && <p role="alert" className="text-sm text-error-600 sm:col-span-2 lg:col-span-4">Dòng {index + 1}: {lineErrors[line.key]}</p>}
              </fieldset>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={saving} className={secondaryButtonClass} onClick={addLine}>Thêm dòng</button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Đang lưu…" : "Tạo phiếu nhập"}</button>
          <Link to="/receipts" className="inline-flex h-11 items-center px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Quay lại</Link>
        </div>
      </form>
    </div>
  );
}
