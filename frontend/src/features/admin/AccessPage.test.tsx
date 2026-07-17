import "@testing-library/jest-dom/vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, type AdminClient, type AdminUser } from "../../lib/api";
import UsersPage, { AccessNavigation, DepartmentCreatePage, DepartmentsPage, PermissionsPage, RoleCreatePage, RolesPage, UserCreatePage } from "./AccessPage";

Object.defineProperties(URL, {
  createObjectURL: { configurable: true, value: vi.fn(() => "blob:avatar-preview") },
  revokeObjectURL: { configurable: true, value: vi.fn() },
});

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
      </Routes>
    </MemoryRouter>,
  );
}

function userRecord(overrides: Partial<AdminUser> = {}) {
  return {
    id: "user-1",
    email: "picker@example.test",
    fullName: "Picker One",
    phone: "0901234567",
    roleIds: [],
    departmentId: "department-1",
    avatarUrl: null,
    employeeCode: null,
    jobTitle: "Nhân viên soạn",
    department: "Vận hành kho",
    note: null,
    kind: "warehouse_user" as const,
    warehouseId: "warehouse-a",
    status: "active" as const,
    ...overrides,
  };
}

function client(): AdminClient {
  return {
    listUsers: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue(userRecord({ employeeCode: "NV-001" })),
    listDepartments: vi.fn().mockResolvedValue([
      { id: "department-1", warehouseId: "warehouse-a", code: "van-hanh-kho", name: "Vận hành kho", roleIds: ["role-1"], status: "active" },
    ]),
    getDepartment: vi.fn().mockResolvedValue({
      id: "department-1",
      warehouseId: "warehouse-a",
      code: "van-hanh-kho",
      name: "Vận hành kho",
      roleIds: ["role-1"],
      status: "active",
    }),
    createUser: vi.fn().mockResolvedValue({
      user: userRecord(),
      temporaryPassword: "temporary-pass",
    }),
    updateUser: vi.fn(),
    uploadUserAvatar: vi.fn().mockResolvedValue({
      ...userRecord(),
      avatarUrl: "/uploads/avatars/user-1.webp",
      employeeCode: "NV-001",
    }),
    setUserStatus: vi.fn(),
    createDepartment: vi.fn().mockResolvedValue({
      id: "department-2",
      warehouseId: "warehouse-a",
      code: "ban-hang",
      name: "Bán hàng",
      roleIds: ["role-1"],
      status: "active",
    }),
    updateDepartment: vi.fn(),
    setDepartmentStatus: vi.fn(),
    listRoles: vi.fn().mockResolvedValue([]),
    getRole: vi.fn().mockResolvedValue({
      id: "role-1",
      warehouseId: "warehouse-a",
      code: "picker",
      name: "Nhân viên soạn",
      permissions: ["picking.update"],
    }),
    listPermissionCatalog: vi.fn().mockResolvedValue([
      {
        featureCode: "warehouse.metadata",
        featureLabel: "Danh mục kho",
        actions: [
          { action: "view", label: "Xem", code: "warehouse.metadata.view" },
          { action: "create", label: "Thêm", code: "warehouse.metadata.create" },
          { action: "update", label: "Sửa", code: "warehouse.metadata.update" },
          { action: "delete", label: "Vô hiệu hóa", code: "warehouse.metadata.delete" },
        ],
      },
      {
        featureCode: "picking",
        featureLabel: "Soạn hàng",
        actions: [
          { action: "view", label: "Xem", code: "picking.view" },
          { action: "update", label: "Sửa", code: "picking.update" },
          { action: "approve", label: "Duyệt", code: "picking.approve" },
        ],
      },
      {
        featureCode: "reports",
        featureLabel: "Báo cáo",
        actions: [
          { action: "view", label: "Xem", code: "reports.view" },
          { action: "export", label: "Xuất file", code: "reports.export" },
        ],
      },
    ]),
    createRole: vi.fn().mockResolvedValue({
      id: "role-1",
      warehouseId: "warehouse-a",
      code: "picker",
      name: "Nhân viên soạn",
      permissions: ["picking.update"],
    }),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
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
    expect(await screen.findByRole("table", { name: "Ma trận quyền" })).toBeVisible();
    await user.click(screen.getByLabelText("Soạn hàng — Sửa"));
    await user.click(screen.getByRole("button", { name: "Tạo vai trò" }));

    expect(await screen.findByText("Đã tạo vai trò")).toBeVisible();
    expect(api.createRole).toHaveBeenCalledWith({
      code: "picker-role",
      name: "Nhân viên soạn",
      permissions: ["picking.update"],
    });
  });

  it("selects all valid permissions and exposes the indeterminate state", async () => {
    const api = client();
    const user = userEvent.setup();
    renderWithRouter(<RoleCreatePage api={api} />);

    const all = await screen.findByLabelText("Chọn tất cả quyền");
    await user.click(all);
    expect(screen.getByLabelText("Soạn hàng — Xem")).toBeChecked();
    expect(screen.getByLabelText("Báo cáo — Xuất file")).toBeChecked();
    expect(screen.queryByLabelText("Báo cáo — Sửa")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Báo cáo — Xuất file"));
    expect(all).toHaveProperty("indeterminate", true);
  });

  it("selects a permission row and submits unique applicable codes", async () => {
    const api = client();
    const user = userEvent.setup();
    renderWithRouter(<RoleCreatePage api={api} />);

    await user.type(await screen.findByLabelText("Mã vai trò (*)"), "picker");
    await user.type(screen.getByLabelText("Tên vai trò (*)"), "Nhân viên soạn");
    const row = screen.getByLabelText("Chọn tất cả Soạn hàng");
    await user.click(row);
    expect(screen.getByLabelText("Soạn hàng — Duyệt")).toBeChecked();
    await user.click(screen.getByLabelText("Soạn hàng — Xem"));
    expect(row).toHaveProperty("indeterminate", true);
    await user.click(screen.getByRole("button", { name: "Tạo vai trò" }));

    expect(api.createRole).toHaveBeenCalledWith({
      code: "picker",
      name: "Nhân viên soạn",
      permissions: ["picking.update", "picking.approve"],
    });
  });

  it("creates a user and reveals the temporary password once", async () => {
    const api = client();
    const user = userEvent.setup();
    renderWithRoute("/admin/users/create", "/admin/users/create", <UserCreatePage api={api} />);

    await user.type(await screen.findByLabelText("Họ tên (*)"), "Picker One");
    await user.type(screen.getByLabelText("Email người dùng (*)"), "picker@example.test");
    await user.type(screen.getByLabelText("Số điện thoại (*)"), "0901234567");
    await user.type(screen.getByLabelText("Mã nhân viên"), "NV-001");
    await user.selectOptions(screen.getByLabelText("Phòng ban (*)"), "department-1");
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
      departmentId: "department-1",
    });
    expect(api.uploadUserAvatar).toHaveBeenCalledWith("user-1", avatar);
  });

  it("omits access administration navigation when permission is denied", () => {
    const { rerender } = render(<AccessNavigation permissions={["picking.view"]} />);
    expect(screen.queryByText("Người dùng")).not.toBeInTheDocument();
    rerender(<AccessNavigation permissions={["admin.users.view"]} />);
    expect(screen.getByText("Người dùng")).toBeVisible();
  });

  it("keeps the user screen as a list with create and edit routes", async () => {
    const api = client();
    api.listUsers = vi.fn().mockResolvedValue([userRecord()]);

    renderWithRouter(<UsersPage api={api} />);

    expect(await screen.findByText("Picker One")).toBeVisible();
    expect(screen.getByText("0901234567")).toBeVisible();
    expect(screen.getByText("Vận hành kho / Nhân viên soạn")).toBeVisible();
    expect(screen.getByRole("img", { name: "Chưa có ảnh đại diện của Picker One" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Thêm người dùng" })).toHaveAttribute("href", "/admin/users/create");
    expect(screen.getByRole("link", { name: "Sửa Picker One" })).toHaveAttribute("href", "/admin/users/user-1/edit");
  });

  it("updates user metadata, avatar and department on the shared edit route", async () => {
    const api = client();
    const existing = userRecord({ roleIds: ["role-1"], employeeCode: "NV-001" });
    api.listUsers = vi.fn().mockResolvedValue([existing]);
    api.updateUser = vi.fn().mockResolvedValue({ ...existing, departmentId: "department-2", department: "Bán hàng", phone: "0912345678", note: "Ca sáng" });
    api.uploadUserAvatar = vi.fn().mockResolvedValue({
      ...existing,
      departmentId: "department-2",
      department: "Bán hàng",
      phone: "0912345678",
      note: "Ca sáng",
      avatarUrl: "/uploads/avatars/user-1.webp",
    });
    api.listDepartments = vi.fn().mockResolvedValue([
      { id: "department-1", warehouseId: "warehouse-a", code: "van-hanh-kho", name: "Vận hành kho", roleIds: ["role-1"], status: "active" },
      { id: "department-2", warehouseId: "warehouse-a", code: "ban-hang", name: "Bán hàng", roleIds: ["role-2"], status: "active" },
    ]);
    const user = userEvent.setup();
    renderWithRoute("/admin/users/user-1/edit", "/admin/users/:userId/edit", <UserCreatePage api={api} />);

    expect(await screen.findByDisplayValue("Picker One")).toBeVisible();
    expect(screen.getByLabelText("Phòng ban (*)")).toHaveValue("department-1");
    await user.clear(screen.getByLabelText("Số điện thoại (*)"));
    await user.type(screen.getByLabelText("Số điện thoại (*)"), "0912345678");
    await user.type(screen.getByLabelText("Ghi chú"), "Ca sáng");
    await user.selectOptions(screen.getByLabelText("Phòng ban (*)"), "department-2");
    const avatar = new File(["avatar"], "avatar.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText("Ảnh đại diện"), avatar);
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(api.updateUser).toHaveBeenCalledWith("user-1", {
      email: "picker@example.test",
      fullName: "Picker One",
      phone: "0912345678",
      employeeCode: "NV-001",
      jobTitle: "Nhân viên soạn",
      departmentId: "department-2",
      note: "Ca sáng",
    });
    expect(api.uploadUserAvatar).toHaveBeenCalledWith("user-1", avatar);
  });

  it("keeps the role screen as a list with an add action", async () => {
    const api = client();
    api.listRoles = vi.fn().mockResolvedValue([
      {
        id: "role-1",
        warehouseId: "warehouse-a",
        code: "picker",
        name: "Nhân viên soạn",
        permissions: ["picking.view"],
      },
    ]);

    renderWithRouter(<RolesPage api={api} />);

    expect(await screen.findByText("Nhân viên soạn")).toBeVisible();
    expect(screen.getByRole("link", { name: "Thêm vai trò" })).toHaveAttribute("href", "/admin/roles/create");
    expect(screen.queryByLabelText("Mã vai trò (*)")).not.toBeInTheDocument();
  });

  it("keeps the department screen as a list with an add action", async () => {
    const api = client();
    api.listRoles = vi.fn().mockResolvedValue([
      { id: "role-1", warehouseId: "warehouse-a", code: "picker", name: "Nhân viên soạn", permissions: ["picking.view"] },
    ]);
    renderWithRouter(<DepartmentsPage api={api} />);

    expect(await screen.findByText("Vận hành kho")).toBeVisible();
    expect(screen.getByText("Nhân viên soạn")).toBeVisible();
    expect(screen.getByRole("link", { name: "Thêm phòng ban" })).toHaveAttribute("href", "/admin/departments/create");
    expect(screen.getByRole("link", { name: "Sửa phòng ban Vận hành kho" })).toHaveAttribute("href", "/admin/departments/department-1/edit");
  });

  it("creates a department with many roles", async () => {
    const api = client();
    api.listRoles = vi.fn().mockResolvedValue([
      { id: "role-1", warehouseId: "warehouse-a", code: "picker", name: "Nhân viên soạn", permissions: ["picking.view"] },
      { id: "role-2", warehouseId: "warehouse-a", code: "checker", name: "Nhân viên kiểm", permissions: ["checking.view"] },
    ]);
    const user = userEvent.setup();
    renderWithRoute("/admin/departments/create", "/admin/departments/create", <DepartmentCreatePage api={api} />);

    await user.type(await screen.findByLabelText("Mã phòng ban (*)"), "Bán hàng");
    await user.type(screen.getByLabelText("Tên phòng ban (*)"), "Bán hàng");
    await user.click(screen.getByLabelText("Nhân viên soạn"));
    await user.click(screen.getByLabelText("Nhân viên kiểm"));
    await user.click(screen.getByRole("button", { name: "Tạo phòng ban" }));

    expect(api.createDepartment).toHaveBeenCalledWith({
      code: "ban-hang",
      name: "Bán hàng",
      roleIds: ["role-1", "role-2"],
    });
  });

  it("updates a department on the shared edit route", async () => {
    const api = client();
    api.listRoles = vi.fn().mockResolvedValue([
      { id: "role-1", warehouseId: "warehouse-a", code: "picker", name: "Nhân viên soạn", permissions: ["picking.view"] },
      { id: "role-2", warehouseId: "warehouse-a", code: "checker", name: "Nhân viên kiểm", permissions: ["checking.view"] },
    ]);
    api.listDepartments = vi.fn().mockResolvedValue([
      { id: "department-1", warehouseId: "warehouse-a", code: "van-hanh-kho", name: "Vận hành kho", roleIds: ["role-1"], status: "active" },
    ]);
    api.updateDepartment = vi.fn().mockResolvedValue({
      id: "department-1",
      warehouseId: "warehouse-a",
      code: "van-hanh-kho",
      name: "Vận hành mới",
      roleIds: ["role-1", "role-2"],
      status: "active",
    });
    const user = userEvent.setup();
    renderWithRoute("/admin/departments/department-1/edit", "/admin/departments/:departmentId/edit", <DepartmentCreatePage api={api} />);

    expect(await screen.findByDisplayValue("Vận hành kho")).toBeVisible();
    await user.clear(screen.getByLabelText("Tên phòng ban (*)"));
    await user.type(screen.getByLabelText("Tên phòng ban (*)"), "Vận hành mới");
    await user.click(screen.getByLabelText("Nhân viên kiểm"));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(api.updateDepartment).toHaveBeenCalledWith("department-1", {
      name: "Vận hành mới",
      roleIds: ["role-1", "role-2"],
    });
  });

  it("prefills and updates the role permission matrix on the shared edit route", async () => {
    const api = client();
    const role = { id: "role-1", warehouseId: "warehouse-a", code: "picker", name: "Nhân viên soạn", permissions: ["picking.view"] };
    api.listRoles = vi.fn().mockResolvedValue([role]);
    api.getRole = vi.fn().mockResolvedValue(role);
    api.updateRole = vi.fn().mockResolvedValue({ ...role, name: "Nhân viên soạn mới", permissions: ["picking.view", "picking.update"] });
    const user = userEvent.setup();
    renderWithRoute("/admin/roles/role-1/edit", "/admin/roles/:roleId/edit", <RoleCreatePage api={api} />);

    expect(await screen.findByDisplayValue("Nhân viên soạn")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Soạn hàng — Xem" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Soạn hàng — Sửa" })).not.toBeChecked();
    const name = screen.getByLabelText("Tên vai trò (*)");
    await user.click(screen.getByRole("checkbox", { name: "Soạn hàng — Sửa" }));
    await user.clear(name);
    await user.type(name, "Nhân viên soạn mới");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(api.updateRole).toHaveBeenCalledWith("role-1", { name: "Nhân viên soạn mới", permissions: ["picking.view", "picking.update"] });
  });

  it("deletes an unused role and keeps an assigned role on conflict", async () => {
    const api = client();
    const unused = { id: "role-unused", warehouseId: "warehouse-a", code: "unused", name: "Vai trò chưa dùng", permissions: ["reports.view"] };
    const assigned = { id: "role-assigned", warehouseId: "warehouse-a", code: "assigned", name: "Vai trò đã gán", permissions: ["picking.view"] };
    api.listRoles = vi.fn().mockResolvedValue([unused, assigned]);
    api.deleteRole = vi.fn().mockImplementation(async (id) => {
      if (id === assigned.id) throw new ApiError(409, "ROLE_ASSIGNED", "Vai trò đã được gán cho phòng ban hoặc người dùng nên không thể xóa");
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithRouter(<RolesPage api={api} permissions={["admin.roles.view", "admin.roles.delete"]} />);

    await user.click(await screen.findByRole("button", { name: "Xóa vai trò Vai trò chưa dùng" }));
    expect(api.deleteRole).toHaveBeenCalledWith("role-unused");
    expect(screen.queryByText("Vai trò chưa dùng")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa vai trò Vai trò đã gán" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vai trò đã được gán cho phòng ban hoặc người dùng nên không thể xóa");
    expect(screen.getByText("Vai trò đã gán")).toBeVisible();
  });

  it("hides unauthorized role actions", async () => {
    const api = client();
    api.listRoles = vi.fn().mockResolvedValue([{ id: "role-1", warehouseId: "warehouse-a", code: "picker", name: "Nhân viên soạn", permissions: ["picking.view"] }]);
    renderWithRouter(<RolesPage api={api} permissions={["admin.roles.view"]} />);
    expect(await screen.findByText("Nhân viên soạn")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Sửa vai trò/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xóa vai trò/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Thêm vai trò" })).not.toBeInTheDocument();
  });

  it("shows the permission catalog", async () => {
    const api = client();
    render(<PermissionsPage api={api} />);

    expect(screen.getByRole("heading", { name: "Quyền hạn" })).toBeVisible();
    expect(await screen.findByText("warehouse.metadata.view")).toBeVisible();
    expect(await screen.findByText("picking.view")).toBeVisible();
  });
});
