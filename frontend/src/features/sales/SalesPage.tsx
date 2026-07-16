import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { salesApi, type SalesClient } from "../../lib/api";
import { errorClass, inputClass, labelClass, pageTitleClass, panelClass, primaryButtonClass, secondaryButtonClass, successClass, tableClass } from "../themeStyles";

export default function SalesPage({ api = salesApi }: { api?: SalesClient }) {
  const [rows, setRows] = useState<Awaited<ReturnType<SalesClient["list"]>>>([]);
  const [error, setError] = useState("");
  useEffect(() => { api.list().then(setRows).catch(() => setError("Không thể tải bán hàng.")); }, [api]);

  async function approve(id: string) {
    try {
      await api.approve(id);
      setRows((items) => items.map((item) => item.id === id ? { ...item, status: "approved" } : item));
    } catch { setError("Không thể duyệt chứng từ."); }
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className={pageTitleClass}>Báo giá và đơn bán</h1><Link to="/sales/create" className={primaryButtonClass}>Tạo chứng từ</Link></div>
    {error && <p role="alert" className={errorClass}>{error}</p>}
    <div className={panelClass}><div className="overflow-x-auto"><table className={tableClass}>
      <thead><tr><th>Số</th><th>Loại</th><th>Khách hàng</th><th>Tổng</th><th>Thao tác</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{row.documentNo}</td><td>{row.kind}</td><td>{row.customerName}</td><td>{row.total.toLocaleString("vi-VN")}</td><td><button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => approve(row.id)}>Duyệt</button></td></tr>)}</tbody>
    </table></div></div>
  </div>;
}

type SalesLineDraft = { key: string; productId: string; quantity: string; unitPrice: string; taxRate: string };

function newLine(key: string): SalesLineDraft {
  return { key, productId: "", quantity: "1", unitPrice: "0", taxRate: "0" };
}

function lineTotal(line: SalesLineDraft) {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  const taxRate = Number(line.taxRate);
  if (![quantity, unitPrice, taxRate].every(Number.isFinite)) return 0;
  return Math.round(quantity * unitPrice * (1 + taxRate / 100) * 100) / 100;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} đ`;
}

export function SalesCreatePage({ api = salesApi }: { api?: SalesClient }) {
  const [customers, setCustomers] = useState<Awaited<ReturnType<SalesClient["listCustomers"]>>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<SalesClient["listProducts"]>>>([]);
  const [documentNo, setDocumentNo] = useState("");
  const [kind, setKind] = useState<"quote" | "order">("quote");
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<SalesLineDraft[]>([newLine("line-1")]);
  const nextLineId = useRef(2);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const grandTotal = Math.round(lines.reduce((sum, line) => sum + lineTotal(line), 0) * 100) / 100;

  useEffect(() => {
    Promise.all([api.listCustomers(), api.listProducts()]).then(([nextCustomers, nextProducts]) => {
      setCustomers(nextCustomers);
      setProducts(nextProducts);
    });
  }, [api]);

  function updateLine(key: string, patch: Partial<SalesLineDraft>) {
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
      const unitPrice = Number(line.unitPrice);
      const taxRate = Number(line.taxRate);
      if (!line.productId) nextErrors[line.key] = "Phải chọn sản phẩm";
      else if (!Number.isFinite(quantity) || quantity <= 0) nextErrors[line.key] = "Số lượng phải lớn hơn 0";
      else if (!Number.isFinite(unitPrice) || unitPrice < 0) nextErrors[line.key] = "Đơn giá không được âm";
      else if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) nextErrors[line.key] = "Thuế phải từ 0 đến 100%";
    }
    setLineErrors(nextErrors);
    if (!documentNo.trim() || !customerId || Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    setError("");
    setCreated(false);
    try {
      await api.create({
        documentNo: documentNo.trim(),
        kind,
        customerId,
        lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxRate: Number(line.taxRate) })),
      });
      setCreated(true);
      setDocumentNo("");
      setKind("quote");
      setCustomerId("");
      setLines([newLine(`line-${nextLineId.current++}`)]);
      setLineErrors({});
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Không thể tạo chứng từ");
    } finally {
      setBusy(false);
    }
  }

  return <form noValidate onSubmit={submit} className={`max-w-6xl space-y-5 ${panelClass} p-5`}>
    <h1 className={pageTitleClass}>Tạo báo giá / đơn bán</h1>
    {created && <p role="status" className={successClass}>Đã tạo chứng từ</p>}
    {error && <p role="alert" className={errorClass}>{error}</p>}
    <div className="grid gap-4 sm:grid-cols-3">
      <label className={labelClass}>Số chứng từ (*)<input required className={inputClass} value={documentNo} onChange={(event) => setDocumentNo(event.target.value)} /></label>
      <label className={labelClass}>Loại (*)<select required className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as "quote" | "order")}><option value="quote">Báo giá</option><option value="order">Đơn bán</option></select></label>
      <label className={labelClass}>Khách hàng (*)<select required className={inputClass} value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Chọn khách</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
    </div>
    <div className="space-y-3">
      {lines.map((line, index) => (
        <fieldset key={line.key} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_8rem_10rem_8rem_auto] xl:items-end dark:border-gray-800">
          <legend className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Dòng {index + 1}</legend>
          <label className={labelClass}>Sản phẩm dòng {index + 1} (*)<select required className={inputClass} value={line.productId} onChange={(event) => updateLine(line.key, { productId: event.target.value })}><option value="">Chọn sản phẩm</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}</select></label>
          <label className={labelClass}>Số lượng dòng {index + 1} (*)<input required type="number" min="0.0001" step="any" className={inputClass} value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} /></label>
          <label className={labelClass}>Đơn giá dòng {index + 1} (*)<input required type="number" min="0" step="any" className={inputClass} value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} /></label>
          <label className={labelClass}>Thuế dòng {index + 1} (%) (*)<input required type="number" min="0" max="100" step="any" className={inputClass} value={line.taxRate} onChange={(event) => updateLine(line.key, { taxRate: event.target.value })} /></label>
          <button type="button" disabled={lines.length === 1 || busy} className={secondaryButtonClass} aria-label={`Xóa dòng ${index + 1}`} onClick={() => removeLine(line.key)}>Xóa dòng</button>
          <p className="text-sm font-semibold text-gray-700 sm:col-span-2 xl:col-span-5 dark:text-gray-300">Tổng dòng {index + 1}: {formatMoney(lineTotal(line))}</p>
          {lineErrors[line.key] && <p role="alert" className="text-sm text-error-600 sm:col-span-2 xl:col-span-5">Dòng {index + 1}: {lineErrors[line.key]}</p>}
        </fieldset>
      ))}
    </div>
    <p className="text-lg font-semibold text-gray-900 dark:text-white">Tổng chứng từ: {formatMoney(grandTotal)}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} className={secondaryButtonClass} onClick={addLine}>Thêm dòng</button>
      <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Đang tạo…" : "Tạo chứng từ"}</button>
    </div>
  </form>;
}
