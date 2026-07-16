import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import type { InventoryBalance, StockCountClient } from "../../lib/api";
import StockCountsPage, { StockCountCreatePage } from "./StockCountsPage";

afterEach(cleanup);

function balance(id: string): InventoryBalance {
  return { id, warehouseId: "warehouse-a", locationId: `location-${id}`, locationCode: `KỆ-${id}`, productId: `product-${id}`, sku: `SKU-${id}`, productName: `Sản phẩm ${id}`, lotCode: null, serialCode: null, onHand: 5, committed: 0, available: 5 };
}

function client(overrides: Partial<StockCountClient> = {}): StockCountClient {
  return { list: vi.fn().mockResolvedValue([]), create: vi.fn(), submit: vi.fn(), approve: vi.fn(), listBalances: vi.fn().mockResolvedValue([]), ...overrides };
}

it("submits a completed count for approval", async () => {
  const api = client({ list: vi.fn().mockResolvedValue([{ id: "c", countNo: "CNT-1", status: "draft", lineCount: 1, countedLines: 1 }]) });
  const user = userEvent.setup();
  render(<MemoryRouter><StockCountsPage api={api} /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: "Gửi duyệt" }));
  expect(api.submit).toHaveBeenCalledWith("c");
});

it("creates a stock count from multiple selected balances", async () => {
  const api = client({ listBalances: vi.fn().mockResolvedValue([balance("b1"), balance("b2")]), create: vi.fn().mockResolvedValue({ id: "count-1" }) });
  const user = userEvent.setup();
  render(<MemoryRouter><StockCountCreatePage api={api} /></MemoryRouter>);
  await user.type(screen.getByLabelText("Số kiểm kê (*)"), "CNT-2");
  await user.click(await screen.findByRole("checkbox", { name: /SKU-b1/ }));
  await user.click(screen.getByRole("checkbox", { name: /SKU-b2/ }));
  await user.click(screen.getByRole("button", { name: "Chốt số liệu" }));
  expect(api.create).toHaveBeenCalledWith({ countNo: "CNT-2", stockBalanceIds: ["b1", "b2"] });
  expect(await screen.findByText("Đã chốt số liệu kiểm kê")).toBeVisible();
  expect(screen.getByLabelText("Số kiểm kê (*)")).toHaveValue("");
  expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
});

it("does not submit an empty balance selection", async () => {
  const api = client({ listBalances: vi.fn().mockResolvedValue([balance("b1")]) });
  const user = userEvent.setup();
  render(<MemoryRouter><StockCountCreatePage api={api} /></MemoryRouter>);
  await user.type(screen.getByLabelText("Số kiểm kê (*)"), "CNT-ERR");
  await screen.findByRole("checkbox", { name: /SKU-b1/ });
  await user.click(screen.getByRole("button", { name: "Chốt số liệu" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Chọn ít nhất một tồn kho cần đếm");
  expect(api.create).not.toHaveBeenCalled();
});
