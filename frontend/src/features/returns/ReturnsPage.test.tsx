import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import { ApiError, type ReturnClient } from "../../lib/api";
import ReturnsPage, { ReturnCreatePage } from "./ReturnsPage";

afterEach(cleanup);

function client(overrides: Partial<ReturnClient> = {}): ReturnClient {
  return {
    list: vi.fn().mockResolvedValue([]),
    listSourceDocuments: vi.fn().mockResolvedValue([{ id: "document-1", documentNo: "RC-1", partnerName: "NCC A", confirmedAt: null }]),
    listSourceLines: vi.fn().mockResolvedValue([
      { originalMovementId: "movement-1", productId: "product-1", sku: "SKU-1", productName: "Sản phẩm 1", locationCode: "A-01", lotCode: null, serialCode: null, quantity: 5, claimedQuantity: 0, remainingQuantity: 5 },
      { originalMovementId: "movement-2", productId: "product-2", sku: "SKU-2", productName: "Sản phẩm 2", locationCode: "A-02", lotCode: null, serialCode: null, quantity: 3, claimedQuantity: 1.5, remainingQuantity: 1.5 },
    ]),
    create: vi.fn(),
    confirm: vi.fn(),
    ...overrides,
  };
}

it("confirms a draft return once", async () => {
  const api = client({ list: vi.fn().mockResolvedValue([{ id: "r", returnNo: "RET-1", kind: "customer", status: "draft", originalDocumentNo: "OUT-1", lineCount: 1 }]), confirm: vi.fn().mockResolvedValue({ alreadyConfirmed: false }) });
  const user = userEvent.setup();
  render(<MemoryRouter><ReturnsPage api={api} /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: "Xác nhận trả" }));
  expect(api.confirm).toHaveBeenCalledWith("r");
});

it("creates a supplier return with two movement lines", async () => {
  const api = client({ create: vi.fn().mockResolvedValue({ id: "return-1" }) });
  const user = userEvent.setup();
  render(<MemoryRouter><ReturnCreatePage api={api} /></MemoryRouter>);
  await user.type(screen.getByLabelText("Số phiếu (*)"), "RET-2");
  await user.selectOptions(screen.getByLabelText("Loại (*)"), "supplier");
  expect(screen.getByRole("option", { name: "Trả nhà cung cấp" })).toBeInTheDocument();
  expect(screen.queryByText("Trả supplier")).not.toBeInTheDocument();
  await user.selectOptions(await screen.findByLabelText("Chứng từ gốc (*)"), "document-1");
  await user.selectOptions(await screen.findByLabelText("Sản phẩm dòng 1 (*)"), "movement-1");
  await user.clear(screen.getByLabelText("Số lượng dòng 1 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 1 (*)"), "2");
  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  await user.selectOptions(await screen.findByLabelText("Sản phẩm dòng 2 (*)"), "movement-2");
  await user.clear(screen.getByLabelText("Số lượng dòng 2 (*)"));
  await user.type(screen.getByLabelText("Số lượng dòng 2 (*)"), "1.5");
  await user.click(screen.getByRole("button", { name: "Tạo phiếu trả" }));

  expect(api.create).toHaveBeenCalledWith({
    returnNo: "RET-2",
    kind: "supplier",
    originalDocumentId: "document-1",
    lines: [
      { originalMovementId: "movement-1", quantity: 2 },
      { originalMovementId: "movement-2", quantity: 1.5 },
    ],
  });
  expect(await screen.findByText("Đã tạo phiếu trả")).toBeVisible();
  expect(screen.getAllByLabelText(/Sản phẩm dòng \d+ \(\*\)/)).toHaveLength(1);
});

it("keeps return rows on over-quantity errors and guards the final row", async () => {
  const api = client({ create: vi.fn().mockRejectedValue(new ApiError(409, "OVER_RETURN", "Số lượng trả vượt chứng từ gốc")) });
  const user = userEvent.setup();
  render(<MemoryRouter><ReturnCreatePage api={api} /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Xóa dòng 1" })).toBeDisabled();
  await user.type(screen.getByLabelText("Số phiếu (*)"), "RET-ERR");
  await user.selectOptions(await screen.findByLabelText("Chứng từ gốc (*)"), "document-1");
  await user.selectOptions(await screen.findByLabelText("Sản phẩm dòng 1 (*)"), "movement-1");
  await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
  await user.selectOptions(await screen.findByLabelText("Sản phẩm dòng 2 (*)"), "movement-2");
  await user.click(screen.getByRole("button", { name: "Tạo phiếu trả" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Số lượng trả vượt chứng từ gốc");
  expect(screen.getAllByLabelText(/Sản phẩm dòng \d+ \(\*\)/)).toHaveLength(2);
});
