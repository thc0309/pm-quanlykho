import { useEffect, useState, type FormEvent } from "react";
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
            <thead><tr><th>Số PO</th><th>Supplier</th><th>Outstanding</th><th>Action</th></tr></thead>
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

export function PurchaseCreatePage({ api = purchasingApi }: { api?: PurchasingClient }) {
  const [suppliers, setSuppliers] = useState<Awaited<ReturnType<PurchasingClient["listSuppliers"]>>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<PurchasingClient["listProducts"]>>>([]);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    Promise.all([api.listSuppliers(), api.listProducts()]).then(([nextSuppliers, nextProducts]) => {
      setSuppliers(nextSuppliers);
      setProducts(nextProducts);
    });
  }, [api]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api.create({
      orderNo: String(data.get("orderNo")),
      supplierId: String(data.get("supplierId")),
      lines: [{ productId: String(data.get("productId")), quantity: Number(data.get("quantity")) }],
    });
    setCreated(true);
  }

  return (
    <form onSubmit={submit} className={`grid max-w-2xl gap-4 sm:grid-cols-2 ${panelClass} p-5`}>
      <h1 className={`sm:col-span-2 ${pageTitleClass}`}>Tạo PO</h1>
      {created && <p role="status" className={`sm:col-span-2 ${successClass}`}>Đã tạo PO</p>}
      <label className={labelClass}>Số PO<input name="orderNo" required className={inputClass} /></label>
      <label className={labelClass}>Supplier<select name="supplierId" required className={inputClass}><option value="">Chọn supplier</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
      <label className={labelClass}>Sản phẩm<select name="productId" required className={inputClass}><option value="">Chọn sản phẩm</option>{products.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}</select></label>
      <label className={labelClass}>Số lượng<input name="quantity" type="number" min="0.0001" defaultValue="1" required className={inputClass} /></label>
      <button className={primaryButtonClass}>Tạo PO</button>
    </form>
  );
}
