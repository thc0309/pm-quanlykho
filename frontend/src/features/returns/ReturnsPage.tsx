import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { returnApi, type ReturnClient } from "../../lib/api";
import { inputClass, labelClass, pageTitleClass, panelClass, primaryButtonClass, secondaryButtonClass, successClass, tableClass } from "../themeStyles";

export default function ReturnsPage({ api = returnApi }: { api?: ReturnClient }) {
  const [rows, setRows] = useState<Awaited<ReturnType<ReturnClient["list"]>>>([]);
  useEffect(() => { api.list().then(setRows); }, [api]);

  async function confirm(id: string) {
    await api.confirm(id);
    setRows((items) => items.map((item) => item.id === id ? { ...item, status: "confirmed" } : item));
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className={pageTitleClass}>Phiếu trả hàng</h1><Link to="/returns/create" className={primaryButtonClass}>Tạo phiếu trả</Link></div>
    <div className={panelClass}><div className="overflow-x-auto"><table className={tableClass}>
      <thead><tr><th>Số phiếu</th><th>Loại</th><th>Chứng từ gốc</th><th>Action</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{row.returnNo}</td><td>{row.kind}</td><td>{row.originalDocumentNo}</td><td><button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => confirm(row.id)}>Xác nhận trả</button></td></tr>)}</tbody>
    </table></div></div>
  </div>;
}

export function ReturnCreatePage({ api = returnApi }: { api?: ReturnClient }) {
  const [created, setCreated] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api.create({ returnNo: String(data.get("returnNo")), kind: String(data.get("kind")) as "customer" | "supplier", originalDocumentId: String(data.get("originalDocumentId")), lines: [{ originalMovementId: String(data.get("originalMovementId")), quantity: Number(data.get("quantity")) }] });
    setCreated(true);
  }

  return <form onSubmit={submit} className={`grid max-w-2xl gap-4 sm:grid-cols-2 ${panelClass} p-5`}>
    <h1 className={`sm:col-span-2 ${pageTitleClass}`}>Tạo phiếu trả</h1>
    {created && <p role="status" className={`sm:col-span-2 ${successClass}`}>Đã tạo phiếu trả</p>}
    <label className={labelClass}>Số phiếu (*)<input name="returnNo" required className={inputClass} /></label>
    <label className={labelClass}>Loại (*)<select name="kind" required className={inputClass}><option value="customer">Khách trả</option><option value="supplier">Trả nhà cung cấp</option></select></label>
    <label className={labelClass}>ID chứng từ gốc (*)<input name="originalDocumentId" required className={inputClass} /></label>
    <label className={labelClass}>ID biến động kho gốc (*)<input name="originalMovementId" required className={inputClass} /></label>
    <label className={labelClass}>Số lượng (*)<input name="quantity" type="number" min="0.0001" required className={inputClass} /></label>
    <button className={primaryButtonClass}>Tạo phiếu trả</button>
  </form>;
}
