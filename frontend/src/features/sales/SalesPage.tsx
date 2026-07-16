import { useEffect, useState, type FormEvent } from "react";
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
      <thead><tr><th>Số</th><th>Loại</th><th>Khách hàng</th><th>Tổng</th><th>Action</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><td>{row.documentNo}</td><td>{row.kind}</td><td>{row.customerName}</td><td>{row.total.toLocaleString("vi-VN")}</td><td><button className={secondaryButtonClass} disabled={row.status !== "draft"} onClick={() => approve(row.id)}>Duyệt</button></td></tr>)}</tbody>
    </table></div></div>
  </div>;
}

export function SalesCreatePage({ api = salesApi }: { api?: SalesClient }) {
  const [customers, setCustomers] = useState<Awaited<ReturnType<SalesClient["listCustomers"]>>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<SalesClient["listProducts"]>>>([]);
  const [created, setCreated] = useState(false);
  useEffect(() => { Promise.all([api.listCustomers(), api.listProducts()]).then(([nextCustomers, nextProducts]) => { setCustomers(nextCustomers); setProducts(nextProducts); }); }, [api]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api.create({ documentNo: String(data.get("documentNo")), kind: String(data.get("kind")) as "quote" | "order", customerId: String(data.get("customerId")), lines: [{ productId: String(data.get("productId")), quantity: Number(data.get("quantity")), unitPrice: Number(data.get("unitPrice")), taxRate: Number(data.get("taxRate")) }] });
    setCreated(true);
  }

  return <form onSubmit={submit} className={`grid max-w-2xl gap-4 sm:grid-cols-2 ${panelClass} p-5`}>
    <h1 className={`sm:col-span-2 ${pageTitleClass}`}>Tạo báo giá / đơn bán</h1>
    {created && <p role="status" className={`sm:col-span-2 ${successClass}`}>Đã tạo chứng từ</p>}
    <label className={labelClass}>Số chứng từ<input name="documentNo" required className={inputClass} /></label>
    <label className={labelClass}>Loại<select name="kind" className={inputClass}><option value="quote">Báo giá</option><option value="order">Đơn bán</option></select></label>
    <label className={labelClass}>Khách hàng<select name="customerId" required className={inputClass}><option value="">Chọn khách</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
    <label className={labelClass}>Sản phẩm<select name="productId" required className={inputClass}><option value="">Chọn sản phẩm</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}</select></label>
    <label className={labelClass}>Số lượng<input name="quantity" type="number" defaultValue="1" required className={inputClass} /></label>
    <label className={labelClass}>Đơn giá<input name="unitPrice" type="number" defaultValue="0" required className={inputClass} /></label>
    <label className={labelClass}>Thuế %<input name="taxRate" type="number" defaultValue="0" required className={inputClass} /></label>
    <button className={primaryButtonClass}>Tạo chứng từ</button>
  </form>;
}
