import { useEffect, useState, type FormEvent } from "react";

import { pickingApi, type PickingClient, type PickingItem } from "../../lib/api";
import {
  errorClass,
  inputClass,
  labelClass,
  pageTitleClass,
  panelClass,
  primaryButtonClass,
  tableClass,
} from "../themeStyles";

export default function PickingPage({ api = pickingApi }: { api?: PickingClient }) {
  const [items, setItems] = useState<PickingItem[]>([]);
  const [active, setActive] = useState<PickingItem | null>(null);
  const [progress, setProgress] = useState({ picked: 0, required: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.list()
      .then(setItems)
      .catch(() => setError("Không thể tải danh sách soạn."))
      .finally(() => setLoading(false));
  }, [api]);

  async function claim(item: PickingItem) {
    setError("");
    try {
      await api.claim(item.id);
      setActive({ ...item, status: "picking" });
    } catch {
      setError("Phiếu đang được người khác soạn.");
    }
  }

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setProgress(await api.scan(active.id, {
        locationBarcode: String(data.get("locationBarcode")).trim(),
        itemBarcode: String(data.get("itemBarcode")).trim(),
      }));
      form.reset();
    } catch {
      setError("Mã vị trí hoặc hàng không khớp FEFO.");
    }
  }

  async function confirm() {
    if (!active) return;
    try {
      await api.confirm(active.id);
      setItems((rows) => rows.filter((row) => row.id !== active.id));
      setActive(null);
    } catch {
      setError("Chưa soạn đủ số lượng.");
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải phiếu soạn…</p>;

  if (active) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <h1 className={pageTitleClass}>Soạn {active.documentNo}</h1>
        {error && <p role="alert" className={errorClass}>{error}</p>}
        <p aria-label="Tiến độ" className="text-lg font-semibold">{progress.picked} / {progress.required || "?"}</p>
        <form onSubmit={scan} className={`${panelClass} space-y-4 p-5`}>
          <label className={labelClass}>Barcode vị trí<input name="locationBarcode" autoFocus required className={inputClass} /></label>
          <label className={labelClass}>Barcode sản phẩm / lô / serial<input name="itemBarcode" required className={inputClass} /></label>
          <button className={primaryButtonClass}>Lưu lần quét</button>
        </form>
        <button type="button" onClick={confirm} className={primaryButtonClass}>Xác nhận đã soạn</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className={pageTitleClass}>Phiếu chờ soạn</h1>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <section className={`${panelClass} p-5`}>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead><tr><th>Số phiếu</th><th>Trạng thái</th><th className="text-right!">Action</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.documentNo}</td>
                  <td>{item.status === "picking" ? "Đang soạn" : "Chờ soạn"}</td>
                  <td className="text-right"><button className={primaryButtonClass} onClick={() => claim(item)}>{item.status === "picking" ? "Tiếp tục" : "Nhận phiếu"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
