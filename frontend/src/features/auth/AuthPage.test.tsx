import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, type AuthClient, type SessionUser } from "../../lib/api";
import AuthPage from "./AuthPage";

const master: SessionUser = {
  id: "master-1",
  email: "master@example.test",
  fullName: "Master Admin",
  kind: "master_admin",
  warehouseId: null,
  mustChangePassword: true,
  status: "active",
};

afterEach(cleanup);

function client(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    session: vi.fn().mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "")),
    login: vi.fn().mockResolvedValue(master),
    changePassword: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("AuthPage", () => {
  it("logs in and requires changing a temporary password", async () => {
    const api = client();
    const user = userEvent.setup();
    render(<AuthPage api={api} />);

    await user.type(screen.getByLabelText("Email"), "master@example.test");
    await user.type(screen.getByLabelText("Mật khẩu"), "temporary-password");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("heading", { name: "Đổi mật khẩu tạm" })).toBeVisible();
    expect(api.login).toHaveBeenCalledWith("master@example.test", "temporary-password");
  });

  it("changes the temporary password and logs out", async () => {
    const api = client({ session: vi.fn().mockResolvedValue(master) });
    const user = userEvent.setup();
    render(<AuthPage api={api} />);

    await user.type(await screen.findByLabelText("Mật khẩu mới"), "new-secure-password");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu"), "new-secure-password");
    await user.click(screen.getByRole("button", { name: "Cập nhật mật khẩu" }));
    expect(await screen.findByText("Đăng nhập thành công")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(await screen.findByRole("button", { name: "Đăng nhập" })).toBeVisible();
    expect(api.logout).toHaveBeenCalledOnce();
  });

  it("shows a useful login error", async () => {
    const api = client({
      login: vi.fn().mockRejectedValue(
        new ApiError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng"),
      ),
    });
    const user = userEvent.setup();
    render(<AuthPage api={api} />);

    await user.type(screen.getByLabelText("Email"), "master@example.test");
    await user.type(screen.getByLabelText("Mật khẩu"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email hoặc mật khẩu không đúng");
  });
});
