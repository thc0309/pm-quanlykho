import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LocationClient } from "../../lib/api";
import LocationsPage from "./LocationsPage";

describe("LocationsPage", () => {
  it("creates a typed warehouse location", async () => {
    const api: LocationClient = {
      listLocations: vi.fn().mockResolvedValue([]),
      createLocation: vi.fn().mockImplementation(async (input) => ({ id: "location-1", warehouseId: "warehouse-a", status: "active", ...input })),
      findLocationByBarcode: vi.fn(),
    };
    const user = userEvent.setup();
    render(<LocationsPage api={api} />);

    await user.type(await screen.findByLabelText("Mã vị trí"), "ST-01");
    await user.type(screen.getByLabelText("Barcode"), "SCAN-ST-01");
    await user.type(screen.getByLabelText("Tên vị trí"), "Kệ lưu trữ 01");
    await user.selectOptions(screen.getByLabelText("Loại vị trí"), "storage");
    await user.click(screen.getByRole("button", { name: "Tạo vị trí" }));

    expect(api.createLocation).toHaveBeenCalledWith({ code: "ST-01", barcode: "SCAN-ST-01", name: "Kệ lưu trữ 01", type: "storage" });
    expect(await screen.findByText("Kệ lưu trữ 01")).toBeTruthy();
  });
});
