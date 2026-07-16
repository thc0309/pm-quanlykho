import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import type { SalesClient } from "../../lib/api";
import SalesPage, { SalesCreatePage } from "./SalesPage";

afterEach(cleanup);

function client(overrides: Partial<SalesClient> = {}): SalesClient {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    approve: vi.fn(),
    invoice: vi.fn(),
    listCustomers: vi.fn().mockResolvedValue([{ id: "customer-1", code: "CUS-1", name: "Khách hàng" }]),
    listProducts: vi.fn().mockResolvedValue([
      { id: "product-1", sku: "SKU-1", name: "Sản phẩm 1" },
      { id: "product-2", sku: "SKU-2", name: "Sản phẩm 2" },
      { id: "product-3", sku: "SKU-3", name: "Sản phẩm 3" },
    ]),
    ...overrides,
  };
}

it("renders totals and approves an order", async () => {
  const api = client({ list: vi.fn().mockResolvedValue([{ id: "s", documentNo: "SO-1", kind: "order", status: "draft", customerName: "C", total: 220 }]), approve: vi.fn().mockResolvedValue({ outboundId: "o" }) });
  const user = userEvent.setup();
  render(<MemoryRouter><SalesPage api={api} /></MemoryRouter>);
  expect(await screen.findByText("220")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Duyệt" }));
  expect(api.approve).toHaveBeenCalledWith("s");
});

it("creates a two-line sales document and shows rounded totals", async () => {
  const api = client({ create: vi.fn().mockResolvedValue({ id: "sale-1" }) });
  const user = userEvent.setup();
  render(<MemoryRouter><SalesCreatePage api={api} /></MemoryRouter>);

  await user.type(await screen.findByLabelText("Số chứng từ (*)"), "SO-2");
  await user.selectOptions(screen.getByLabelText("Loại (*)"), "order");
  await user.selectOptions(screen.getByLabelText("Khách hàng (*)"), "customer-1");
  await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 1 (*)"), "product-1");
  await user.clear(screen.getByLabelText("Số lượng dòng 1 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 1 (*)"), "2");
  await user.clear(screen.getByLabelText("Đơn giá dòng 1 (*)"));
  await user.type(screen.getByLabelText("Đơn giá dòng 1 (*)"), "100");
  await user.clear(screen.getByLabelText("Thuế dòng 1 (%) (*)"));
  await user.type(screen.getByLabelText("Thuế dòng 1 (%) (*)"), "10");
  expect(screen.getByText("Tổng dòng 1: 220,00 đ")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 2 (*)"), "product-2");
  await user.clear(screen.getByLabelText("Số lượng dòng 2 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 2 (*)"), "3");
  await user.clear(screen.getByLabelText("Đơn giá dòng 2 (*)"));
  await user.type(screen.getByLabelText("Đơn giá dòng 2 (*)"), "0.1");
  await user.clear(screen.getByLabelText("Thuế dòng 2 (%) (*)"));
  await user.type(screen.getByLabelText("Thuế dòng 2 (%) (*)"), "5");
  expect(screen.getByText("Tổng dòng 2: 0,32 đ")).toBeVisible();
  expect(screen.getByText("Tổng chứng từ: 220,32 đ")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Tạo chứng từ" }));
  expect(api.create).toHaveBeenCalledWith({
    documentNo: "SO-2",
    kind: "order",
    customerId: "customer-1",
    lines: [
      { productId: "product-1", quantity: 2, unitPrice: 100, taxRate: 10 },
      { productId: "product-2", quantity: 3, unitPrice: 0.1, taxRate: 5 },
    ],
  });
});

it("removes the middle sales line without losing the following row", async () => {
  const api = client();
  const user = userEvent.setup();
  render(<MemoryRouter><SalesCreatePage api={api} /></MemoryRouter>);
  await screen.findByLabelText("Sản phẩm dòng 1 (*)");
  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 3 (*)"), "product-3");
  await user.click(screen.getByRole("button", { name: "Xóa dòng 2" }));
  expect(screen.getAllByLabelText(/Sản phẩm dòng \d+ \(\*\)/)).toHaveLength(2);
  expect(screen.getByLabelText("Sản phẩm dòng 2 (*)")).toHaveValue("product-3");
  expect(screen.getByRole("button", { name: "Xóa dòng 1" })).toBeEnabled();
});
