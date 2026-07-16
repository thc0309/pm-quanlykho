import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import type { PurchasingClient } from "../../lib/api";
import PurchasingPage, { PurchaseCreatePage } from "./PurchasingPage";

afterEach(cleanup);

function client(overrides: Partial<PurchasingClient> = {}): PurchasingClient {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    approve: vi.fn(),
    listSuppliers: vi.fn().mockResolvedValue([{ id: "supplier-1", code: "SUP-1", name: "Nhà cung cấp" }]),
    listProducts: vi.fn().mockResolvedValue([
      { id: "product-1", sku: "SKU-1", name: "Sản phẩm 1" },
      { id: "product-2", sku: "SKU-2", name: "Sản phẩm 2" },
    ]),
    ...overrides,
  };
}

it("shows outstanding quantity and approves a PO", async () => {
  const api = client({ list: vi.fn().mockResolvedValue([{ id: "p", orderNo: "PO-1", status: "draft", supplierName: "S", lineCount: 1, outstandingQuantity: 6 }]) });
  const user = userEvent.setup();
  render(<MemoryRouter><PurchasingPage api={api} /></MemoryRouter>);
  expect(await screen.findByText("6")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Duyệt PO" }));
  expect(api.approve).toHaveBeenCalledWith("p");
});

it("creates a purchase order with two product lines", async () => {
  const api = client({ create: vi.fn().mockResolvedValue({ id: "po-1" }) });
  const user = userEvent.setup();
  render(<MemoryRouter><PurchaseCreatePage api={api} /></MemoryRouter>);

  await user.type(await screen.findByLabelText("Số PO (*)"), "PO-2");
  await user.selectOptions(screen.getByLabelText("Nhà cung cấp (*)"), "supplier-1");
  await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 1 (*)"), "product-1");
  await user.clear(screen.getByLabelText("Số lượng dòng 1 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 1 (*)"), "2");
  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 2 (*)"), "product-2");
  await user.clear(screen.getByLabelText("Số lượng dòng 2 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 2 (*)"), "3.5");
  await user.click(screen.getByRole("button", { name: "Tạo PO" }));

  expect(api.create).toHaveBeenCalledWith({
    orderNo: "PO-2",
    supplierId: "supplier-1",
    lines: [
      { productId: "product-1", quantity: 2 },
      { productId: "product-2", quantity: 3.5 },
    ],
  });
  expect(await screen.findByText("Đã tạo PO")).toBeVisible();
  expect(screen.getAllByLabelText(/Sản phẩm dòng \d+ \(\*\)/)).toHaveLength(1);
});

it("does not remove the final purchase line and keeps rows after an API error", async () => {
  const api = client({ create: vi.fn().mockRejectedValue(new Error("Không thể tạo PO")) });
  const user = userEvent.setup();
  render(<MemoryRouter><PurchaseCreatePage api={api} /></MemoryRouter>);

  expect(await screen.findByRole("button", { name: "Xóa dòng 1" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  expect(screen.getByRole("button", { name: "Xóa dòng 2" })).toBeEnabled();
  await user.type(screen.getByLabelText("Số PO (*)"), "PO-ERR");
  await user.selectOptions(screen.getByLabelText("Nhà cung cấp (*)"), "supplier-1");
  await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 1 (*)"), "product-1");
  await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 2 (*)"), "product-2");
  await user.click(screen.getByRole("button", { name: "Tạo PO" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tạo PO");
  expect(screen.getAllByLabelText(/Sản phẩm dòng \d+ \(\*\)/)).toHaveLength(2);
});
