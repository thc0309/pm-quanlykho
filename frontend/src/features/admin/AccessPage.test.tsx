import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminClient } from "../../lib/api";
import AccessPage, { AccessNavigation } from "./AccessPage";

afterEach(cleanup);

function client(): AdminClient {
  return {
    listUsers: vi.fn().mockResolvedValue([]),
    createUser: vi.fn().mockResolvedValue({
      user: {
        id: "user-1",
        email: "picker@example.test",
        fullName: "Picker One",
        kind: "warehouse_user",
        warehouseId: "warehouse-a",
        status: "active",
      },
      temporaryPassword: "temporary-pass",
    }),
    setUserStatus: vi.fn(),
    listRoles: vi.fn().mockResolvedValue([]),
    createRole: vi.fn().mockResolvedValue({
      id: "role-1",
      warehouseId: "warehouse-a",
      code: "picker",
      name: "Nhân viên soạn",
      permissions: ["outbound.pick"],
    }),
    setUserRoles: vi.fn(),
  };
}

describe("AccessPage", () => {
  it("creates a picker role and displays it", async () => {
    const api = client();
    const user = userEvent.setup();
    render(<AccessPage api={api} />);

    await user.type(await screen.findByLabelText("Mã role"), "picker");
    await user.type(screen.getByLabelText("Tên role"), "Nhân viên soạn");
    await user.click(screen.getByLabelText("Soạn hàng"));
    await user.click(screen.getByRole("button", { name: "Tạo role" }));

    expect(await screen.findByText("Nhân viên soạn")).toBeVisible();
    expect(api.createRole).toHaveBeenCalledWith({
      code: "picker",
      name: "Nhân viên soạn",
      permissions: ["outbound.pick"],
    });
  });

  it("creates a user and reveals the temporary password once", async () => {
    const api = client();
    const user = userEvent.setup();
    render(<AccessPage api={api} />);

    await user.type(await screen.findByLabelText("Họ tên"), "Picker One");
    await user.type(screen.getByLabelText("Email người dùng"), "picker@example.test");
    await user.click(screen.getByRole("button", { name: "Tạo người dùng" }));

    expect(await screen.findByText("temporary-pass")).toBeVisible();
    expect(api.createUser).toHaveBeenCalledWith({
      fullName: "Picker One",
      email: "picker@example.test",
    });
  });

  it("omits access administration navigation when permission is denied", () => {
    const { rerender } = render(<AccessNavigation permissions={["outbound.pick"]} />);
    expect(screen.queryByText("Người dùng & role")).not.toBeInTheDocument();
    rerender(<AccessNavigation permissions={["admin.access.manage"]} />);
    expect(screen.getByText("Người dùng & role")).toBeVisible();
  });

  it("assigns warehouse roles to a user", async () => {
    const api = client();
    api.listUsers = vi.fn().mockResolvedValue([
      {
        id: "user-1",
        email: "picker@example.test",
        fullName: "Picker One",
        kind: "warehouse_user",
        warehouseId: "warehouse-a",
        status: "active",
      },
    ]);
    api.listRoles = vi.fn().mockResolvedValue([
      {
        id: "role-1",
        warehouseId: "warehouse-a",
        code: "picker",
        name: "Nhân viên soạn",
        permissions: ["outbound.pick"],
      },
    ]);
    const user = userEvent.setup();
    render(<AccessPage api={api} />);

    await user.selectOptions(await screen.findByLabelText("Người dùng cần gán"), "user-1");
    await user.click(screen.getByLabelText("Gán Nhân viên soạn"));
    await user.click(screen.getByRole("button", { name: "Gán role" }));

    expect(api.setUserRoles).toHaveBeenCalledWith("user-1", ["role-1"]);
    expect(await screen.findByText("Đã gán role")).toBeVisible();
  });
});
