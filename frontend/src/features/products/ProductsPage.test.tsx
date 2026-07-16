import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductClient } from "../../lib/api";
import ProductsPage, { ProductCreatePage } from "./ProductsPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderWithRouter(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

function createApi(overrides: Partial<ProductClient> = {}): ProductClient {
  return {
    listProducts: vi.fn().mockResolvedValue([]),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    setProductStatus: vi.fn(),
    findProductByBarcode: vi.fn(),
    ...overrides,
  };
}

describe("ProductsPage", () => {
  it("keeps products as a list screen with add action and barcode lookup", async () => {
    const api = createApi({
      listProducts: vi.fn().mockResolvedValue([
        {
          id: "product-1",
          warehouseId: "warehouse-a",
          categoryId: null,
          baseUnitId: null,
          sku: "SKU-LOT",
          name: "Hàng theo lô",
          productType: "stock",
          trackingMode: "lot",
          expiryManaged: true,
          fefoEnabled: true,
          status: "active",
          barcodes: ["BC-LOT"],
        },
      ]),
      findProductByBarcode: vi.fn().mockResolvedValue({
        id: "product-1",
        warehouseId: "warehouse-a",
        categoryId: null,
        baseUnitId: null,
        sku: "SKU-LOT",
        name: "Hàng theo lô",
        productType: "stock",
        trackingMode: "lot",
        expiryManaged: true,
        fefoEnabled: true,
        status: "active",
        barcodes: ["BC-LOT"],
      }),
    });
    const user = userEvent.setup();

    renderWithRouter(<ProductsPage api={api} />);

    expect(await screen.findByText("Hàng theo lô")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thêm sản phẩm" })).toHaveAttribute("href", "/products/create");
    expect(screen.queryByLabelText("SKU (*)")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Tra barcode"), "BC-LOT");
    await user.click(screen.getByRole("button", { name: "Tra" }));

    expect(api.findProductByBarcode).toHaveBeenCalledWith("BC-LOT");
    expect(await screen.findByText("Tìm thấy: SKU-LOT - Hàng theo lô")).toBeTruthy();
  });

  it("updates and deactivates a product without immutable fields", async () => {
    const product = { id: "product-1", warehouseId: "warehouse-a", categoryId: null, baseUnitId: null, sku: "SKU-LOT", name: "Hàng theo lô", productType: "stock" as const, trackingMode: "lot" as const, expiryManaged: true, fefoEnabled: true, status: "active" as const, barcodes: ["BC-LOT"] };
    const api = createApi({
      listProducts: vi.fn().mockResolvedValue([product]),
      updateProduct: vi.fn().mockResolvedValue({ ...product, name: "Hàng lô mới", barcodes: ["BC-NEW"], expiryManaged: false, fefoEnabled: false }),
      setProductStatus: vi.fn().mockResolvedValue({ ...product, name: "Hàng lô mới", barcodes: ["BC-NEW"], expiryManaged: false, fefoEnabled: false, status: "inactive" }),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithRouter(<ProductsPage api={api} permissions={["products.view", "products.update", "products.delete"]} />);

    await user.click(await screen.findByRole("button", { name: "Sửa sản phẩm Hàng theo lô" }));
    const name = screen.getByRole("textbox", { name: "Tên sản phẩm Hàng theo lô" });
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.type(name, "Hàng lô mới");
    await user.clear(screen.getByRole("textbox", { name: "Barcode sản phẩm Hàng theo lô" }));
    await user.type(screen.getByRole("textbox", { name: "Barcode sản phẩm Hàng theo lô" }), "BC-NEW");
    await user.click(screen.getByRole("checkbox", { name: "Quản lý hạn dùng Hàng theo lô" }));
    await user.click(screen.getByRole("checkbox", { name: "FEFO Hàng theo lô" }));
    expect(screen.queryByRole("textbox", { name: /SKU/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu sản phẩm Hàng theo lô" }));
    expect(api.updateProduct).toHaveBeenCalledWith("product-1", { name: "Hàng lô mới", barcodes: ["BC-NEW"], expiryManaged: false, fefoEnabled: false });
    expect(await screen.findByText("Hàng lô mới")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Vô hiệu hóa sản phẩm Hàng lô mới" }));
    expect(api.setProductStatus).toHaveBeenCalledWith("product-1", "inactive");
    expect(await screen.findByText("Tạm ngưng")).toBeTruthy();
  });

  it("hides unauthorized product actions and preserves state on conflict", async () => {
    const product = { id: "product-1", warehouseId: "warehouse-a", categoryId: null, baseUnitId: null, sku: "SKU-1", name: "Hàng một", productType: "stock" as const, trackingMode: "none" as const, expiryManaged: false, fefoEnabled: false, status: "active" as const, barcodes: ["BC-1"] };
    const viewApi = createApi({ listProducts: vi.fn().mockResolvedValue([product]) });
    const { unmount } = renderWithRouter(<ProductsPage api={viewApi} permissions={["products.view"]} />);
    expect(await screen.findByText("Hàng một")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sửa sản phẩm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vô hiệu hóa sản phẩm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Thêm sản phẩm" })).not.toBeInTheDocument();
    unmount();

    const errorApi = createApi({ listProducts: vi.fn().mockResolvedValue([product]), updateProduct: vi.fn().mockRejectedValue(new Error("Sản phẩm đã có tồn kho hoặc lịch sử chứng từ")) });
    const user = userEvent.setup();
    renderWithRouter(<ProductsPage api={errorApi} permissions={["products.view", "products.update"]} />);
    await user.click(await screen.findByRole("button", { name: "Sửa sản phẩm Hàng một" }));
    await user.clear(screen.getByRole("textbox", { name: "Tên sản phẩm Hàng một" }));
    await user.type(screen.getByRole("textbox", { name: "Tên sản phẩm Hàng một" }), "Tên không lưu");
    await user.click(screen.getByRole("button", { name: "Lưu sản phẩm Hàng một" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sản phẩm đã có tồn kho hoặc lịch sử chứng từ");
    expect(screen.queryByText("Tên không lưu", { selector: "td" })).not.toBeInTheDocument();
  });

  it("creates a lot-tracked product from a dedicated form screen", async () => {
    const api = createApi({
      createProduct: vi.fn().mockResolvedValue({
        id: "product-1",
        warehouseId: "warehouse-a",
        categoryId: null,
        baseUnitId: null,
        sku: "SKU-LOT",
        name: "Hàng theo lô",
        productType: "stock",
        trackingMode: "lot",
        expiryManaged: true,
        fefoEnabled: true,
        status: "active",
        barcodes: ["BC-LOT", "BC-LOT-2"],
      }),
    });
    const user = userEvent.setup();

    renderWithRouter(<ProductCreatePage api={api} />);

    await user.type(screen.getByLabelText("SKU (*)"), "SKU-LOT");
    await user.type(screen.getByLabelText("Tên sản phẩm (*)"), "Hàng theo lô");
    await user.type(screen.getByLabelText("Barcode (*)"), "BC-LOT, BC-LOT-2");
    await user.selectOptions(screen.getByLabelText("Tracking"), "lot");
    await user.click(screen.getByLabelText("Quản lý hạn dùng"));
    await user.click(screen.getByLabelText("FEFO"));
    await user.click(screen.getByRole("button", { name: "Tạo sản phẩm" }));

    expect(api.createProduct).toHaveBeenCalledWith({
      sku: "SKU-LOT",
      name: "Hàng theo lô",
      productType: "stock",
      trackingMode: "lot",
      expiryManaged: true,
      fefoEnabled: true,
      barcodes: ["BC-LOT", "BC-LOT-2"],
    });
    expect(await screen.findByText("Đã tạo sản phẩm")).toBeTruthy();
  });
});
