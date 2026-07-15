import { useEffect, useState, type FormEvent } from "react";

import {
  inventoryApi,
  type InventoryBalance,
  type InventoryClient,
  type InventoryLot,
  type InventoryMovement,
  type InventorySerial,
  type PaginationInfo,
} from "../../lib/api";

type View = "balances" | "lots" | "serials" | "movements";
type Row = InventoryBalance | InventoryLot | InventorySerial | InventoryMovement;

const views: Array<{ id: View; label: string }> = [
  { id: "balances", label: "Tồn hiện tại" },
  { id: "lots", label: "Lô" },
  { id: "serials", label: "Serial" },
  { id: "movements", label: "Lịch sử" },
];
const emptyPagination: PaginationInfo = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
const panelClass = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const inputClass = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
const buttonClass = "inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300";
const cellClass = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

function columns(view: View) {
  if (view === "balances") return ["SKU", "Vị trí", "Lô/Serial", "On hand", "Committed", "Available"];
  if (view === "lots") return ["SKU", "Mã lô", "Hạn dùng", "On hand"];
  if (view === "serials") return ["SKU", "Serial", "Trạng thái", "Vị trí"];
  return ["Chứng từ", "SKU", "Vị trí", "Lô/Serial", "Số lượng"];
}

function Cells({ view, row }: { view: View; row: Row }) {
  if (view === "balances") {
    const item = row as InventoryBalance;
    return <><td className={cellClass}>{item.sku}</td><td className={cellClass}>{item.locationCode}</td><td className={cellClass}>{item.lotCode ?? item.serialCode ?? "—"}</td><td className={cellClass}>{item.onHand}</td><td className={cellClass}>{item.committed}</td><td className={cellClass}>{item.available}</td></>;
  }
  if (view === "lots") {
    const item = row as InventoryLot;
    return <><td className={cellClass}>{item.sku}</td><td className={cellClass}>{item.lotCode}</td><td className={cellClass}>{item.expiresAt ?? "—"}</td><td className={cellClass}>{item.onHand}</td></>;
  }
  if (view === "serials") {
    const item = row as InventorySerial;
    return <><td className={cellClass}>{item.sku}</td><td className={cellClass}>{item.serialCode}</td><td className={cellClass}>{item.status}</td><td className={cellClass}>{item.locationCode ?? "—"}</td></>;
  }
  const item = row as InventoryMovement;
  return <><td className={cellClass}>{item.documentNo}</td><td className={cellClass}>{item.sku}</td><td className={cellClass}>{item.locationCode ?? "—"}</td><td className={cellClass}>{item.lotCode ?? item.serialCode ?? "—"}</td><td className={cellClass}>{item.quantityDelta}</td></>;
}

export default function InventoryPage({ api = inventoryApi }: { api?: InventoryClient }) {
  const [view, setView] = useState<View>("balances");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = { page, q: query };
    const request = view === "balances" ? api.listBalances(params)
      : view === "lots" ? api.listLots(params)
        : view === "serials" ? api.listSerials(params)
          : api.listMovements(params);
    request.then((result) => {
      if (!active) return;
      setRows(result.data);
      setPagination(result.pagination);
    }).catch(() => {
      if (active) setError("Không thể tải dữ liệu tồn kho.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [api, page, query, view]);

  function filter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  }

  function selectView(next: View) {
    setView(next);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Tồn kho và truy xuất</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tồn khả dụng, lô/serial và lịch sử chuyển động.</p></div>
      <div className="flex flex-wrap gap-2" aria-label="Loại dữ liệu">
        {views.map((item) => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => selectView(item.id)} className={`${buttonClass} ${view === item.id ? "border-brand-600 bg-brand-50 text-brand-700" : ""}`}>{item.label}</button>)}
      </div>
      <form onSubmit={filter} className={`flex flex-col gap-3 sm:flex-row ${panelClass}`}>
        <label className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-400">Tìm tồn kho<input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={80} className={`mt-1 ${inputClass}`} /></label>
        <button type="submit" className={`${buttonClass} sm:mt-6`}>Lọc</button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">{views.find((item) => item.id === view)?.label}</h2>
        {loading ? <p role="status" className="mt-3 text-sm text-gray-500">Đang tải tồn kho…</p> : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"><tr>{columns(view).map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.length === 0 ? <tr><td colSpan={columns(view).length} className={`${cellClass} text-center text-gray-500`}>Không có dữ liệu tồn kho.</td></tr>
                    : rows.map((row) => <tr key={"id" in row ? row.id : `${row.locationId}:${row.productId}:${row.lotCode}:${row.serialCode}`}><Cells view={view} row={row} /></tr>)}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-gray-500">
              <span>Trang {pagination.page} / {Math.max(1, pagination.totalPages)}</span>
              <div className="flex gap-2"><button type="button" className={buttonClass} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button><button type="button" className={buttonClass} disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</button></div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
