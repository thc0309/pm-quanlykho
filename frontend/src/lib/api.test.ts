import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

it("uses relative API paths by default", async () => {
  const fetchMock = vi.fn().mockImplementation(() => ok({ user: { id: "u" } }));
  vi.stubGlobal("fetch", fetchMock);
  const { authApi, reportApi } = await import("./api");

  await authApi.login("admin@example.test", "password");

  expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.any(Object));
  expect(reportApi.exportUrl("abc")).toBe("/api/reports/inventory.csv?limit=5000&q=abc");
});

it("uses VITE_API_BASE_URL when configured", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:4000/");
  const fetchMock = vi.fn().mockImplementation(() => ok({ user: { id: "u" } }));
  vi.stubGlobal("fetch", fetchMock);
  const { authApi, reportApi } = await import("./api");

  await authApi.login("admin@example.test", "password");

  expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4000/api/auth/login", expect.any(Object));
  expect(reportApi.exportUrl("abc")).toBe("http://127.0.0.1:4000/api/reports/inventory.csv?limit=5000&q=abc");
});
