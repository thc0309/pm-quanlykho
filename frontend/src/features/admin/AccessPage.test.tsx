import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminClient } from "../../lib/api";
import UsersPage, { AccessNavigation, PermissionsPage, RoleCreatePage, RolesPage, UserCreatePage } from "./AccessPage";

Object.defineProperties(URL, {
  createObjectURL: { configurable: true, value: vi.fn(() => "blob:avatar-preview") },
  revokeObjectURL: { configurable: true, value: vi.fn() },
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
        phone: "0901234567",
        avatarUrl: null,
        employeeCode: null,
        jobTitle: "Nhân viên soạn",
        department: "Vận hành kho",
        note: null,
        kind: "warehouse_user",
        warehouseId: "warehouse-a",
        status: "active",
      },
      temporaryPassword: "temporary-pass",
    }),
    updateUser: vi.fn(),
    uploadUserAvatar: vi.fn().mockResolvedValue({
      id: "user-1",
      email: "picker@example.test",
      fullName: "Picker One",
      phone: "0901234567",
      avatarUrl: "/uploads/avatars/user-1.webp",
      employeeCode: "NV-001",
      jobTitle: null,
      department: "Vận hành kho",
      note: null,
      kind: "warehouse_user",
      warehouseId: "warehouse-a",
      status: "active",
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
    await user.type(screen.getByLabelText("Số điện thoại (*)"), "0901234567");
    await user.type(screen.getByLabelText("Mã nhân viên"), "NV-001");
    await user.type(screen.getByLabelText("Bộ phận"), "Vận hành kho");
    const avatar = new File(["avatar"], "avatar.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Ảnh đại diện"), avatar);
    expect(screen.getByRole("img", { name: "Xem trước ảnh đại diện" })).toHaveAttribute("src", "blob:avatar-preview");
    await user.click(screen.getByRole("button", { name: "Tạo người dùng" }));

    expect(await screen.findByText("temporary-pass")).toBeVisible();
    expect(api.createUser).toHaveBeenCalledWith({
      fullName: "Picker One",
      email: "picker@example.test",
      phone: "0901234567",
      employeeCode: "NV-001",
      department: "Vận hành kho",
    });
    expect(api.uploadUserAvatar).toHaveBeenCalledWith("user-1", avatar);
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
        phone: "0901234567",
        avatarUrl: null,
        employeeCode: null,
        jobTitle: "Nhân viên soạn",
        department: "Vận hành kho",
        note: null,
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
        phone: "0901234567",
        avatarUrl: null,
        employeeCode: null,
        jobTitle: "Nhân viên soạn",
        department: "Vận hành kho",
        note: null,
        kind: "warehouse_user",
        warehouseId: "warehouse-a",
        status: "active",
      },
    ]);

    renderWithRouter(<UsersPage api={api} />);

    expect(await screen.findByText("Picker One")).toBeVisible();
    expect(screen.getByText("0901234567")).toBeVisible();
    expect(screen.getByText("Vận hành kho / Nhân viên soạn")).toBeVisible();
    expect(screen.getByRole("img", { name: "Chưa có ảnh đại diện của Picker One" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Thêm người dùng" })).toHaveAttribute("href", "/admin/users/create");
    expect(screen.queryByLabelText("Họ tên (*)")).not.toBeInTheDocument();
  });

  it("updates user metadata and avatar without reloading the list", async () => {
    const api = client();
    const existing = {
      id: "user-1",
      email: "picker@example.test",
      fullName: "Picker One",
      phone: "0901234567",
      avatarUrl: null,
      employeeCode: "NV-001",
      jobTitle: "Nhân viên soạn",
      department: "Vận hành kho",
      note: null,
      kind: "warehouse_user" as const,
      warehouseId: "warehouse-a",
      status: "active" as const,
    };
    api.listUsers = vi.fn().mockResolvedValue([existing]);
    api.updateUser = vi.fn().mockResolvedValue({ ...existing, phone: "0912345678", note: "Ca sáng" });
    api.uploadUserAvatar = vi.fn().mockResolvedValue({
      ...existing,
      phone: "0912345678",
      note: "Ca sáng",
      avatarUrl: "/uploads/avatars/user-1.webp",
    });
    const user = userEvent.setup();
    renderWithRouter(<UsersPage api={api} />);

    await user.click(await screen.findByRole("button", { name: "Sửa Picker One" }));
    await user.clear(screen.getByLabelText("Số điện thoại (*)"));
    await user.type(screen.getByLabelText("Số điện thoại (*)"), "0912345678");
    await user.type(screen.getByLabelText("Ghi chú"), "Ca sáng");
    const avatar = new File(["avatar"], "avatar.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText("Ảnh đại diện"), avatar);
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(api.updateUser).toHaveBeenCalledWith("user-1", {
      email: "picker@example.test",
      fullName: "Picker One",
      phone: "0912345678",
      employeeCode: "NV-001",
      jobTitle: "Nhân viên soạn",
      department: "Vận hành kho",
      note: "Ca sáng",
    });
    expect(api.uploadUserAvatar).toHaveBeenCalledWith("user-1", avatar);
    expect(await screen.findByText("0912345678")).toBeVisible();
  });

  it("returns focus to the edit button when editing is cancelled", async () => {
    const api = client();
    api.listUsers = vi.fn().mockResolvedValue([(await api.createUser({
      email: "picker@example.test",
      fullName: "Picker One",
      phone: "0901234567",
    })).user]);
    const user = userEvent.setup();
    renderWithRouter(<UsersPage api={api} />);

    const edit = await screen.findByRole("button", { name: "Sửa Picker One" });
    await user.click(edit);
    await user.click(screen.getByRole("button", { name: "Hủy chỉnh sửa" }));
    expect(edit).toHaveFocus();
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
