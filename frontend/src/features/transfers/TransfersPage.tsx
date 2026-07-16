import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { transferApi, type TransferClient } from "../../lib/api";
import { inputClass, labelClass, pageTitleClass, panelClass, primaryButtonClass, secondaryButtonClass, successClass, tableClass } from "../themeStyles";

export default function TransfersPage({ api = transferApi }: { api?: TransferClient }) {
  const [rows, setRows] = useState<Awaited<ReturnType<TransferClient["list"]>>>([]);
  useEffect(() => { api.list().then(setRows); }, [api]);

  async function dispatch(id: string) { await api.dispatch(id); setRows((items) => items.map((item) => item.id === id ? { ...item, status: "in_transit" } : item)); }
  async function cancel(id: string) { await api.cancel(id); setRows((items) => items.map((item) => item.id === id ? { ...item, status: "cancelled" } : item)); }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className={pageTitleClass}>Chuyển kho</h1><Link to="/transfers/create" className={primaryButtonClass}>Tạo transfer</Link></div>
    <div className={panelClass}><div className="overflow-x-auto"><table className={tableClass}>
      <thead><tr><th>Số</th><th>Nguồn → Đích</th><th>Qty</th><th>Trạng thái</th><th>Action</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{row.transferNo}</td><td>{row.sourceWarehouse} → {row.targetWarehouse}</td><td>{row.quantity}</td><td>{row.status}</td><td><div className="flex gap-2"><button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => dispatch(row.id)}>Dispatch</button><button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => cancel(row.id)}>Hủy</button></div></td></tr>)}</tbody>
    </table></div></div>
  </div>;
}

export function TransferCreatePage({ api = transferApi }: { api?: TransferClient }) {
  const [balances, setBalances] = useState<Awaited<ReturnType<TransferClient["listBalances"]>>>([]);
  const [created, setCreated] = useState(false);
  useEffect(() => { api.listBalances().then(setBalances); }, [api]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api.create({ transferNo: String(data.get("transferNo")), targetWarehouseId: String(data.get("targetWarehouseId")), lines: [{ stockBalanceId: String(data.get("stockBalanceId")), quantity: Number(data.get("quantity")) }] });
    setCreated(true);
  }

  return <form onSubmit={submit} className={`grid max-w-2xl gap-4 sm:grid-cols-2 ${panelClass} p-5`}>
    <h1 className={`sm:col-span-2 ${pageTitleClass}`}>Tạo transfer</h1>
    {created && <p role="status" className={`sm:col-span-2 ${successClass}`}>Đã tạo transfer</p>}
    <label className={labelClass}>Số phiếu chuyển (*)<input name="transferNo" required className={inputClass} /></label>
    <label className={labelClass}>ID kho đích (*)<input name="targetWarehouseId" required className={inputClass} /></label>
    <label className={labelClass}>Tồn nguồn (*)<select name="stockBalanceId" required className={inputClass}><option value="">Chọn tồn</option>{balances.filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.sku} / {item.locationCode} / {item.available}</option>)}</select></label>
    <label className={labelClass}>Số lượng (*)<input name="quantity" type="number" min="0.0001" required className={inputClass} /></label>
    <button className={primaryButtonClass}>Tạo transfer</button>
  </form>;
}
