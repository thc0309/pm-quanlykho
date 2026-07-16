import { useEffect, useState, type FormEvent } from "react";

import { checkingApi, type CheckingClient, type CheckingItem } from "../../lib/api";
import {
  errorClass,
  inputClass,
  labelClass,
  pageTitleClass,
  panelClass,
  primaryButtonClass,
  tableClass,
} from "../themeStyles";

export default function CheckingPage({ api = checkingApi }: { api?: CheckingClient }) {
  const [items, setItems] = useState<CheckingItem[]>([]);
  const [active, setActive] = useState<CheckingItem | null>(null);
  const [progress, setProgress] = useState({ checked: 0, required: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.list()
      .then(setItems)
      .catch(() => setError("Không thể tải phiếu kiểm."))
      .finally(() => setLoading(false));
  }, [api]);

  async function claim(item: CheckingItem) {
    try {
      const result = await api.claim(item.id);
      setActive({ ...item, status: "checking", version: result.version });
    } catch {
      setError("Người soạn không được tự kiểm hoặc phiếu đã có checker.");
    }
  }

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setProgress(await api.scan(active.id, {
        locationBarcode: String(data.get("locationBarcode")),
        itemBarcode: String(data.get("itemBarcode")),
      }));
      form.reset();
    } catch {
      setError("Mã staging hoặc hàng không khớp.");
    }
  }

  async function ship() {
    if (!active) return;
    try {
      await api.ship(active.id, { idempotencyKey: crypto.randomUUID(), version: active.version });
      setItems((rows) => rows.filter((row) => row.id !== active.id));
      setActive(null);
    } catch {
      setError("Chưa kiểm đủ hoặc phiên bản phiếu đã thay đổi.");
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải phiếu kiểm…</p>;

  if (active) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <h1 className={pageTitleClass}>Kiểm {active.documentNo}</h1>
        {error && <p role="alert" className={errorClass}>{error}</p>}
        <p aria-label="Tiến độ kiểm" className="text-lg font-semibold">{progress.checked} / {progress.required || "?"}</p>
        <form onSubmit={scan} className={`${panelClass} space-y-4 p-5`}>
          <label className={labelClass}>Barcode staging<input name="locationBarcode" required className={inputClass} /></label>
          <label className={labelClass}>Barcode sản phẩm / lô / serial<input name="itemBarcode" required className={inputClass} /></label>
          <button className={primaryButtonClass}>Lưu lần kiểm</button>
        </form>
        <button onClick={ship} className={primaryButtonClass}>Xác nhận và xuất kho</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className={pageTitleClass}>Phiếu chờ kiểm</h1>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <section className={`${panelClass} overflow-x-auto p-5`}>
        <table className={tableClass}>
          <thead><tr><th>Số phiếu</th><th className="text-right!">Action</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.documentNo}</td>
                <td className="text-right"><button className={primaryButtonClass} onClick={() => claim(item)}>{item.status === "checking" ? "Tiếp tục" : "Nhận kiểm"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
