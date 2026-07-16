import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminClient } from "../../lib/api";
import UsersPage, { AccessNavigation, PermissionsPage, RoleCreatePage, RolesPage, UserCreatePage } from "./AccessPage";

afterEach(cleanup);

function renderWithRouter(element: ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

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
    renderWithRouter(<RoleCreatePage api={api} />);

    await user.type(await screen.findByLabelText("Mã vai trò (*)"), "Picker Role");
    await user.type(screen.getByLabelText("Tên vai trò (*)"), "Nhân viên soạn");
    expect(screen.getByRole("group", { name: "Quyền (*)" })).toHaveAttribute("aria-required", "true");
    await user.click(screen.getByLabelText("Soạn hàng"));
    await user.click(screen.getByRole("button", { name: "Tạo vai trò" }));

    expect(await screen.findByText("Đã tạo vai trò")).toBeVisible();
    expect(api.createRole).toHaveBeenCalledWith({
      code: "picker-role",
      name: "Nhân viên soạn",
      permissions: ["outbound.pick"],
    });
  });

  it("creates a user and reveals the temporary password once", async () => {
    const api = client();
    const user = userEvent.setup();
    renderWithRouter(<UserCreatePage api={api} />);

    await user.type(await screen.findByLabelText("Họ tên (*)"), "Picker One");
    await user.type(screen.getByLabelText("Email người dùng (*)"), "picker@example.test");
    await user.click(screen.getByRole("button", { name: "Tạo người dùng" }));

    expect(await screen.findByText("temporary-pass")).toBeVisible();
    expect(api.createUser).toHaveBeenCalledWith({
      fullName: "Picker One",
      email: "picker@example.test",
    });
  });

  it("omits access administration navigation when permission is denied", () => {
    const { rerender } = render(<AccessNavigation permissions={["outbound.pick"]} />);
    expect(screen.queryByText("Người dùng")).not.toBeInTheDocument();
    rerender(<AccessNavigation permissions={["admin.access.manage"]} />);
    expect(screen.getByText("Người dùng")).toBeVisible();
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
    renderWithRouter(<UserCreatePage api={api} />);

    await user.selectOptions(await screen.findByLabelText("Người dùng cần gán (*)"), "user-1");
    expect(screen.getByRole("group", { name: "Vai trò được gán (*)" })).toHaveAttribute("aria-required", "true");
    await user.click(screen.getByLabelText("Gán Nhân viên soạn"));
    await user.click(screen.getByRole("button", { name: "Gán vai trò" }));

    expect(api.setUserRoles).toHaveBeenCalledWith("user-1", ["role-1"]);
    expect(await screen.findByText("Đã gán vai trò")).toBeVisible();
  });

  it("keeps the user screen as a list with an add action", async () => {
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

    renderWithRouter(<UsersPage api={api} />);

    expect(await screen.findByText("Picker One")).toBeVisible();
    expect(screen.getByRole("link", { name: "Thêm người dùng" })).toHaveAttribute("href", "/admin/users/create");
    expect(screen.queryByLabelText("Họ tên (*)")).not.toBeInTheDocument();
  });

  it("keeps the role screen as a list with an add action", async () => {
    const api = client();
    api.listRoles = vi.fn().mockResolvedValue([
      {
        id: "role-1",
        warehouseId: "warehouse-a",
        code: "picker",
        name: "Nhân viên soạn",
        permissions: ["outbound.pick"],
      },
    ]);

    renderWithRouter(<RolesPage api={api} />);

    expect(await screen.findByText("Nhân viên soạn")).toBeVisible();
    expect(screen.getByRole("link", { name: "Thêm vai trò" })).toHaveAttribute("href", "/admin/roles/create");
    expect(screen.queryByLabelText("Mã vai trò (*)")).not.toBeInTheDocument();
  });

  it("shows the permission catalog", () => {
    render(<PermissionsPage />);

    expect(screen.getByRole("heading", { name: "Permission" })).toBeVisible();
    expect(screen.getByText("outbound.pick")).toBeVisible();
  });
});
