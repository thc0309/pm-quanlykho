import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PartnerClient } from "../../lib/api";
import PartnersPage, { PartnerCreatePage } from "./PartnersPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
    expect(screen.queryByLabelText("Mã đối tác (*)")).not.toBeInTheDocument();
  });

  it("updates and deactivates a partner without reloading", async () => {
    const partner = { id: "partner-1", warehouseId: "warehouse-a", code: "SUP-1", name: "Nhà cung cấp 1", kind: "supplier" as const, taxCode: null, phone: "0900000000", email: null, address: null, status: "active" as const };
    const api = createApi({
      listPartners: vi.fn().mockResolvedValue([partner]),
      updatePartner: vi.fn().mockResolvedValue({ ...partner, name: "Nhà cung cấp mới", phone: "0911111111" }),
      setPartnerStatus: vi.fn().mockResolvedValue({ ...partner, name: "Nhà cung cấp mới", phone: "0911111111", status: "inactive" }),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithRouter(<PartnersPage api={api} permissions={["partners.view", "partners.update", "partners.delete"]} />);

    await user.click(await screen.findByRole("button", { name: "Sửa đối tác Nhà cung cấp 1" }));
    const name = screen.getByRole("textbox", { name: "Tên đối tác Nhà cung cấp 1" });
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.type(name, "Nhà cung cấp mới");
    await user.clear(screen.getByRole("textbox", { name: "Điện thoại đối tác Nhà cung cấp 1" }));
    await user.type(screen.getByRole("textbox", { name: "Điện thoại đối tác Nhà cung cấp 1" }), "0911111111");
    await user.click(screen.getByRole("button", { name: "Lưu đối tác Nhà cung cấp 1" }));
    expect(api.updatePartner).toHaveBeenCalledWith("partner-1", { name: "Nhà cung cấp mới", taxCode: null, phone: "0911111111", email: null, address: null });
    expect(await screen.findByText("Nhà cung cấp mới")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Vô hiệu hóa đối tác Nhà cung cấp mới" }));
    expect(api.setPartnerStatus).toHaveBeenCalledWith("partner-1", "inactive");
    expect(await screen.findByText("Tạm ngưng")).toBeTruthy();
  });

  it("hides unauthorized partner actions and preserves state on error", async () => {
    const partner = { id: "partner-1", warehouseId: "warehouse-a", code: "SUP-1", name: "Nhà cung cấp 1", kind: "supplier" as const, taxCode: null, phone: null, email: null, address: null, status: "active" as const };
    const viewApi = createApi({ listPartners: vi.fn().mockResolvedValue([partner]) });
    const { unmount } = renderWithRouter(<PartnersPage api={viewApi} permissions={["partners.view"]} />);
    expect(await screen.findByText("Nhà cung cấp 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sửa đối tác/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vô hiệu hóa đối tác/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Thêm đối tác" })).not.toBeInTheDocument();
    unmount();

    const errorApi = createApi({ listPartners: vi.fn().mockResolvedValue([partner]), updatePartner: vi.fn().mockRejectedValue(new Error("Không thể cập nhật đối tác đang tham chiếu")) });
    const user = userEvent.setup();
    renderWithRouter(<PartnersPage api={errorApi} permissions={["partners.view", "partners.update"]} />);
    await user.click(await screen.findByRole("button", { name: "Sửa đối tác Nhà cung cấp 1" }));
    await user.click(screen.getByRole("button", { name: "Lưu đối tác Nhà cung cấp 1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể cập nhật đối tác đang tham chiếu");
    expect(screen.getByText("Nhà cung cấp 1", { selector: "td" })).toBeInTheDocument();
  });

  it("creates a supplier from a dedicated form screen", async () => {
    const api = createApi({
      createPartner: vi.fn().mockResolvedValue({ id: "partner-1", warehouseId: "warehouse-a", code: "SUP-1", name: "Nhà cung cấp 1", kind: "supplier", taxCode: null, phone: "0900000000", email: null, address: null, status: "active" }),
    });
    const user = userEvent.setup();

    renderWithRouter(<PartnerCreatePage api={api} />);

    await user.type(screen.getByLabelText("Mã đối tác (*)"), "SUP-1");
    await user.type(screen.getByLabelText("Tên đối tác (*)"), "Nhà cung cấp 1");
    await user.selectOptions(screen.getByLabelText("Loại đối tác (*)"), "supplier");
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
