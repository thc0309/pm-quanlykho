import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
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

describe("LocationsPage", () => {
  it("creates a typed warehouse location", async () => {
    const api: LocationClient = {
      listLocations: vi.fn().mockResolvedValue([]),
      getLocation: vi.fn(),
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

  it("updates a location on the shared edit route and deactivates from the list", async () => {
    const location = { id: "location-1", warehouseId: "warehouse-a", status: "active" as const, code: "ST-01", barcode: "SCAN-ST-01", name: "Kệ 01", type: "storage" as const };
    const api: LocationClient = {
      listLocations: vi.fn().mockResolvedValue([location]),
      getLocation: vi.fn().mockResolvedValue(location),
      createLocation: vi.fn(),
      updateLocation: vi.fn().mockResolvedValue({ ...location, barcode: "SCAN-ST-02", name: "Kệ 02", type: "staging" }),
      setLocationStatus: vi.fn().mockResolvedValue({ ...location, barcode: "SCAN-ST-02", name: "Kệ 02", type: "staging", status: "inactive" }),
      findLocationByBarcode: vi.fn(),
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithRoute("/locations/location-1/edit", "/locations/:locationId/edit", <LocationCreatePage api={api} />);

    const name = await screen.findByLabelText("Tên vị trí (*)");
    await user.clear(name);
    await user.type(name, "Kệ 02");
    await user.clear(screen.getByLabelText("Barcode (*)"));
    await user.type(screen.getByLabelText("Barcode (*)"), "SCAN-ST-02");
    await user.selectOptions(screen.getByLabelText("Loại vị trí (*)"), "staging");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(api.updateLocation).toHaveBeenCalledWith("location-1", { name: "Kệ 02", barcode: "SCAN-ST-02", type: "staging" });

    renderWithRouter(<LocationsPage api={api} permissions={["locations.view", "locations.update", "locations.delete"]} />);
    expect(await screen.findByRole("link", { name: "Sửa vị trí Kệ 01" })).toHaveAttribute("href", "/locations/location-1/edit");
    await user.click(screen.getByRole("button", { name: "Vô hiệu hóa vị trí Kệ 01" }));
    expect(api.setLocationStatus).toHaveBeenCalledWith("location-1", "inactive");
    expect(await screen.findByText("Tạm ngưng")).toBeTruthy();
  });

  it("hides unauthorized location actions and shows edit route error on conflict", async () => {
    const location = { id: "location-1", warehouseId: "warehouse-a", status: "active" as const, code: "ST-01", barcode: "SCAN-ST-01", name: "Kệ 01", type: "storage" as const };
    const viewApi: LocationClient = { listLocations: vi.fn().mockResolvedValue([location]), getLocation: vi.fn(), createLocation: vi.fn(), updateLocation: vi.fn(), setLocationStatus: vi.fn(), findLocationByBarcode: vi.fn() };
    const { unmount } = renderWithRouter(<LocationsPage api={viewApi} permissions={["locations.view"]} />);
    expect(await screen.findByText("Kệ 01")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sửa vị trí/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vô hiệu hóa vị trí/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Thêm vị trí" })).not.toBeInTheDocument();
    unmount();

    const errorApi: LocationClient = { ...viewApi, getLocation: vi.fn().mockResolvedValue(location), updateLocation: vi.fn().mockRejectedValue(new Error("Vị trí còn tồn kho nên không thể thay đổi")) };
    const user = userEvent.setup();
    renderWithRoute("/locations/location-1/edit", "/locations/:locationId/edit", <LocationCreatePage api={errorApi} />);
    await user.clear(await screen.findByLabelText("Tên vị trí (*)"));
    await user.type(screen.getByLabelText("Tên vị trí (*)"), "Tên không lưu");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vị trí còn tồn kho nên không thể thay đổi");
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
      getLocation: vi.fn(),
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
