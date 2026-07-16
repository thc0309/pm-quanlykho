import { useEffect, useState, type FormEvent } from "react";

import {
  reportApi,
  type DashboardSummary,
  type ReportClient,
  type ReportRow,
} from "../../lib/api";
import {
  errorClass,
  inputClass,
  labelClass,
  pageTitleClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  tableClass,
} from "../themeStyles";

const cardClass = `${panelClass} p-5`;
const buttonClass = primaryButtonClass;

export function DashboardPage({ api = reportApi }: { api?: ReportClient }) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.dashboard().then(setData).catch(() => setError("Không thể tải dashboard."));
  }, [api]);

  if (error) return <p role="alert" className={errorClass}>{error}</p>;
  if (!data) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải dashboard…</p>;

  const cards = [
    ["On hand", data.onHand],
    ["Committed", data.committed],
    ["Available", data.available],
    ["Lô sắp hết hạn", data.expiringLots],
    ["Movement hôm nay", data.movementsToday],
  ];
  return (
    <div className="space-y-5">
      <h1 className={pageTitleClass}>Tổng quan kho</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <section key={label} className={cardClass}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage({ api = reportApi }: { api?: ReportClient }) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError("");
      }
    });
    api.inventory({ page, q: appliedQuery })
      .then((result) => {
        if (!active) return;
        setRows(result.data);
        setTotalPages(Math.max(1, result.pagination.totalPages));
      })
      .catch(() => {
        if (active) setError("Không thể tải báo cáo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [api, page, appliedQuery]);

  function filter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(query.trim());
  }

  return (
    <div className="space-y-5">
      <h1 className={pageTitleClass}>Báo cáo tồn kho</h1>
      <form onSubmit={filter} className={`${panelClass} flex flex-wrap items-end gap-3 p-5`}>
        <label className={`${labelClass} flex-1`}>
          Tìm báo cáo
          <input
            aria-label="Tìm báo cáo"
            value={query}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass}
          />
        </label>
        <button className={buttonClass}>Lọc</button>
        <a className={buttonClass} href={api.exportUrl(appliedQuery)}>Export CSV</a>
      </form>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      {loading ? <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải báo cáo…</p> : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className="p-3 text-left">SKU</th>
                <th>Product</th>
                <th>Location</th>
                <th>Lot/Serial</th>
                <th>On hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row, index) => (
                <tr key={`${row.sku}-${row.locationCode}-${index}`}>
                  <td className="p-3">{row.sku}</td>
                  <td>{row.productName}</td>
                  <td>{row.locationCode}</td>
                  <td>{row.lotCode || row.serialCode || "—"}</td>
                  <td>{row.onHand}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="p-4 text-center">Không có dữ liệu báo cáo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <button className={secondaryButtonClass} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
        <span>Trang {page}/{totalPages}</span>
        <button className={secondaryButtonClass} disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
      </div>
    </div>
  );
}
