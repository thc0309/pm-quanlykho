import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogClient } from "../../lib/api";
import { CategoriesPage, CategoryCreatePage, UnitCreatePage, UnitsPage } from "./CatalogPage";

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

function createApi(overrides: Partial<CatalogClient> = {}): CatalogClient {
  return {
    listCategories: vi.fn().mockResolvedValue([]),
    getCategory: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    setCategoryStatus: vi.fn(),
    listUnits: vi.fn().mockResolvedValue([]),
    getUnit: vi.fn(),
    createUnit: vi.fn(),
    updateUnit: vi.fn(),
    setUnitStatus: vi.fn(),
    listCategorySpecDefinitions: vi.fn().mockResolvedValue([]),
    createCategorySpecDefinition: vi.fn(),
    updateCategorySpecDefinition: vi.fn(),
    setCategorySpecDefinitionStatus: vi.fn(),
    createCategorySpecOption: vi.fn(),
    updateCategorySpecOption: vi.fn(),
    setCategorySpecOptionStatus: vi.fn(),
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
    expect(screen.queryByLabelText("Mã danh mục (*)")).not.toBeInTheDocument();
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
    expect(screen.queryByLabelText("Mã đơn vị (*)")).not.toBeInTheDocument();
    expect(api.listCategories).not.toHaveBeenCalled();
  });

  it("creates a category from a dedicated form screen", async () => {
    const api = createApi({
      createCategory: vi.fn().mockResolvedValue({ id: "category-1", warehouseId: "warehouse-a", code: "DRY", name: "Hàng khô", status: "active" }),
    });
    const user = userEvent.setup();
    renderWithRouter(<CategoryCreatePage api={api} />);

    await user.type(screen.getByLabelText("Mã danh mục (*)"), "DRY");
    await user.type(screen.getByLabelText("Tên danh mục (*)"), "Hàng khô");
    await user.click(screen.getByRole("button", { name: "Tạo danh mục" }));

    expect(api.createCategory).toHaveBeenCalledWith({ code: "DRY", name: "Hàng khô" });
    expect(await screen.findByText("Đã tạo danh mục")).toBeTruthy();
  });

  it("updates a category on the shared edit route and deactivates from the list", async () => {
    const category = { id: "category-1", warehouseId: "warehouse-a", code: "DRY", name: "Hàng khô", status: "active" as const };
    const api = createApi({
      listCategories: vi.fn().mockResolvedValue([category]),
      getCategory: vi.fn().mockResolvedValue(category),
      updateCategory: vi.fn().mockResolvedValue({ ...category, name: "Hàng khô mới" }),
      setCategoryStatus: vi.fn().mockResolvedValue({ ...category, name: "Hàng khô mới", status: "inactive" }),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithRoute("/catalog/categories/category-1/edit", "/catalog/categories/:categoryId/edit", <CategoryCreatePage api={api} />);

    const input = await screen.findByLabelText("Tên danh mục (*)");
    await user.clear(input);
    await user.type(input, "Hàng khô mới");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(api.updateCategory).toHaveBeenCalledWith("category-1", { name: "Hàng khô mới" });

    renderWithRouter(<CategoriesPage api={api} permissions={["catalog.categories.view", "catalog.categories.update", "catalog.categories.delete"]} />);
    expect(await screen.findByRole("link", { name: "Sửa danh mục Hàng khô" })).toHaveAttribute("href", "/catalog/categories/category-1/edit");
    await user.click(screen.getByRole("button", { name: "Vô hiệu hóa danh mục Hàng khô" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(api.setCategoryStatus).toHaveBeenCalledWith("category-1", "inactive");
    expect(await screen.findByText("Tạm ngưng")).toBeTruthy();
  });

  it("updates a unit on the shared edit route and activates from the list", async () => {
    const unit = { id: "unit-1", warehouseId: "warehouse-a", code: "PCS", name: "Cái", baseUnitId: null, conversionFactor: "1", status: "inactive" as const };
    const api = createApi({
      listUnits: vi.fn().mockResolvedValue([unit]),
      getUnit: vi.fn().mockResolvedValue(unit),
      updateUnit: vi.fn().mockResolvedValue({ ...unit, name: "Chiếc" }),
      setUnitStatus: vi.fn().mockResolvedValue({ ...unit, name: "Chiếc", status: "active" }),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithRoute("/catalog/units/unit-1/edit", "/catalog/units/:unitId/edit", <UnitCreatePage api={api} />);

    const input = await screen.findByLabelText("Tên đơn vị (*)");
    await user.clear(input);
    await user.type(input, "Chiếc");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(api.updateUnit).toHaveBeenCalledWith("unit-1", { name: "Chiếc" });

    renderWithRouter(<UnitsPage api={api} permissions={["catalog.units.view", "catalog.units.update", "catalog.units.delete"]} />);
    expect(await screen.findByRole("link", { name: "Sửa đơn vị Cái" })).toHaveAttribute("href", "/catalog/units/unit-1/edit");
    await user.click(screen.getByRole("button", { name: "Kích hoạt đơn vị Cái" }));
    expect(api.setUnitStatus).toHaveBeenCalledWith("unit-1", "active");
    expect(await screen.findByText("Đang dùng")).toBeTruthy();
  });

  it("hides unauthorized catalog actions and displays a constraint error", async () => {
    const category = { id: "category-1", warehouseId: "warehouse-a", code: "DRY", name: "Hàng khô", status: "active" as const };
    const viewApi = createApi({ listCategories: vi.fn().mockResolvedValue([category]) });
    const { unmount } = renderWithRouter(<CategoriesPage api={viewApi} permissions={["catalog.categories.view"]} />);
    expect(await screen.findByText("Hàng khô")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Sửa danh mục/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vô hiệu hóa danh mục/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Thêm danh mục" })).not.toBeInTheDocument();
    unmount();

    const errorApi = createApi({
      getCategory: vi.fn().mockResolvedValue(category),
      updateCategory: vi.fn().mockRejectedValue(new Error("Danh mục đang được sản phẩm tham chiếu")),
    });
    const user = userEvent.setup();
    renderWithRoute("/catalog/categories/category-1/edit", "/catalog/categories/:categoryId/edit", <CategoryCreatePage api={errorApi} />);
    await user.clear(await screen.findByLabelText("Tên danh mục (*)"));
    await user.type(screen.getByLabelText("Tên danh mục (*)"), "Tên mới");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Danh mục đang được sản phẩm tham chiếu");
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

    await user.type(await screen.findByLabelText("Mã đơn vị (*)"), "PCS");
    await user.type(screen.getByLabelText("Tên đơn vị (*)"), "Cái");
    await user.selectOptions(screen.getByLabelText("Loại đơn vị"), "conversion");
    await user.selectOptions(screen.getByLabelText("Đơn vị gốc (*)"), "unit-base");
    await user.type(screen.getByLabelText("Hệ số quy đổi (*)"), "24");
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
