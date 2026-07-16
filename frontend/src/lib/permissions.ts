export function hasPermission(permissions: readonly string[], permission: string) {
  return permissions.includes("*") || permissions.includes(permission);
}
