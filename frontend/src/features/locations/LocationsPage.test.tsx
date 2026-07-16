import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LocationClient } from "../../lib/api";
import LocationsPage, { LocationCreatePage } from "./LocationsPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderWithRouter(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("LocationsPage", () => {
  it("creates a typed warehouse location", async () => {
    const api: LocationClient = {
      listLocations: vi.fn().mockResolvedValue([]),
      createLocation: vi.fn().mockImplementation(async (input) => ({ id: "location-1", warehouseId: "warehouse-a", status: "active", ...input })),
      updateLocation: vi.fn(),
      setLocationStatus: vi.fn(),
      findLocationByBarcode: vi.fn(),
    };
    const user = userEvent.setup();
    renderWithRouter(<LocationCreatePage api={api} />);

    await user.type(await screen.findByLabelText("Mã vị trí (*)"), "ST-01");
    await user.type(screen.getByLabelText("Barcode (*)"), "SCAN-ST-01");
    await user.type(screen.getByLabelText("Tên vị trí (*)"), "Kệ lưu trữ 01");
    await user.selectOptions(screen.getByLabelText("Loại vị trí (*)"), "storage");
    await user.click(screen.getByRole("button", { name: "Tạo vị trí" }));

    expect(api.createLocation).toHaveBeenCalledWith({ code: "ST-01", barcode: "SCAN-ST-01", name: "Kệ lưu trữ 01", type: "storage" });
    expect(await screen.findByText("Đã tạo vị trí")).toBeTruthy();
  });

  it("updates and deactivates a location without reloading", async () => {
    const location = { id: "location-1", warehouseId: "warehouse-a", status: "active" as const, code: "ST-01", barcode: "SCAN-ST-01", name: "Kệ 01", type: "storage" as const };
    const api: LocationClient = {
      listLocations: vi.fn().mockResolvedValue([location]),
      createLocation: vi.fn(),
      updateLocation: vi.fn().mockResolvedValue({ ...location, barcode: "SCAN-ST-02", name: "Kệ 02", type: "staging" }),
      setLocationStatus: vi.fn().mockResolvedValue({ ...location, barcode: "SCAN-ST-02", name: "Kệ 02", type: "staging", status: "inactive" }),
      findLocationByBarcode: vi.fn(),
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithRouter(<LocationsPage api={api} permissions={["locations.view", "locations.update", "locations.delete"]} />);

    await user.click(await screen.findByRole("button", { name: "Sửa vị trí Kệ 01" }));
    const name = screen.getByRole("textbox", { name: "Tên vị trí Kệ 01" });
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.type(name, "Kệ 02");
    await user.clear(screen.getByRole("textbox", { name: "Barcode vị trí Kệ 01" }));
    await user.type(screen.getByRole("textbox", { name: "Barcode vị trí Kệ 01" }), "SCAN-ST-02");
    await user.selectOptions(screen.getByRole("combobox", { name: "Loại vị trí Kệ 01" }), "staging");
    await user.click(screen.getByRole("button", { name: "Lưu vị trí Kệ 01" }));
    expect(api.updateLocation).toHaveBeenCalledWith("location-1", { name: "Kệ 02", barcode: "SCAN-ST-02", type: "staging" });
    expect(await screen.findByText("Kệ 02")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Vô hiệu hóa vị trí Kệ 02" }));
    expect(api.setLocationStatus).toHaveBeenCalledWith("location-1", "inactive");
    expect(await screen.findByText("Tạm ngưng")).toBeTruthy();
  });

  it("hides unauthorized location actions and preserves state on conflict", async () => {
    const location = { id: "location-1", warehouseId: "warehouse-a", status: "active" as const, code: "ST-01", barcode: "SCAN-ST-01", name: "Kệ 01", type: "storage" as const };
    const viewApi: LocationClient = { listLocations: vi.fn().mockResolvedValue([location]), createLocation: vi.fn(), updateLocation: vi.fn(), setLocationStatus: vi.fn(), findLocationByBarcode: vi.fn() };
    const { unmount } = renderWithRouter(<LocationsPage api={viewApi} permissions={["locations.view"]} />);
    expect(await screen.findByText("Kệ 01")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sửa vị trí/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vô hiệu hóa vị trí/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Thêm vị trí" })).not.toBeInTheDocument();
    unmount();

    const errorApi: LocationClient = { ...viewApi, updateLocation: vi.fn().mockRejectedValue(new Error("Vị trí còn tồn kho nên không thể thay đổi")) };
    const user = userEvent.setup();
    renderWithRouter(<LocationsPage api={errorApi} permissions={["locations.view", "locations.update"]} />);
    await user.click(await screen.findByRole("button", { name: "Sửa vị trí Kệ 01" }));
    await user.clear(screen.getByRole("textbox", { name: "Tên vị trí Kệ 01" }));
    await user.type(screen.getByRole("textbox", { name: "Tên vị trí Kệ 01" }), "Tên không lưu");
    await user.click(screen.getByRole("button", { name: "Lưu vị trí Kệ 01" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vị trí còn tồn kho nên không thể thay đổi");
    expect(screen.queryByText("Tên không lưu", { selector: "td" })).not.toBeInTheDocument();
  });

  it("keeps the location screen as a list with an add action", async () => {
    const api: LocationClient = {
      listLocations: vi.fn().mockResolvedValue([
        {
          id: "location-1",
          warehouseId: "warehouse-a",
          status: "active",
          code: "ST-01",
          barcode: "SCAN-ST-01",
          name: "Kệ lưu trữ 01",
          type: "storage",
        },
      ]),
      createLocation: vi.fn(),
      updateLocation: vi.fn(),
      setLocationStatus: vi.fn(),
      findLocationByBarcode: vi.fn(),
    };

    renderWithRouter(<LocationsPage api={api} />);

    expect(await screen.findByText("Kệ lưu trữ 01")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm vị trí" })).toHaveAttribute("href", "/locations/create");
    expect(screen.queryByLabelText("Mã vị trí (*)")).not.toBeInTheDocument();
  });
});
