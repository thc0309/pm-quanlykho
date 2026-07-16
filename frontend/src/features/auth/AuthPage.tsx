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
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900 dark:bg-gray-900 dark:text-white/90 sm:px-6">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark sm:p-8">
        <p className="mb-2 text-sm font-semibold text-brand-700 dark:text-brand-400" translate="no">Warehouse Suite</p>
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
            {error}
          </p>
        )}

        {!user && (
          <form onSubmit={login} className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Đăng nhập</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Dùng tài khoản do quản trị viên cấp.</p>
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">
              Email (*)
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                spellCheck={false}
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">
              Mật khẩu (*)
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800"
              />
            </label>
            <button disabled={busy} className="h-11 w-full rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>
        )}

        {user?.mustChangePassword && (
          <form onSubmit={changePassword} className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Đổi mật khẩu tạm</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Mật khẩu mới cần ít nhất 12 ký tự.</p>
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">
              Mật khẩu mới (*)
              <input
                name="new-password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">
              Nhập lại mật khẩu (*)
              <input
                name="confirm-password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800"
              />
            </label>
            <button disabled={busy} className="h-11 w-full rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:opacity-60">
              {busy ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
            </button>
          </form>
        )}

        {user && !user.mustChangePassword && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Đăng nhập thành công</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Xin chào {user.fullName}.</p>
            </div>
            <button onClick={logout} disabled={busy} className="h-11 w-full rounded-lg border border-gray-300 px-4 font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
              Đăng xuất
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
