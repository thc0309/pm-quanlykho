import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { stockCountApi, type StockCountClient } from "../../lib/api";
import { inputClass, labelClass, pageTitleClass, panelClass, primaryButtonClass, secondaryButtonClass, successClass, tableClass } from "../themeStyles";

export default function StockCountsPage({ api = stockCountApi }: { api?: StockCountClient }) {
  const [rows, setRows] = useState<Awaited<ReturnType<StockCountClient["list"]>>>([]);
  useEffect(() => { api.list().then(setRows); }, [api]);

  async function action(id: string, status: "submitted" | "confirmed") {
    if (status === "submitted") await api.submit(id); else await api.approve(id);
    setRows((items) => items.map((item) => item.id === id ? { ...item, status } : item));
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className={pageTitleClass}>Kiểm kê kho</h1><Link to="/stock-counts/create" className={primaryButtonClass}>Tạo kiểm kê</Link></div>
    <div className={panelClass}><div className="overflow-x-auto"><table className={tableClass}>
      <thead><tr><th>Số</th><th>Tiến độ</th><th>Trạng thái</th><th>Action</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{row.countNo}</td><td>{row.countedLines}/{row.lineCount}</td><td>{row.status}</td><td>{row.status === "draft" ? <button className={secondaryButtonClass} onClick={() => action(row.id, "submitted")}>Gửi duyệt</button> : row.status === "submitted" ? <button className={secondaryButtonClass} onClick={() => action(row.id, "confirmed")}>Duyệt điều chỉnh</button> : null}</td></tr>)}</tbody>
    </table></div></div>
  </div>;
}

export function StockCountCreatePage({ api = stockCountApi }: { api?: StockCountClient }) {
  const [balances, setBalances] = useState<Awaited<ReturnType<StockCountClient["listBalances"]>>>([]);
  const [created, setCreated] = useState(false);
  useEffect(() => { api.listBalances().then(setBalances); }, [api]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api.create({ countNo: String(data.get("countNo")), stockBalanceIds: [String(data.get("stockBalanceId"))] });
    setCreated(true);
  }

  return <form onSubmit={submit} className={`max-w-xl space-y-4 ${panelClass} p-5`}>
    <h1 className={pageTitleClass}>Tạo kiểm kê</h1>
    {created && <p role="status" className={successClass}>Đã freeze snapshot kiểm kê</p>}
    <label className={labelClass}>Số kiểm kê (*)<input name="countNo" required className={inputClass} /></label>
    <label className={labelClass}>Tồn cần đếm (*)<select name="stockBalanceId" required className={inputClass}><option value="">Chọn tồn</option>{balances.filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.sku} / {item.locationCode} / {item.onHand}</option>)}</select></label>
    <button className={primaryButtonClass}>Freeze snapshot</button>
  </form>;
}
