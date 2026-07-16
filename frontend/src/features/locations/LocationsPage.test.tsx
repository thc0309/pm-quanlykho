import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LocationClient } from "../../lib/api";
import LocationsPage, { LocationCreatePage } from "./LocationsPage";

afterEach(cleanup);

function renderWithRouter(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("LocationsPage", () => {
  it("creates a typed warehouse location", async () => {
    const api: LocationClient = {
      listLocations: vi.fn().mockResolvedValue([]),
      createLocation: vi.fn().mockImplementation(async (input) => ({ id: "location-1", warehouseId: "warehouse-a", status: "active", ...input })),
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
      findLocationByBarcode: vi.fn(),
    };

    renderWithRouter(<LocationsPage api={api} />);

    expect(await screen.findByText("Kệ lưu trữ 01")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm vị trí" })).toHaveAttribute("href", "/locations/create");
    expect(screen.queryByLabelText("Mã vị trí (*)")).not.toBeInTheDocument();
  });
});
