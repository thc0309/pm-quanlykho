import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { transferApi, type InventoryBalance, type TransferClient } from "../../lib/api";
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

const transferStatusLabels: Record<string, string> = {
  draft: "Nháp",
  in_transit: "Đang chuyển",
  received: "Đã nhận",
  cancelled: "Đã hủy",
  reversed: "Đã hoàn tác",
};

export default function TransfersPage({ api = transferApi }: { api?: TransferClient }) {
  const [rows, setRows] = useState<Awaited<ReturnType<TransferClient["list"]>>>([]);

  useEffect(() => {
    api.list().then(setRows);
  }, [api]);

  async function dispatch(id: string) {
    await api.dispatch(id);
    setRows((items) => items.map((item) => item.id === id ? { ...item, status: "in_transit" } : item));
  }

  async function cancel(id: string) {
    await api.cancel(id);
    setRows((items) => items.map((item) => item.id === id ? { ...item, status: "cancelled" } : item));
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className={pageTitleClass}>Chuyển kho</h1>
      <Link to="/transfers/create" className={primaryButtonClass}>Tạo phiếu chuyển</Link>
    </div>
    <div className={panelClass}>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead><tr><th>Số phiếu</th><th>Nguồn → Đích</th><th>Số lượng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td>{row.transferNo}</td>
            <td>{row.sourceWarehouse} → {row.targetWarehouse}</td>
            <td>{row.quantity}</td>
            <td>{transferStatusLabels[row.status] ?? row.status}</td>
            <td><div className="flex gap-2">
              <button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => dispatch(row.id)}>Điều chuyển</button>
              <button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => cancel(row.id)}>Hủy</button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}

type TransferLineDraft = { key: string; stockBalanceId: string; quantity: string };

function newLine(key: string): TransferLineDraft {
  return { key, stockBalanceId: "", quantity: "1" };
}

function findBalance(balances: InventoryBalance[], id: string) {
  return balances.find((balance) => balance.id === id);
}

export function TransferCreatePage({ api = transferApi }: { api?: TransferClient }) {
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [transferNo, setTransferNo] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [lines, setLines] = useState<TransferLineDraft[]>([newLine("line-1")]);
  const [created, setCreated] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const nextLineId = useRef(2);

  useEffect(() => {
    api.listBalances().then(setBalances);
  }, [api]);

  const sourceWarehouseId = lines
    .map((line) => findBalance(balances, line.stockBalanceId)?.warehouseId)
    .find(Boolean);
  const sourceBalances = balances.filter((balance) => balance.id && (!sourceWarehouseId || balance.warehouseId === sourceWarehouseId));

  function clearMessages() {
    setCreated(false);
    setErrors([]);
  }

  function addLine() {
    setLines((items) => [...items, newLine(`line-${nextLineId.current++}`)]);
    clearMessages();
  }

  function removeLine(key: string) {
    setLines((items) => items.length === 1 ? items : items.filter((line) => line.key !== key));
    clearMessages();
  }

  function updateLine(key: string, field: "stockBalanceId" | "quantity", value: string) {
    setLines((items) => items.map((line) => line.key === key ? { ...line, [field]: value } : line));
    clearMessages();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    const validationErrors: string[] = [];
    const seen = new Set<string>();
    const normalizedLines = lines.map((line, index) => {
      const balance = findBalance(balances, line.stockBalanceId);
      const quantity = Number(line.quantity);
      if (!balance) validationErrors.push(`Dòng ${index + 1}: chọn tồn nguồn hợp lệ.`);
      if (!Number.isFinite(quantity) || quantity <= 0) validationErrors.push(`Dòng ${index + 1}: số lượng phải lớn hơn 0.`);
      if (balance && quantity > balance.available) validationErrors.push(`Dòng ${index + 1}: số lượng vượt tồn khả dụng (${balance.available}).`);
      if (line.stockBalanceId && seen.has(line.stockBalanceId)) validationErrors.push(`Dòng ${index + 1}: tồn nguồn đã được chọn ở dòng khác.`);
      if (line.stockBalanceId) seen.add(line.stockBalanceId);
      if (balance && sourceWarehouseId && balance.warehouseId !== sourceWarehouseId) validationErrors.push(`Dòng ${index + 1}: tồn nguồn phải cùng kho.`);
      return { stockBalanceId: line.stockBalanceId, quantity };
    });

    if (!transferNo.trim()) validationErrors.unshift("Vui lòng nhập số phiếu chuyển.");
    if (!targetWarehouseId.trim()) validationErrors.unshift("Vui lòng nhập ID kho đích.");
    if (sourceWarehouseId && targetWarehouseId.trim() === sourceWarehouseId) validationErrors.unshift("Kho đích phải khác kho nguồn.");
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    try {
      await api.create({ transferNo: transferNo.trim(), targetWarehouseId: targetWarehouseId.trim(), lines: normalizedLines });
      setTransferNo("");
      setTargetWarehouseId("");
      setLines([newLine(`line-${nextLineId.current++}`)]);
      setCreated(true);
    } catch (cause) {
      setErrors([cause instanceof Error ? cause.message : "Không thể tạo phiếu chuyển. Vui lòng thử lại."]);
    }
  }

  return <form noValidate onSubmit={submit} className={`grid max-w-3xl gap-4 sm:grid-cols-2 ${panelClass} p-5`}>
    <h1 className={`sm:col-span-2 ${pageTitleClass}`}>Tạo phiếu chuyển</h1>
    {created && <p role="status" className={`sm:col-span-2 ${successClass}`}>Đã tạo phiếu chuyển</p>}
    {errors.length > 0 && <ul role="alert" className="sm:col-span-2 list-disc space-y-1 pl-5 text-sm text-error-600 dark:text-error-400">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    <label className={labelClass}>Số phiếu chuyển (*)
      <input value={transferNo} onChange={(event) => { setTransferNo(event.target.value); clearMessages(); }} required className={inputClass} />
    </label>
    <label className={labelClass}>ID kho đích (*)
      <input value={targetWarehouseId} onChange={(event) => { setTargetWarehouseId(event.target.value); clearMessages(); }} required className={inputClass} />
    </label>
    <div className="space-y-3 sm:col-span-2">
      {lines.map((line, index) => <fieldset key={line.key} className="grid gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] dark:border-gray-700">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-white/90">Dòng {index + 1}</legend>
        <label className={labelClass}>Tồn nguồn dòng {index + 1} (*)
          <select value={line.stockBalanceId} onChange={(event) => updateLine(line.key, "stockBalanceId", event.target.value)} required className={inputClass}>
            <option value="">Chọn tồn</option>
            {sourceBalances.map((balance) => <option key={balance.id} value={balance.id}>{balance.sku} / {balance.locationCode} / khả dụng {balance.available}</option>)}
          </select>
        </label>
        <label className={labelClass}>Số lượng dòng {index + 1} (*)
          <input value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} type="number" min="0.0001" step="any" required className={inputClass} />
        </label>
        <button type="button" aria-label={`Xóa dòng ${index + 1}`} disabled={lines.length === 1} onClick={() => removeLine(line.key)} className={`${secondaryButtonClass} self-end disabled:cursor-not-allowed disabled:opacity-50`}>Xóa dòng</button>
      </fieldset>)}
      <button type="button" onClick={addLine} className={secondaryButtonClass}>Thêm dòng</button>
    </div>
    <button className={primaryButtonClass}>Tạo phiếu chuyển</button>
  </form>;
}
