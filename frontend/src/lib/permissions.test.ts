import { describe, expect, it } from "vitest";

import { hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("accepts only wildcard or the exact granular code", () => {
    expect(hasPermission(["catalog.categories.view"], "catalog.categories.view")).toBe(true);
    expect(hasPermission(["catalog.categories.view"], "catalog.categories.create")).toBe(false);
    expect(hasPermission([["catalog", "manage"].join(".")], "catalog.categories.view")).toBe(false);
    expect(hasPermission(["*"], "admin.users.view")).toBe(true);
  });
});
