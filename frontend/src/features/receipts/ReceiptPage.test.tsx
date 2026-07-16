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
    listLocations: vi.fn().mockResolvedValue([
      { id: "loc-a", code: "A-01", name: "Kệ A-01" },
      { id: "loc-b", code: "B-01", name: "Kệ B-01" },
    ]),
    listProducts: vi.fn().mockResolvedValue([
      { id: "prod-none", sku: "NONE-01", name: "Hàng thường", trackingMode: "none", expiryManaged: false },
      { id: "prod-lot", sku: "LOT-01", name: "Hàng theo lô", trackingMode: "lot", expiryManaged: true },
      { id: "prod-serial", sku: "SER-01", name: "Hàng serial", trackingMode: "serial", expiryManaged: false },
    ]),
    ...overrides,
  };
}

describe("ReceiptPage", () => {
  it("keeps receipts as a list screen and confirms a draft", async () => {
    const client = api({
      listReceipts: vi.fn().mockResolvedValue([{ id: "receipt-a", documentNo: "RCV-001", status: "draft", lineCount: 1, confirmedAt: null, createdAt: "2026-07-15T00:00:00.000Z" }]),
      confirmReceipt: vi.fn().mockResolvedValue({ alreadyConfirmed: false }),
    });
    const user = userEvent.setup();
    render(<MemoryRouter><ReceiptPage api={client} /></MemoryRouter>);

    expect(await screen.findByText("RCV-001")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm phiếu nhập" })).toHaveAttribute("href", "/receipts/create");
    await user.click(screen.getByRole("button", { name: "Xác nhận phiếu RCV-001" }));
    expect(client.confirmReceipt).toHaveBeenCalledWith("receipt-a");
  });

  it("creates receipt lines for none, lot and serial tracking", async () => {
    const client = api({ createReceipt: vi.fn().mockResolvedValue({ id: "receipt-a" }) });
    const user = userEvent.setup();
    render(<MemoryRouter><ReceiptCreatePage api={client} /></MemoryRouter>);

    await user.type(await screen.findByLabelText("Số phiếu (*)"), "RCV-001");
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 1 (*)"), "prod-none");
    await user.selectOptions(screen.getByLabelText("Vị trí dòng 1 (*)"), "loc-a");
    await user.clear(screen.getByLabelText("Số lượng dòng 1 (*)"));
    await user.type(screen.getByLabelText("Số lượng dòng 1 (*)"), "2");

    await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 2 (*)"), "prod-lot");
    await user.selectOptions(screen.getByLabelText("Vị trí dòng 2 (*)"), "loc-b");
    await user.type(screen.getByLabelText("Mã lô dòng 2 (*)"), "LOT-A");
    await user.type(screen.getByLabelText("Hạn dùng dòng 2 (*)"), "2027-01-01");

    await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 3 (*)"), "prod-serial");
    await user.selectOptions(screen.getByLabelText("Vị trí dòng 3 (*)"), "loc-a");
    await user.type(screen.getByLabelText("Serial dòng 3 (*)"), "SER-A");
    expect(screen.getByLabelText("Số lượng dòng 3 (*)")).toHaveValue(1);
    await user.click(screen.getByRole("button", { name: "Tạo phiếu nhập" }));

    expect(client.createReceipt).toHaveBeenCalledWith({
      documentNo: "RCV-001",
      lines: [
        { locationId: "loc-a", productId: "prod-none", quantity: 2 },
        { locationId: "loc-b", productId: "prod-lot", quantity: 1, lotCode: "LOT-A", expiresAt: "2027-01-01" },
        { locationId: "loc-a", productId: "prod-serial", quantity: 1, serialCode: "SER-A" },
      ],
    });
    expect(await screen.findByText("Đã tạo phiếu nhập")).toBeVisible();
    expect(screen.getAllByLabelText(/Sản phẩm dòng \d+ \(\*\)/)).toHaveLength(1);
  });

  it("clears stale tracking fields when a row product changes", async () => {
    const client = api({ createReceipt: vi.fn().mockResolvedValue({ id: "receipt-a" }) });
    const user = userEvent.setup();
    render(<MemoryRouter><ReceiptCreatePage api={client} /></MemoryRouter>);
    await screen.findByLabelText("Sản phẩm dòng 1 (*)");
    await user.type(screen.getByLabelText("Số phiếu (*)"), "RCV-STALE");
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 1 (*)"), "prod-lot");
    await user.selectOptions(screen.getByLabelText("Vị trí dòng 1 (*)"), "loc-a");
    await user.type(screen.getByLabelText("Mã lô dòng 1 (*)"), "LOT-STALE");
    await user.type(screen.getByLabelText("Hạn dùng dòng 1 (*)"), "2027-01-01");
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 1 (*)"), "prod-none");
    expect(screen.queryByLabelText("Mã lô dòng 1 (*)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hạn dùng dòng 1 (*)")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tạo phiếu nhập" }));
    expect(client.createReceipt).toHaveBeenCalledWith({ documentNo: "RCV-STALE", lines: [{ locationId: "loc-a", productId: "prod-none", quantity: 1 }] });
  });
});
