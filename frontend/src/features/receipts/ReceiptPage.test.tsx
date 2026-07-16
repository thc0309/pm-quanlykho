import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReceiptClient } from "../../lib/api";
import ReceiptPage, { ReceiptCreatePage } from "./ReceiptPage";

afterEach(cleanup);

function api(overrides: Partial<ReceiptClient> = {}): ReceiptClient {
  return {
    listReceipts: vi.fn().mockResolvedValue([]),
    createReceipt: vi.fn(),
    confirmReceipt: vi.fn(),
    listLocations: vi.fn().mockResolvedValue([{ id: "loc-a", code: "A-01", name: "Kệ A-01" }]),
    listProducts: vi.fn().mockResolvedValue([{
      id: "prod-lot",
      sku: "LOT-01",
      name: "Hàng theo lô",
      trackingMode: "lot",
      expiryManaged: true,
    }]),
    ...overrides,
  };
}

describe("ReceiptPage", () => {
  it("keeps receipts as a list screen and confirms a draft", async () => {
    const client = api({
      listReceipts: vi.fn().mockResolvedValue([{
        id: "receipt-a",
        documentNo: "RCV-001",
        status: "draft",
        lineCount: 1,
        confirmedAt: null,
        createdAt: "2026-07-15T00:00:00.000Z",
      }]),
      confirmReceipt: vi.fn().mockResolvedValue({ alreadyConfirmed: false }),
    });
    const user = userEvent.setup();
    render(<MemoryRouter><ReceiptPage api={client} /></MemoryRouter>);

    expect(await screen.findByText("RCV-001")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm phiếu nhập" })).toHaveAttribute("href", "/receipts/create");
    expect(screen.queryByLabelText("Số phiếu (*)")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xác nhận phiếu RCV-001" }));
    expect(client.confirmReceipt).toHaveBeenCalledWith("receipt-a");
  });

  it("creates an expiry-managed lot receipt from a dedicated form", async () => {
    const client = api({ createReceipt: vi.fn().mockResolvedValue({ id: "receipt-a" }) });
    const user = userEvent.setup();
    render(<MemoryRouter><ReceiptCreatePage api={client} /></MemoryRouter>);

    await screen.findByRole("option", { name: "LOT-01 - Hàng theo lô" });
    await user.type(screen.getByLabelText("Số phiếu (*)"), "RCV-001");
    await user.selectOptions(screen.getByLabelText("Sản phẩm (*)"), "prod-lot");
    await user.selectOptions(screen.getByLabelText("Vị trí (*)"), "loc-a");
    await user.clear(screen.getByLabelText("Số lượng (*)"));
    await user.type(screen.getByLabelText("Số lượng (*)"), "5");
    await user.type(screen.getByLabelText("Mã lô (*)"), "LOT-A");
    expect(screen.getByLabelText("Ngày sản xuất")).not.toBeRequired();
    await user.type(screen.getByLabelText("Hạn dùng (*)"), "2027-01-01");
    await user.click(screen.getByRole("button", { name: "Tạo phiếu nhập" }));

    expect(client.createReceipt).toHaveBeenCalledWith({
      documentNo: "RCV-001",
      lines: [{
        locationId: "loc-a",
        productId: "prod-lot",
        quantity: 5,
        lotCode: "LOT-A",
        expiresAt: "2027-01-01",
      }],
    });
    expect(await screen.findByText("Đã tạo phiếu nhập")).toBeTruthy();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
