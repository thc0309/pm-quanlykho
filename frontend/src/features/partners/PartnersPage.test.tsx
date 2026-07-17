import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
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

function renderWithRoute(path: string, routePath: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        <Route path="*" element={<div />} />
      </Routes>
    </MemoryRouter>,
  );
}

function createApi(overrides: Partial<PartnerClient> = {}): PartnerClient {
  return {
    listPartners: vi.fn().mockResolvedValue([]),
    getPartner: vi.fn(),
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

  it("updates a partner on the shared edit route and deactivates from the list", async () => {
    const partner = { id: "partner-1", warehouseId: "warehouse-a", code: "SUP-1", name: "Nhà cung cấp 1", kind: "supplier" as const, taxCode: null, phone: "0900000000", email: null, address: null, status: "active" as const };
    const api = createApi({
      listPartners: vi.fn().mockResolvedValue([partner]),
      getPartner: vi.fn().mockResolvedValue(partner),
      updatePartner: vi.fn().mockResolvedValue({ ...partner, name: "Nhà cung cấp mới", phone: "0911111111" }),
      setPartnerStatus: vi.fn().mockResolvedValue({ ...partner, name: "Nhà cung cấp mới", phone: "0911111111", status: "inactive" }),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithRoute("/partners/partner-1/edit", "/partners/:partnerId/edit", <PartnerCreatePage api={api} />);

    const name = await screen.findByLabelText("Tên đối tác (*)");
    await user.clear(name);
    await user.type(name, "Nhà cung cấp mới");
    await user.clear(screen.getByLabelText("Điện thoại"));
    await user.type(screen.getByLabelText("Điện thoại"), "0911111111");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(api.updatePartner).toHaveBeenCalledWith("partner-1", { name: "Nhà cung cấp mới", taxCode: null, phone: "0911111111", email: null, address: null });

    renderWithRouter(<PartnersPage api={api} permissions={["partners.view", "partners.update", "partners.delete"]} />);
    expect(await screen.findByRole("link", { name: "Sửa đối tác Nhà cung cấp 1" })).toHaveAttribute("href", "/partners/partner-1/edit");
    await user.click(screen.getByRole("button", { name: "Vô hiệu hóa đối tác Nhà cung cấp 1" }));
    expect(api.setPartnerStatus).toHaveBeenCalledWith("partner-1", "inactive");
    expect(await screen.findByText("Tạm ngưng")).toBeTruthy();
  });

  it("hides unauthorized partner actions and preserves state on error", async () => {
    const partner = { id: "partner-1", warehouseId: "warehouse-a", code: "SUP-1", name: "Nhà cung cấp 1", kind: "supplier" as const, taxCode: null, phone: null, email: null, address: null, status: "active" as const };
    const viewApi = createApi({ listPartners: vi.fn().mockResolvedValue([partner]) });
    const { unmount } = renderWithRouter(<PartnersPage api={viewApi} permissions={["partners.view"]} />);
    expect(await screen.findByText("Nhà cung cấp 1")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Sửa đối tác/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vô hiệu hóa đối tác/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Thêm đối tác" })).not.toBeInTheDocument();
    unmount();

    const errorApi = createApi({
      getPartner: vi.fn().mockResolvedValue(partner),
      updatePartner: vi.fn().mockRejectedValue(new Error("Không thể cập nhật đối tác đang tham chiếu")),
    });
    const user = userEvent.setup();
    renderWithRoute("/partners/partner-1/edit", "/partners/:partnerId/edit", <PartnerCreatePage api={errorApi} />);
    await user.click(await screen.findByRole("button", { name: "Lưu thay đổi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể cập nhật đối tác đang tham chiếu");
    expect(screen.getByLabelText("Tên đối tác (*)")).toHaveValue("Nhà cung cấp 1");
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
