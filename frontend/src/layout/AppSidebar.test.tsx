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
  });

  it("shows the full menu for master wildcard access", () => {
    const menu = labels(["*"]);
    expect(menu).toContain("Người dùng");
    expect(menu).toContain("Kiểm và xuất");
    expect(menu).toContain("Báo cáo");
  });
});
