const permissionFeatureGroups = {
  "warehouse.metadata": ["locations", "catalog.categories", "catalog.units", "products", "partners"],
  "warehouse.operations": [
    "receipts",
    "outbounds",
    "picking",
    "checking",
    "outbound.exceptions",
    "purchasing",
    "sales",
    "returns",
    "stockCounts",
    "transfers",
    "inventory",
    "reports",
    "print",
  ],
} as const satisfies Record<string, readonly string[]>;

function permissionImplies(granted: string, required: string) {
  if (granted === "*" || granted === required) return true;
  const delimiter = granted.lastIndexOf(".");
  if (delimiter < 0) return false;
  const feature = granted.slice(0, delimiter);
  const action = granted.slice(delimiter + 1);
  const children = permissionFeatureGroups[feature as keyof typeof permissionFeatureGroups];
  return Boolean(children?.some((child) => `${child}.${action}` === required));
}

export function hasPermission(permissions: readonly string[], permission: string) {
  return permissions.some((granted) => permissionImplies(granted, permission));
}
