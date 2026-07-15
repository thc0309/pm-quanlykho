import { useEffect, useState, type FormEvent } from "react";

import { ApiError, authApi, type AuthClient, type SessionUser } from "../../lib/api";

export default function AuthPage({
  api = authApi,
  onAuthenticated,
}: {
  api?: AuthClient;
  onAuthenticated?: (user: SessionUser | null) => void;
}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.session().then((current) => {
      setUser(current);
      onAuthenticated?.(current);
    }).catch(() => undefined);
  }, [api, onAuthenticated]);

  const message = (cause: unknown) =>
    cause instanceof ApiError ? cause.message : "Không thể kết nối máy chủ";

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const current = await api.login(email.trim(), password);
      setUser(current);
      onAuthenticated?.(current);
      setPassword("");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.changePassword(password);
      setUser((current) => {
        const changed = current ? { ...current, mustChangePassword: false } : current;
        onAuthenticated?.(changed);
        return changed;
      });
      setPassword("");
      setConfirmation("");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api.logout();
      setUser(null);
      onAuthenticated?.(null);
      setEmail("");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900 sm:px-6">
      <section className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-theme-sm sm:p-8">
        <p className="mb-2 text-sm font-semibold text-brand-700">Warehouse Suite</p>
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-700">
            {error}
          </p>
        )}

        {!user && (
          <form onSubmit={login} className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold">Đăng nhập</h1>
              <p className="mt-1 text-sm text-gray-500">Dùng tài khoản do quản trị viên cấp.</p>
            </div>
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-100"
              />
            </label>
            <label className="block text-sm font-medium">
              Mật khẩu
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-100"
              />
            </label>
            <button disabled={busy} className="h-11 w-full rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>
        )}

        {user?.mustChangePassword && (
          <form onSubmit={changePassword} className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold">Đổi mật khẩu tạm</h1>
              <p className="mt-1 text-sm text-gray-500">Mật khẩu mới cần ít nhất 12 ký tự.</p>
            </div>
            <label className="block text-sm font-medium">
              Mật khẩu mới
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-100"
              />
            </label>
            <label className="block text-sm font-medium">
              Nhập lại mật khẩu
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-100"
              />
            </label>
            <button disabled={busy} className="h-11 w-full rounded-lg bg-brand-600 px-4 font-medium text-white disabled:opacity-60">
              {busy ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
            </button>
          </form>
        )}

        {user && !user.mustChangePassword && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold">Đăng nhập thành công</h1>
              <p className="mt-1 text-sm text-gray-500">Xin chào {user.fullName}.</p>
            </div>
            <button onClick={logout} disabled={busy} className="h-11 w-full rounded-lg border border-gray-300 px-4 font-medium hover:bg-gray-50 disabled:opacity-60">
              Đăng xuất
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
