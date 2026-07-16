import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import type { InventoryBalance, TransferClient } from "../../lib/api";
import TransfersPage, { TransferCreatePage } from "./TransfersPage";

afterEach(cleanup);

function balance(id: string, warehouseId: string, available: number): InventoryBalance {
  return { id, warehouseId, locationId: `location-${id}`, locationCode: `KỆ-${id}`, productId: `product-${id}`, sku: `SKU-${id}`, productName: `Sản phẩm ${id}`, lotCode: null, serialCode: null, onHand: available, committed: 0, available };
}

function client(overrides: Partial<TransferClient> = {}): TransferClient {
  return { list: vi.fn().mockResolvedValue([]), create: vi.fn(), dispatch: vi.fn(), receive: vi.fn(), cancel: vi.fn(), listBalances: vi.fn().mockResolvedValue([]), ...overrides };
}

it("dispatches a draft once", async () => {
  const api = client({ list: vi.fn().mockResolvedValue([{ id: "t", transferNo: "TR-1", status: "draft", sourceWarehouse: "A", targetWarehouse: "B", lineCount: 1, quantity: 2 }]) });
  const user = userEvent.setup();
  render(<MemoryRouter><TransfersPage api={api} /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: "Điều chuyển" }));
  expect(api.dispatch).toHaveBeenCalledWith("t");
  expect(screen.getByText("Đang chuyển")).toBeVisible();
});

it("creates a transfer with two balances from the same source warehouse", async () => {
  const api = client({
    listBalances: vi.fn().mockResolvedValue([balance("b1", "warehouse-a", 5), balance("b2", "warehouse-a", 3), balance("b3", "warehouse-b", 9)]),
    create: vi.fn().mockResolvedValue({ id: "transfer-1" }),
  });
  const user = userEvent.setup();
  render(<MemoryRouter><TransferCreatePage api={api} /></MemoryRouter>);
  await screen.findByRole("option", { name: /SKU-b1/ });
  expect(screen.getByRole("button", { name: "Xóa dòng 1" })).toBeDisabled();
  await user.type(screen.getByLabelText("Số phiếu chuyển (*)"), "TR-2");
  await user.type(screen.getByLabelText("ID kho đích (*)"), "warehouse-target");
  await user.selectOptions(screen.getByLabelText("Tồn nguồn dòng 1 (*)"), "b1");
  await user.clear(screen.getByLabelText("Số lượng dòng 1 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 1 (*)"), "2");
  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  expect(screen.queryByRole("option", { name: /SKU-b3/ })).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Tồn nguồn dòng 2 (*)"), "b2");
  await user.clear(screen.getByLabelText("Số lượng dòng 2 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 2 (*)"), "3");
  await user.click(screen.getByRole("button", { name: "Tạo phiếu chuyển" }));

  expect(api.create).toHaveBeenCalledWith({
    transferNo: "TR-2",
    targetWarehouseId: "warehouse-target",
    lines: [{ stockBalanceId: "b1", quantity: 2 }, { stockBalanceId: "b2", quantity: 3 }],
  });
  expect(await screen.findByText("Đã tạo phiếu chuyển")).toBeVisible();
  expect(screen.getAllByLabelText(/Tồn nguồn dòng \d+ \(\*\)/)).toHaveLength(1);
});

it("blocks duplicate balances, over-available quantity, and the source warehouse as target", async () => {
  const api = client({ listBalances: vi.fn().mockResolvedValue([balance("b1", "warehouse-a", 5), balance("b2", "warehouse-a", 3)]) });
  const user = userEvent.setup();
  render(<MemoryRouter><TransferCreatePage api={api} /></MemoryRouter>);
  await screen.findByRole("option", { name: /SKU-b1/ });
  await user.type(screen.getByLabelText("Số phiếu chuyển (*)"), "TR-ERR");
  await user.type(screen.getByLabelText("ID kho đích (*)"), "warehouse-a");
  await user.selectOptions(screen.getByLabelText("Tồn nguồn dòng 1 (*)"), "b1");
  await user.clear(screen.getByLabelText("Số lượng dòng 1 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 1 (*)"), "6");
  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  await user.selectOptions(screen.getByLabelText("Tồn nguồn dòng 2 (*)"), "b1");
  await user.click(screen.getByRole("button", { name: "Tạo phiếu chuyển" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Kho đích phải khác kho nguồn");
  expect(screen.getByRole("alert")).toHaveTextContent("Dòng 1: số lượng vượt tồn khả dụng (5)");
  expect(screen.getByRole("alert")).toHaveTextContent("Dòng 2: tồn nguồn đã được chọn ở dòng khác");
  expect(api.create).not.toHaveBeenCalled();
});
