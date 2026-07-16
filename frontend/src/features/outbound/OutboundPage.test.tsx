import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OutboundClient } from "../../lib/api";
import OutboundPage, { OutboundCreatePage } from "./OutboundPage";

afterEach(cleanup);

function client(overrides: Partial<OutboundClient> = {}): OutboundClient {
  return {
    listOutbounds: vi.fn().mockResolvedValue([]),
    createOutbound: vi.fn(),
    releaseOutbound: vi.fn(),
    listProducts: vi.fn().mockResolvedValue([
      { id: "product-a", sku: "SKU-A", name: "Sản phẩm A" },
      { id: "product-b", sku: "SKU-B", name: "Sản phẩm B" },
    ]),
    ...overrides,
  };
}

describe("OutboundPage", () => {
  it("keeps the list separate and releases a draft", async () => {
    const api = client({ listOutbounds: vi.fn().mockResolvedValue([{ id: "out-a", documentNo: "OUT-001", status: "draft", lineCount: 1, reservedUntil: null, createdAt: "2026-07-15T00:00:00Z" }]), releaseOutbound: vi.fn().mockResolvedValue({ alreadyReleased: false, reservedUntil: "2026-07-15T00:30:00Z" }) });
    const user = userEvent.setup();
    render(<MemoryRouter><OutboundPage api={api} /></MemoryRouter>);
    expect(await screen.findByText("OUT-001")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Release phiếu OUT-001" }));
    expect(api.releaseOutbound).toHaveBeenCalledWith("out-a");
    expect(await screen.findByText("Sẵn sàng soạn")).toBeTruthy();
  });

  it("creates a two-line outbound and resets to one blank row", async () => {
    const api = client({ createOutbound: vi.fn().mockResolvedValue({ id: "out-a" }) });
    const user = userEvent.setup();
    render(<MemoryRouter><OutboundCreatePage api={api} /></MemoryRouter>);
    await user.type(await screen.findByLabelText("Số phiếu (*)"), "OUT-001");
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 1 (*)"), "product-a");
    await user.clear(screen.getByLabelText("Số lượng dòng 1 (*)"));
    await user.type(screen.getByLabelText("Số lượng dòng 1 (*)"), "3");
    await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 2 (*)"), "product-b");
    await user.clear(screen.getByLabelText("Số lượng dòng 2 (*)"));
    await user.type(screen.getByLabelText("Số lượng dòng 2 (*)"), "4");
    await user.click(screen.getByRole("button", { name: "Tạo phiếu xuất" }));

    expect(api.createOutbound).toHaveBeenCalledWith({ documentNo: "OUT-001", lines: [{ productId: "product-a", quantity: 3 }, { productId: "product-b", quantity: 4 }] });
    expect(await screen.findByText("Đã tạo phiếu xuất")).toBeTruthy();
    expect(screen.getAllByLabelText(/Sản phẩm dòng \d+ \(\*\)/)).toHaveLength(1);
    expect(screen.getByLabelText("Sản phẩm dòng 1 (*)")).toHaveValue("");
    expect(screen.getByLabelText("Số phiếu (*)")).toHaveValue("");
  });

  it("keeps outbound rows after an API error and guards the final row", async () => {
    const api = client({ createOutbound: vi.fn().mockRejectedValue(new Error("Không đủ tồn khả dụng")) });
    const user = userEvent.setup();
    render(<MemoryRouter><OutboundCreatePage api={api} /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Xóa dòng 1" })).toBeDisabled();
    await user.type(screen.getByLabelText("Số phiếu (*)"), "OUT-ERR");
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 1 (*)"), "product-a");
    await user.click(screen.getByRole("button", { name: "Thêm dòng" }));
    await user.selectOptions(screen.getByLabelText("Sản phẩm dòng 2 (*)"), "product-b");
    await user.click(screen.getByRole("button", { name: "Tạo phiếu xuất" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không đủ tồn khả dụng");
    expect(screen.getAllByLabelText(/Sản phẩm dòng \d+ \(\*\)/)).toHaveLength(2);
  });
});
