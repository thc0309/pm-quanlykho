import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogClient } from "../../lib/api";
import { CategoriesPage, CategoryCreatePage, UnitCreatePage, UnitsPage } from "./CatalogPage";

afterEach(cleanup);

function renderWithRouter(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

function createApi(overrides: Partial<CatalogClient> = {}): CatalogClient {
  return {
    listCategories: vi.fn().mockResolvedValue([]),
    createCategory: vi.fn(),
    listUnits: vi.fn().mockResolvedValue([]),
    createUnit: vi.fn(),
    ...overrides,
  };
}

describe("CatalogPage", () => {
  it("keeps categories as a separate list screen with an add action", async () => {
    const api = createApi({
      listCategories: vi.fn().mockResolvedValue([
        { id: "category-1", warehouseId: "warehouse-a", code: "DRY", name: "Hàng khô", status: "active" },
      ]),
    });

    renderWithRouter(<CategoriesPage api={api} />);

    expect(await screen.findByText("Hàng khô")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm danh mục" })).toHaveAttribute("href", "/catalog/categories/create");
    expect(screen.queryByRole("link", { name: "Thêm đơn vị" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mã danh mục")).not.toBeInTheDocument();
    expect(api.listUnits).not.toHaveBeenCalled();
  });

  it("keeps units as a separate list screen with an add action", async () => {
    const api = createApi({
      listUnits: vi.fn().mockResolvedValue([
        { id: "unit-1", warehouseId: "warehouse-a", code: "PCS", name: "Cái", baseUnitId: null, conversionFactor: "1", status: "active" },
      ]),
    });

    renderWithRouter(<UnitsPage api={api} />);

    expect(await screen.findByText("Cái")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm đơn vị" })).toHaveAttribute("href", "/catalog/units/create");
    expect(screen.queryByRole("link", { name: "Thêm danh mục" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mã đơn vị")).not.toBeInTheDocument();
    expect(api.listCategories).not.toHaveBeenCalled();
  });

  it("creates a category from a dedicated form screen", async () => {
    const api = createApi({
      createCategory: vi.fn().mockResolvedValue({ id: "category-1", warehouseId: "warehouse-a", code: "DRY", name: "Hàng khô", status: "active" }),
    });
    const user = userEvent.setup();
    renderWithRouter(<CategoryCreatePage api={api} />);

    await user.type(screen.getByLabelText("Mã danh mục"), "DRY");
    await user.type(screen.getByLabelText("Tên danh mục"), "Hàng khô");
    await user.click(screen.getByRole("button", { name: "Tạo danh mục" }));

    expect(api.createCategory).toHaveBeenCalledWith({ code: "DRY", name: "Hàng khô" });
    expect(await screen.findByText("Đã tạo danh mục")).toBeTruthy();
  });

  it("creates a converted unit from a base unit", async () => {
    const api = createApi({
      listUnits: vi.fn().mockResolvedValue([
        { id: "unit-base", warehouseId: "warehouse-a", code: "BOX", name: "Thùng", baseUnitId: null, conversionFactor: "1", status: "active" },
      ]),
      createUnit: vi.fn().mockResolvedValue({
        id: "unit-conversion",
        warehouseId: "warehouse-a",
        code: "PCS",
        name: "Cái",
        baseUnitId: "unit-base",
        conversionFactor: "24",
        status: "active",
      }),
    });
    const user = userEvent.setup();
    renderWithRouter(<UnitCreatePage api={api} />);

    await user.type(await screen.findByLabelText("Mã đơn vị"), "PCS");
    await user.type(screen.getByLabelText("Tên đơn vị"), "Cái");
    await user.selectOptions(screen.getByLabelText("Loại đơn vị"), "conversion");
    await user.selectOptions(screen.getByLabelText("Đơn vị gốc"), "unit-base");
    await user.type(screen.getByLabelText("Hệ số quy đổi"), "24");
    await user.click(screen.getByRole("button", { name: "Tạo đơn vị" }));

    expect(api.createUnit).toHaveBeenCalledWith({
      code: "PCS",
      name: "Cái",
      baseUnitId: "unit-base",
      conversionFactor: "24",
    });
    expect(await screen.findByText("Đã tạo đơn vị")).toBeTruthy();
  });
});
