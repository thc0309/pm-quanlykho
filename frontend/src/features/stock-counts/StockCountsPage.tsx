import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { stockCountApi, type InventoryBalance, type StockCountClient } from "../../lib/api";
import { inputClass, labelClass, pageTitleClass, panelClass, primaryButtonClass, secondaryButtonClass, successClass, tableClass } from "../themeStyles";

const countStatusLabels: Record<string, string> = {
  draft: "Nháp",
  submitted: "Chờ duyệt",
  confirmed: "Đã duyệt",
  cancelled: "Đã hủy",
};

export default function StockCountsPage({ api = stockCountApi }: { api?: StockCountClient }) {
  const [rows, setRows] = useState<Awaited<ReturnType<StockCountClient["list"]>>>([]);

  useEffect(() => {
    api.list().then(setRows);
  }, [api]);

  async function action(id: string, status: "submitted" | "confirmed") {
    if (status === "submitted") await api.submit(id); else await api.approve(id);
    setRows((items) => items.map((item) => item.id === id ? { ...item, status } : item));
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className={pageTitleClass}>Kiểm kê kho</h1>
      <Link to="/stock-counts/create" className={primaryButtonClass}>Tạo kiểm kê</Link>
    </div>
    <div className={panelClass}>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead><tr><th>Số kiểm kê</th><th>Tiến độ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td>{row.countNo}</td><td>{row.countedLines}/{row.lineCount}</td><td>{countStatusLabels[row.status] ?? row.status}</td>
            <td>{row.status === "draft" ? <button className={secondaryButtonClass} onClick={() => action(row.id, "submitted")}>Gửi duyệt</button> : row.status === "submitted" ? <button className={secondaryButtonClass} onClick={() => action(row.id, "confirmed")}>Duyệt điều chỉnh</button> : null}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}

export function StockCountCreatePage({ api = stockCountApi }: { api?: StockCountClient }) {
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [countNo, setCountNo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listBalances().then(setBalances);
  }, [api]);

  function clearMessages() {
    setCreated(false);
    setError("");
  }

  function toggleBalance(id: string) {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
    clearMessages();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    if (!countNo.trim()) {
      setError("Vui lòng nhập số kiểm kê.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Chọn ít nhất một tồn kho cần đếm.");
      return;
    }

    try {
      await api.create({ countNo: countNo.trim(), stockBalanceIds: selectedIds });
      setCountNo("");
      setSelectedIds([]);
      setCreated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo kiểm kê. Vui lòng thử lại.");
    }
  }

  return <form noValidate onSubmit={submit} className={`max-w-2xl space-y-4 ${panelClass} p-5`}>
    <h1 className={pageTitleClass}>Tạo kiểm kê</h1>
    {created && <p role="status" className={successClass}>Đã chốt số liệu kiểm kê</p>}
    {error && <p role="alert" className="text-sm text-error-600 dark:text-error-400">{error}</p>}
    <label className={labelClass}>Số kiểm kê (*)
      <input value={countNo} onChange={(event) => { setCountNo(event.target.value); clearMessages(); }} required className={inputClass} />
    </label>
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-700 dark:text-gray-400">Tồn cần đếm (*)</legend>
      {balances.filter((balance) => balance.id).map((balance) => <label key={balance.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={selectedIds.includes(balance.id!)} onChange={() => toggleBalance(balance.id!)} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700" />
        <span>{balance.sku} / {balance.locationCode} / tồn {balance.onHand}</span>
      </label>)}
      {balances.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Không có tồn kho để kiểm kê.</p>}
    </fieldset>
    <button className={primaryButtonClass}>Chốt số liệu</button>
  </form>;
}
