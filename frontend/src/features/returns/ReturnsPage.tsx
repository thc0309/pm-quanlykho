import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { returnApi, type ReturnClient, type ReturnSourceLine } from "../../lib/api";
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
  const [sourceDocuments, setSourceDocuments] = useState<Awaited<ReturnType<ReturnClient["listSourceDocuments"]>>>([]);
  const [sourceLines, setSourceLines] = useState<ReturnSourceLine[]>([]);
  const [lines, setLines] = useState<ReturnLineDraft[]>([newLine("line-1")]);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const nextLineId = useRef(2);

  function resetLines() {
    setSourceLines([]);
    setLines([newLine(`line-${nextLineId.current++}`)]);
  }

  useEffect(() => {
    let active = true;
    api.listSourceDocuments(kind)
      .then((data) => {
        if (!active) return;
        setSourceDocuments(data);
      })
      .catch(() => {
        if (!active) return;
        setSourceDocuments([]);
        setError("Không thể tải danh sách chứng từ gốc.");
      })
      .finally(() => {
        if (active) setLoadingDocuments(false);
      });
    return () => {
      active = false;
    };
  }, [api, kind]);

  useEffect(() => {
    let active = true;
    if (!originalDocumentId) return () => {
      active = false;
    };
    api.listSourceLines(originalDocumentId)
      .then((data) => {
        if (!active) return;
        setSourceLines(data);
      })
      .catch(() => {
        if (!active) return;
        setSourceLines([]);
        setError("Không thể tải các dòng có thể trả.");
      })
      .finally(() => {
        if (active) setLoadingLines(false);
      });
    return () => {
      active = false;
    };
  }, [api, originalDocumentId]);

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

  function lineOptionText(line: ReturnSourceLine) {
    const details = [
      line.locationCode ? `Vị trí ${line.locationCode}` : null,
      line.lotCode ? `Lot ${line.lotCode}` : null,
      line.serialCode ? `Serial ${line.serialCode}` : null,
      `Còn lại ${line.remainingQuantity}`,
    ].filter(Boolean).join(" · ");
    return `${line.sku} - ${line.productName}${details ? ` · ${details}` : ""}`;
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
    const remainingByMovement = new Map(sourceLines.map((line) => [line.originalMovementId, line.remainingQuantity]));
    if (normalizedLines.some((line) => line.quantity > (remainingByMovement.get(line.originalMovementId) ?? 0))) {
      setError("Số lượng trả không được vượt quá số lượng còn có thể trả.");
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
      <select
        value={kind}
        onChange={(event) => {
          setKind(event.target.value as "customer" | "supplier");
          setLoadingDocuments(true);
          setLoadingLines(false);
          setSourceDocuments([]);
          setOriginalDocumentId("");
          resetLines();
          setCreated(false);
          setError("");
        }}
        required
        className={inputClass}
      >
        <option value="customer">Khách trả</option>
        <option value="supplier">Trả nhà cung cấp</option>
      </select>
    </label>
    <label className={`sm:col-span-2 ${labelClass}`}>Chứng từ gốc (*)
      <select
        value={originalDocumentId}
        onChange={(event) => {
          const value = event.target.value;
          setOriginalDocumentId(value);
          setLoadingLines(Boolean(value));
          resetLines();
          setCreated(false);
          setError("");
        }}
        required
        className={inputClass}
        disabled={loadingDocuments || sourceDocuments.length === 0}
      >
        <option value="">{loadingDocuments ? "Đang tải chứng từ gốc" : "Chọn chứng từ gốc"}</option>
        {sourceDocuments.map((document) => <option key={document.id} value={document.id}>{document.documentNo}{document.partnerName ? ` - ${document.partnerName}` : ""}</option>)}
      </select>
    </label>

    <div className="space-y-3 sm:col-span-2">
      {lines.map((line, index) => <fieldset key={line.key} className="grid gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] dark:border-gray-700">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-white/90">Dòng {index + 1}</legend>
        <label className={labelClass}>Sản phẩm dòng {index + 1} (*)
          <select value={line.originalMovementId} onChange={(event) => updateLine(line.key, "originalMovementId", event.target.value)} required className={inputClass} disabled={!originalDocumentId || loadingLines || sourceLines.length === 0}>
            <option value="">{loadingLines ? "Đang tải dòng trả" : "Chọn dòng trả"}</option>
            {sourceLines
              .filter((option) => option.originalMovementId === line.originalMovementId || !lines.some((item) => item.key !== line.key && item.originalMovementId === option.originalMovementId))
              .map((option) => <option key={option.originalMovementId} value={option.originalMovementId}>{lineOptionText(option)}</option>)}
          </select>
        </label>
        <label className={labelClass}>Số lượng dòng {index + 1} (*)
          <input value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} type="number" min="0.0001" step="any" required className={inputClass} />
        </label>
        <button type="button" aria-label={`Xóa dòng ${index + 1}`} disabled={lines.length === 1} onClick={() => removeLine(line.key)} className={`${secondaryButtonClass} self-end disabled:cursor-not-allowed disabled:opacity-50`}>Xóa dòng</button>
        {line.originalMovementId && sourceLines.find((option) => option.originalMovementId === line.originalMovementId) && <p className="sm:col-span-3 text-sm text-gray-500 dark:text-gray-400">
          {(() => {
            const selected = sourceLines.find((option) => option.originalMovementId === line.originalMovementId)!;
            return `Gốc ${selected.quantity} · Đã trả ${selected.claimedQuantity} · Còn lại ${selected.remainingQuantity}`;
          })()}
        </p>}
      </fieldset>)}
      <button type="button" onClick={addLine} disabled={!originalDocumentId || loadingLines || sourceLines.length === 0 || lines.length >= sourceLines.length} className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}>Thêm dòng</button>
      {!loadingLines && originalDocumentId && sourceLines.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Chứng từ này không còn dòng nào có thể trả.</p>}
    </div>

    <button className={primaryButtonClass}>Tạo phiếu trả</button>
  </form>;
}
