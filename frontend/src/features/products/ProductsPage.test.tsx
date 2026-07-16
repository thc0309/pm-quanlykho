import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductClient } from "../../lib/api";
import ProductsPage, { ProductCreatePage } from "./ProductsPage";

afterEach(cleanup);

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
