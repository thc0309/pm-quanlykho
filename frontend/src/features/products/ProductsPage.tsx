import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Pagination, paginate } from "../../components/common/Pagination";
import { PencilIcon, PlusIcon, TrashBinIcon } from "../../icons";
import { productApi, type Product, type ProductClient } from "../../lib/api";

const trackingLabels: Record<Product["trackingMode"], string> = {
  none: "Không tracking",
  lot: "Theo lô",
  serial: "Theo serial",
};

const panelClass =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const labelClass = "text-sm font-medium text-gray-700 dark:text-gray-400";
const inputClass =
  "mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800";
const primaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const tableHeadClass =
  "bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-white/[0.03] dark:text-gray-400";
const tableCellClass = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

function parseBarcodes(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function ProductsPage({ api = productApi }: { api?: ProductClient }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [barcode, setBarcode] = useState("");
  const [lookupResult, setLookupResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pagedProducts = paginate(products, page);

  useEffect(() => {
    api.listProducts()
      .then(setProducts)
      .catch(() => setError("Không thể tải sản phẩm. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setLookupResult("");
    setError("");
    try {
      const product = await api.findProductByBarcode(barcode);
      setLookupResult(`Tìm thấy: ${product.sku} - ${product.name}`);
    } catch {
      setError("Không tìm thấy barcode trong kho.");
    }
  }

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải sản phẩm…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Sản phẩm</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản lý SKU, barcode và chính sách tracking.
          </p>
        </div>
        <Link to="/products/create" className={primaryButtonClass}>
          <PlusIcon className="h-4 w-4" />
          Thêm sản phẩm
        </Link>
      </div>

      <form onSubmit={lookup} className={`flex flex-col gap-3 sm:flex-row sm:items-end ${panelClass}`}>
        <label className={`${labelClass} flex-1`}>
          Tra barcode
          <input value={barcode} onChange={(event) => setBarcode(event.target.value)} className={inputClass} />
        </label>
        <button type="submit" className={secondaryButtonClass}>Tra</button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}
      {lookupResult && (
        <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">
          {lookupResult}
        </p>
      )}

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách sản phẩm</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className="px-4 py-3">Tên sản phẩm</th>
                <th scope="col" className="px-4 py-3">SKU</th>
                <th scope="col" className="px-4 py-3">Barcode</th>
                <th scope="col" className="px-4 py-3">Tracking</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>
                    Chưa có sản phẩm.
                  </td>
                </tr>
              ) : pagedProducts.map((product) => (
                <tr key={product.id}>
                  <td className={`${tableCellClass} font-medium text-gray-800 dark:text-white/90`}>{product.name}</td>
                  <td className={tableCellClass}>{product.sku}</td>
                  <td className={tableCellClass}>{product.barcodes.join(", ")}</td>
                  <td className={tableCellClass}>{trackingLabels[product.trackingMode]}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex gap-2">
                      <button type="button" disabled aria-label={`Sửa sản phẩm ${product.name}`} title="Chưa hỗ trợ sửa sản phẩm" className={iconButtonClass}>
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button type="button" disabled aria-label={`Xóa sản phẩm ${product.name}`} title="Chưa hỗ trợ xóa sản phẩm" className={iconButtonClass}>
                        <TrashBinIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={products.length} onPageChange={setPage} />
      </section>
    </div>
  );
}

export function ProductCreatePage({ api = productApi }: { api?: ProductClient }) {
  const [form, setForm] = useState({
    sku: "",
    name: "",
    productType: "stock" as Product["productType"],
    trackingMode: "none" as Product["trackingMode"],
    expiryManaged: false,
    fefoEnabled: false,
    barcodes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function createProduct(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.createProduct({ ...form, barcodes: parseBarcodes(form.barcodes) });
      setNotice("Đã tạo sản phẩm");
      setForm({ sku: "", name: "", productType: "stock", trackingMode: "none", expiryManaged: false, fefoEnabled: false, barcodes: "" });
    } catch {
      setError("Không thể tạo sản phẩm. Kiểm tra SKU, barcode hoặc chính sách tracking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Thêm sản phẩm</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Nhập SKU, barcode và chính sách tracking.
          </p>
        </div>
        <Link to="/products" className={secondaryButtonClass}>Quay lại</Link>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">
          {notice}
        </p>
      )}

      <form onSubmit={createProduct} className={`grid gap-4 sm:grid-cols-2 ${panelClass}`}>
        <label className={labelClass}>
          SKU (*)
          <input required autoComplete="off" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Tên sản phẩm (*)
          <input required autoComplete="off" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Barcode (*)
          <input required autoComplete="off" value={form.barcodes} onChange={(event) => setForm({ ...form, barcodes: event.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          Loại sản phẩm
          <select value={form.productType} onChange={(event) => setForm({ ...form, productType: event.target.value as Product["productType"] })} className={inputClass}>
            <option value="stock">Hàng tồn kho</option>
            <option value="non_stock">Không tồn kho</option>
            <option value="service">Dịch vụ</option>
          </select>
        </label>
        <label className={labelClass}>
          Tracking
          <select value={form.trackingMode} onChange={(event) => setForm({ ...form, trackingMode: event.target.value as Product["trackingMode"] })} className={inputClass}>
            <option value="none">Không tracking</option>
            <option value="lot">Theo lô</option>
            <option value="serial">Theo serial</option>
          </select>
        </label>
        <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-400">
          <input type="checkbox" checked={form.expiryManaged} onChange={(event) => setForm({ ...form, expiryManaged: event.target.checked })} />
          Quản lý hạn dùng
        </label>
        <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-400">
          <input type="checkbox" checked={form.fefoEnabled} onChange={(event) => setForm({ ...form, fefoEnabled: event.target.checked })} />
          FEFO
        </label>
        <button type="submit" disabled={busy} className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}>
          Tạo sản phẩm
        </button>
      </form>
    </div>
  );
}
