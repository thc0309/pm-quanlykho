import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InventoryClient } from "../../lib/api";
import InventoryPage from "./InventoryPage";

afterEach(cleanup);

const emptyPage = { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } };

function api(overrides: Partial<InventoryClient> = {}): InventoryClient {
  return {
    listBalances: vi.fn().mockResolvedValue(emptyPage),
    listLots: vi.fn().mockResolvedValue(emptyPage),
    listSerials: vi.fn().mockResolvedValue(emptyPage),
    listMovements: vi.fn().mockResolvedValue(emptyPage),
    ...overrides,
  };
}

describe("InventoryPage", () => {
  it("filters and paginates balances on the server", async () => {
    const client = api({
      listBalances: vi.fn()
        .mockResolvedValueOnce({
          data: [{ warehouseId: "warehouse-a", locationId: "loc-a", locationCode: "A-01", productId: "prod-a", sku: "SKU-A", productName: "Hàng A", lotCode: "LOT-A", serialCode: null, onHand: 10, committed: 3, available: 7 }],
          pagination: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 },
        })
        .mockResolvedValueOnce({ data: [], pagination: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 } })
        .mockResolvedValue({ data: [], pagination: { page: 2, pageSize: 20, totalItems: 21, totalPages: 2 } }),
    });
    const user = userEvent.setup();
    render(<InventoryPage api={client} />);

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải tồn kho");
    expect(await screen.findByText("SKU-A")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    await user.type(screen.getByLabelText("Tìm tồn kho"), "SKU");
    await user.click(screen.getByRole("button", { name: "Lọc" }));
    expect(client.listBalances).toHaveBeenCalledWith({ page: 1, q: "SKU" });
    await user.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(client.listBalances).toHaveBeenCalledWith({ page: 2, q: "SKU" });
  });

  it("loads traceability views and renders empty and error states", async () => {
    const client = api({ listMovements: vi.fn().mockRejectedValue(new Error("offline")) });
    const user = userEvent.setup();
    render(<InventoryPage api={client} />);
    expect(await screen.findByText("Không có dữ liệu tồn kho.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Lịch sử" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải dữ liệu tồn kho");
    expect(client.listMovements).toHaveBeenCalledWith({ page: 1, q: "" });
  });
});
