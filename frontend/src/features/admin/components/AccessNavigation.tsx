export function AccessNavigation({ permissions }: { permissions: string[] }) {
  if (!permissions.includes("*") && !permissions.includes("admin.access.manage")) {
    return null;
  }
  return <a href="/admin/users" className="rounded-lg px-3 py-2 hover:bg-gray-100">Người dùng</a>;
}
