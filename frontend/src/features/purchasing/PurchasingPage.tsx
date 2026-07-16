import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { purchasingApi, type PurchasingClient } from "../../lib/api";
import {
  inputClass,
  labelClass,
  pageTitleClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successClass,
  tableClass,
} from "../themeStyles";

export default function PurchasingPage({ api = purchasingApi }: { api?: PurchasingClient }) {
  const [rows, setRows] = useState<Awaited<ReturnType<PurchasingClient["list"]>>>([]);

  useEffect(() => { api.list().then(setRows); }, [api]);

  async function approve(id: string) {
    await api.approve(id);
    setRows((items) => items.map((item) => item.id === id ? { ...item, status: "approved" } : item));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={pageTitleClass}>Đơn mua hàng</h1>
        <Link className={primaryButtonClass} to="/purchasing/create">Tạo PO</Link>
      </div>
      <div className={panelClass}>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead><tr><th>Số PO</th><th>Nhà cung cấp</th><th>Còn phải nhập</th><th>Thao tác</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <td>{row.orderNo}</td><td>{row.supplierName}</td><td>{row.outstandingQuantity}</td>
                <td><button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => approve(row.id)}>Duyệt PO</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type PurchaseLineDraft = { key: string; productId: string; quantity: string };

export function PurchaseCreatePage({ api = purchasingApi }: { api?: PurchasingClient }) {
  const [suppliers, setSuppliers] = useState<Awaited<ReturnType<PurchasingClient["listSuppliers"]>>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<PurchasingClient["listProducts"]>>>([]);
  const [orderNo, setOrderNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<PurchaseLineDraft[]>([{ key: "line-1", productId: "", quantity: "1" }]);
  const nextLineId = useRef(2);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.listSuppliers(), api.listProducts()]).then(([nextSuppliers, nextProducts]) => {
      setSuppliers(nextSuppliers);
      setProducts(nextProducts);
    });
  }, [api]);

  function updateLine(key: string, patch: Partial<PurchaseLineDraft>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function addLine() {
    const key = `line-${nextLineId.current++}`;
    setLines((current) => [...current, { key, productId: "", quantity: "1" }]);
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
    if (!orderNo.trim() || !supplierId || Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    setError("");
    setCreated(false);
    try {
      await api.create({
        orderNo: orderNo.trim(),
        supplierId,
        lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
      });
      setCreated(true);
      setOrderNo("");
      setSupplierId("");
      setLines([{ key: `line-${nextLineId.current++}`, productId: "", quantity: "1" }]);
      setLineErrors({});
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Không thể tạo PO");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className={`max-w-4xl space-y-5 ${panelClass} p-5`}>
      <h1 className={pageTitleClass}>Tạo PO</h1>
      {created && <p role="status" className={successClass}>Đã tạo PO</p>}
      {error && <p role="alert" className="text-sm text-error-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Số PO (*)<input required className={inputClass} value={orderNo} onChange={(event) => setOrderNo(event.target.value)} /></label>
        <label className={labelClass}>Nhà cung cấp (*)<select required className={inputClass} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Chọn nhà cung cấp</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
      </div>
      <div className="space-y-3">
        {lines.map((line, index) => (
          <fieldset key={line.key} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.35fr)_auto] sm:items-end dark:border-gray-800">
            <legend className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Dòng {index + 1}</legend>
            <label className={labelClass}>Sản phẩm dòng {index + 1} (*)
              <select required className={inputClass} value={line.productId} onChange={(event) => updateLine(line.key, { productId: event.target.value })}><option value="">Chọn sản phẩm</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}</select>
            </label>
            <label className={labelClass}>Số lượng dòng {index + 1} (*)
              <input required type="number" min="0.0001" step="any" className={inputClass} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} />
            </label>
            <button type="button" disabled={lines.length === 1 || busy} className={secondaryButtonClass} aria-label={`Xóa dòng ${index + 1}`} onClick={() => removeLine(line.key)}>Xóa dòng</button>
            {lineErrors[line.key] && <p role="alert" className="text-sm text-error-600 sm:col-span-3">Dòng {index + 1}: {lineErrors[line.key]}</p>}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} className={secondaryButtonClass} onClick={addLine}>Thêm dòng</button>
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Đang tạo…" : "Tạo PO"}</button>
      </div>
    </form>
  );
}
