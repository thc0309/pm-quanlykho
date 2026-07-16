import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { returnApi, type ReturnClient } from "../../lib/api";
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

export default function ReturnsPage({ api = returnApi }: { api?: ReturnClient }) {
  const [rows, setRows] = useState<Awaited<ReturnType<ReturnClient["list"]>>>([]);

  useEffect(() => {
    api.list().then(setRows);
  }, [api]);

  async function confirm(id: string) {
    await api.confirm(id);
    setRows((items) => items.map((item) => item.id === id ? { ...item, status: "confirmed" } : item));
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className={pageTitleClass}>Phiếu trả hàng</h1>
      <Link to="/returns/create" className={primaryButtonClass}>Tạo phiếu trả</Link>
    </div>
    <div className={panelClass}>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead><tr><th>Số phiếu</th><th>Loại</th><th>Chứng từ gốc</th><th>Thao tác</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td>{row.returnNo}</td>
            <td>{row.kind === "customer" ? "Khách trả" : "Trả nhà cung cấp"}</td>
            <td>{row.originalDocumentNo}</td>
            <td><button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => confirm(row.id)}>Xác nhận trả</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}

type ReturnLineDraft = {
  key: string;
  originalMovementId: string;
  quantity: string;
};

function newLine(key: string): ReturnLineDraft {
  return { key, originalMovementId: "", quantity: "1" };
}

export function ReturnCreatePage({ api = returnApi }: { api?: ReturnClient }) {
  const [returnNo, setReturnNo] = useState("");
  const [kind, setKind] = useState<"customer" | "supplier">("customer");
  const [originalDocumentId, setOriginalDocumentId] = useState("");
  const [lines, setLines] = useState<ReturnLineDraft[]>([newLine("line-1")]);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const nextLineId = useRef(2);

  function addLine() {
    setLines((items) => [...items, newLine(`line-${nextLineId.current++}`)]);
    setCreated(false);
    setError("");
  }

  function removeLine(key: string) {
    setLines((items) => items.length === 1 ? items : items.filter((line) => line.key !== key));
    setCreated(false);
    setError("");
  }

  function updateLine(key: string, field: "originalMovementId" | "quantity", value: string) {
    setLines((items) => items.map((line) => line.key === key ? { ...line, [field]: value } : line));
    setCreated(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreated(false);
    setError("");

    const normalizedLines = lines.map((line) => ({
      originalMovementId: line.originalMovementId.trim(),
      quantity: Number(line.quantity),
    }));
    if (!returnNo.trim() || !originalDocumentId.trim() || normalizedLines.some((line) => !line.originalMovementId || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
      setError("Vui lòng nhập đầy đủ thông tin và số lượng lớn hơn 0.");
      return;
    }

    try {
      await api.create({
        returnNo: returnNo.trim(),
        kind,
        originalDocumentId: originalDocumentId.trim(),
        lines: normalizedLines,
      });
      setReturnNo("");
      setKind("customer");
      setOriginalDocumentId("");
      setLines([newLine(`line-${nextLineId.current++}`)]);
      setCreated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo phiếu trả. Vui lòng thử lại.");
    }
  }

  return <form noValidate onSubmit={submit} className={`grid max-w-3xl gap-4 sm:grid-cols-2 ${panelClass} p-5`}>
    <h1 className={`sm:col-span-2 ${pageTitleClass}`}>Tạo phiếu trả</h1>
    {created && <p role="status" className={`sm:col-span-2 ${successClass}`}>Đã tạo phiếu trả</p>}
    {error && <p role="alert" className="sm:col-span-2 text-sm text-error-600 dark:text-error-400">{error}</p>}

    <label className={labelClass}>Số phiếu (*)
      <input value={returnNo} onChange={(event) => { setReturnNo(event.target.value); setCreated(false); setError(""); }} required className={inputClass} />
    </label>
    <label className={labelClass}>Loại (*)
      <select value={kind} onChange={(event) => { setKind(event.target.value as "customer" | "supplier"); setCreated(false); setError(""); }} required className={inputClass}>
        <option value="customer">Khách trả</option>
        <option value="supplier">Trả nhà cung cấp</option>
      </select>
    </label>
    <label className={`sm:col-span-2 ${labelClass}`}>ID chứng từ gốc (*)
      <input value={originalDocumentId} onChange={(event) => { setOriginalDocumentId(event.target.value); setCreated(false); setError(""); }} required className={inputClass} />
    </label>

    <div className="space-y-3 sm:col-span-2">
      {lines.map((line, index) => <fieldset key={line.key} className="grid gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] dark:border-gray-700">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-white/90">Dòng {index + 1}</legend>
        <label className={labelClass}>ID biến động kho gốc dòng {index + 1} (*)
          <input value={line.originalMovementId} onChange={(event) => updateLine(line.key, "originalMovementId", event.target.value)} required className={inputClass} />
        </label>
        <label className={labelClass}>Số lượng dòng {index + 1} (*)
          <input value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} type="number" min="0.0001" step="any" required className={inputClass} />
        </label>
        <button type="button" aria-label={`Xóa dòng ${index + 1}`} disabled={lines.length === 1} onClick={() => removeLine(line.key)} className={`${secondaryButtonClass} self-end disabled:cursor-not-allowed disabled:opacity-50`}>Xóa dòng</button>
      </fieldset>)}
      <button type="button" onClick={addLine} className={secondaryButtonClass}>Thêm dòng</button>
    </div>

    <button className={primaryButtonClass}>Tạo phiếu trả</button>
  </form>;
}
