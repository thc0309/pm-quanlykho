import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PartnerClient } from "../../lib/api";
import PartnersPage, { PartnerCreatePage } from "./PartnersPage";

afterEach(cleanup);

function renderWithRouter(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

function createApi(overrides: Partial<PartnerClient> = {}): PartnerClient {
  return {
    listPartners: vi.fn().mockResolvedValue([]),
    createPartner: vi.fn(),
    updatePartner: vi.fn(),
    setPartnerStatus: vi.fn(),
    ...overrides,
  };
}

describe("PartnersPage", () => {
  it("keeps partners as a list screen with add action", async () => {
    const api = createApi({
      listPartners: vi.fn().mockResolvedValue([
        { id: "partner-1", warehouseId: "warehouse-a", code: "SUP-1", name: "Nhà cung cấp 1", kind: "supplier", taxCode: null, phone: null, email: null, address: null, status: "active" },
      ]),
    });

    renderWithRouter(<PartnersPage api={api} />);

    expect(await screen.findByText("Nhà cung cấp 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm đối tác" })).toHaveAttribute("href", "/partners/create");
    expect(screen.queryByLabelText("Mã đối tác")).not.toBeInTheDocument();
  });

  it("creates a supplier from a dedicated form screen", async () => {
    const api = createApi({
      createPartner: vi.fn().mockResolvedValue({ id: "partner-1", warehouseId: "warehouse-a", code: "SUP-1", name: "Nhà cung cấp 1", kind: "supplier", taxCode: null, phone: "0900000000", email: null, address: null, status: "active" }),
    });
    const user = userEvent.setup();

    renderWithRouter(<PartnerCreatePage api={api} />);

    await user.type(screen.getByLabelText("Mã đối tác"), "SUP-1");
    await user.type(screen.getByLabelText("Tên đối tác"), "Nhà cung cấp 1");
    await user.selectOptions(screen.getByLabelText("Loại đối tác"), "supplier");
    await user.type(screen.getByLabelText("Điện thoại"), "0900000000");
    await user.click(screen.getByRole("button", { name: "Tạo đối tác" }));

    expect(api.createPartner).toHaveBeenCalledWith({
      code: "SUP-1",
      name: "Nhà cung cấp 1",
      kind: "supplier",
      taxCode: "",
      phone: "0900000000",
      email: "",
      address: "",
    });
    expect(await screen.findByText("Đã tạo đối tác")).toBeTruthy();
  });
});
