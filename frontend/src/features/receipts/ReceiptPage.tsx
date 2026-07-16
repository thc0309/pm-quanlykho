import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { CheckLineIcon, PlusIcon } from "../../icons";
import { receiptApi, type Receipt, type ReceiptClient, type ReceiptInput } from "../../lib/api";

const panelClass = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const labelClass = "text-sm font-medium text-gray-700 dark:text-gray-400";
const inputClass = "mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
const primaryButtonClass = "inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60";
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
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Phiếu nhập</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Nhận hàng theo vị trí, lô và serial.</p>
        </div>
        <Link to="/receipts/create" className={primaryButtonClass}><PlusIcon className="h-4 w-4" />Thêm phiếu nhập</Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách phiếu nhập</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
              <tr><th className="px-4 py-3">Số phiếu</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Số dòng</th><th className="px-4 py-3 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {receipts.length === 0 ? (
                <tr><td colSpan={4} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>Chưa có phiếu nhập.</td></tr>
              ) : receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className={`${tableCellClass} font-medium`}>{receipt.documentNo}</td>
                  <td className={tableCellClass}>{statusLabels[receipt.status]}</td>
                  <td className={tableCellClass}>{receipt.lineCount}</td>
                  <td className={`${tableCellClass} text-right`}>
                    {receipt.status === "confirmed" && (
                      <Link
                        to={`/print/documents/${receipt.id}`}
                        className="mr-2 inline-flex h-9 items-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                      >
                        In phiếu
                      </Link>
                    )}
                    <button type="button" disabled={receipt.status !== "draft" || confirming === receipt.id} onClick={() => confirm(receipt)} aria-label={`Xác nhận phiếu ${receipt.documentNo}`} className={iconButtonClass}>
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

export function ReceiptCreatePage({ api = receiptApi }: { api?: ReceiptClient }) {
  const [products, setProducts] = useState<Awaited<ReturnType<ReceiptClient["listProducts"]>>>([]);
  const [locations, setLocations] = useState<Awaited<ReturnType<ReceiptClient["listLocations"]>>>([]);
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const product = products.find((item) => item.id === productId);

  useEffect(() => {
    Promise.all([api.listProducts(), api.listLocations()])
      .then(([nextProducts, nextLocations]) => { setProducts(nextProducts); setLocations(nextLocations); })
      .catch(() => setError("Không thể tải sản phẩm hoặc vị trí."))
      .finally(() => setLoading(false));
  }, [api]);

  async function createReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setSuccess("");
    const data = new FormData(form);
    const line: ReceiptInput["lines"][number] = {
      locationId: String(data.get("locationId")),
      productId: String(data.get("productId")),
      quantity: Number(data.get("quantity")),
    };
    for (const key of ["lotCode", "serialCode", "manufacturedAt", "expiresAt"] as const) {
      const value = String(data.get(key) ?? "").trim();
      if (value) line[key] = value;
    }
    try {
      await api.createReceipt({ documentNo: String(data.get("documentNo")).trim(), lines: [line] });
      setSuccess("Đã tạo phiếu nhập");
      form.reset();
      setProductId("");
    } catch {
      setError("Không thể tạo phiếu nhập. Kiểm tra tracking và hạn dùng.");
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
      <form onSubmit={createReceipt} className={`grid gap-4 sm:grid-cols-2 ${panelClass}`}>
        <label className={labelClass}>Số phiếu<input name="documentNo" required maxLength={80} className={inputClass} /></label>
        <label className={labelClass}>Sản phẩm<select name="productId" required value={productId} onChange={(event) => setProductId(event.target.value)} className={inputClass}><option value="">Chọn sản phẩm</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}</select></label>
        <label className={labelClass}>Vị trí<select name="locationId" required className={inputClass}><option value="">Chọn vị trí</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
        <label className={labelClass}>Số lượng<input name="quantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required className={inputClass} /></label>
        {product?.trackingMode === "lot" && <label className={labelClass}>Mã lô<input name="lotCode" required maxLength={120} className={inputClass} /></label>}
        {product?.trackingMode === "serial" && <label className={labelClass}>Serial<input name="serialCode" required maxLength={120} className={inputClass} /></label>}
        {product?.trackingMode === "lot" && <label className={labelClass}>Ngày sản xuất<input name="manufacturedAt" type="date" className={inputClass} /></label>}
        {product?.expiryManaged && <label className={labelClass}>Hạn dùng<input name="expiresAt" type="date" required className={inputClass} /></label>}
        <div className="sm:col-span-2 flex gap-3"><button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Đang lưu…" : "Tạo phiếu nhập"}</button><Link to="/receipts" className="inline-flex h-11 items-center px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Quay lại</Link></div>
      </form>
    </div>
  );
}
