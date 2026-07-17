import { describe, expect, it } from "vitest";

import { buildNavItems } from "./AppSidebar";

function labels(permissions: string[]) {
  return buildNavItems(permissions).flatMap((item) => [
    item.name,
    ...(item.subItems?.map((subItem) => subItem.name) ?? []),
  ]);
}

describe("buildNavItems", () => {
  it("shows only menu entries backed by the user's view permission", () => {
    const menu = labels(["catalog.categories.view"]);
    expect(menu).toContain("Danh mục");
    expect(menu).not.toContain("Đơn vị");
    expect(menu).not.toContain("Sản phẩm");
    expect(menu).toContain("Danh mục kho");
    expect(menu).not.toContain("Vận hành kho");
  });

  it("maps parent warehouse permissions to child menu entries", () => {
    const menu = labels(["warehouse.metadata.view"]);
    expect(menu).toContain("Danh mục kho");
    expect(menu).toContain("Vị trí kho");
    expect(menu).toContain("Đối tác");
    expect(menu).not.toContain("Vận hành kho");
  });

  it("shows the full menu for master wildcard access", () => {
    const menu = labels(["*"]);
    expect(menu).toContain("Người dùng");
    expect(menu).toContain("Phòng ban");
    expect(menu).toContain("Danh mục kho");
    expect(menu).toContain("Vận hành kho");
    expect(menu).toContain("Kiểm và xuất");
    expect(menu).toContain("Báo cáo");
  });
});
