import { useEffect, useState } from "react";

import {
  outboundExceptionApi,
  type OutboundExceptionClient,
  type OutboundExceptionItem,
} from "../../lib/api";
import {
  errorClass,
  inputClass,
  labelClass,
  pageTitleClass,
  panelClass,
  secondaryButtonClass,
  tableClass,
} from "../themeStyles";

export default function OutboundExceptions({
  api = outboundExceptionApi,
}: {
  api?: OutboundExceptionClient;
}) {
  const [items, setItems] = useState<OutboundExceptionItem[]>([]);
  const [reason, setReason] = useState("Xử lý ngoại lệ theo xác nhận");
  const [error, setError] = useState("");

  useEffect(() => {
    api.list().then(setItems).catch(() => setError("Không thể tải ngoại lệ."));
  }, [api]);

  async function act(item: OutboundExceptionItem, type: "cancel" | "mismatch" | "short") {
    try {
      if (type === "cancel") await api.cancel(item.id, reason);
      if (type === "mismatch") await api.mismatch(item.id);
      if (type === "short") await api.approveShort(item.id, reason);
      setItems((rows) => type === "cancel"
        ? rows.filter((row) => row.id !== item.id)
        : rows.map((row) => row.id === item.id
          ? { ...row, status: type === "mismatch" ? "needs_repick" : row.status }
          : row));
    } catch {
      setError("Không thể xử lý ngoại lệ ở trạng thái hiện tại.");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className={pageTitleClass}>Ngoại lệ phiếu xuất</h1>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <label className={`${labelClass} max-w-xl`}>
        Lý do
        <input
          aria-label="Lý do"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={inputClass}
        />
      </label>
      <div className={`${panelClass} overflow-x-auto`}>
        <table className={tableClass}>
          <thead><tr><th>Số phiếu</th><th>Trạng thái</th><th className="text-right!">Action</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.documentNo}</td>
                <td>{item.status}</td>
                <td className="flex justify-end gap-2">
                  <button className={secondaryButtonClass} disabled={item.status !== "checking"} onClick={() => act(item, "mismatch")}>Cần soạn lại</button>
                  <button className={secondaryButtonClass} disabled={item.status !== "checking"} onClick={() => act(item, "short")}>Duyệt xuất thiếu</button>
                  <button className={secondaryButtonClass} disabled={item.status === "picked" || item.status === "checking"} onClick={() => act(item, "cancel")}>Hủy phiếu</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
