-- Recovery (development only): this migration intentionally resets every role.
-- Rerun the seed command after migration to restore configured development users.
DELETE FROM roles;

INSERT INTO roles (warehouse_id, code, name)
SELECT id, 'warehouse_admin', 'Quản trị kho'
FROM warehouses;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT role.id, permission_code
FROM roles role
CROSS JOIN unnest(ARRAY[
  'admin.users.view', 'admin.users.create', 'admin.users.update', 'admin.users.delete',
  'admin.roles.view', 'admin.roles.create', 'admin.roles.update', 'admin.roles.delete',
  'locations.view', 'locations.create', 'locations.update', 'locations.delete',
  'catalog.categories.view', 'catalog.categories.create', 'catalog.categories.update', 'catalog.categories.delete',
  'catalog.units.view', 'catalog.units.create', 'catalog.units.update', 'catalog.units.delete',
  'products.view', 'products.create', 'products.update', 'products.delete',
  'partners.view', 'partners.create', 'partners.update', 'partners.delete',
  'receipts.view', 'receipts.create', 'receipts.approve', 'receipts.print',
  'outbounds.view', 'outbounds.create', 'outbounds.approve', 'outbounds.print',
  'picking.view', 'picking.update', 'picking.approve',
  'checking.view', 'checking.update', 'checking.approve',
  'outbound.exceptions.view', 'outbound.exceptions.update', 'outbound.exceptions.approve',
  'purchasing.view', 'purchasing.create', 'purchasing.update', 'purchasing.approve',
  'sales.view', 'sales.create', 'sales.update', 'sales.approve',
  'returns.view', 'returns.create', 'returns.approve',
  'stockCounts.view', 'stockCounts.create', 'stockCounts.update', 'stockCounts.approve',
  'transfers.view', 'transfers.create', 'transfers.update', 'transfers.approve',
  'inventory.view', 'inventory.update',
  'reports.view', 'reports.export',
  'print.print'
]) AS permission_code
WHERE role.code = 'warehouse_admin';

INSERT INTO user_roles (user_id, role_id)
SELECT users.id, roles.id
FROM users
JOIN roles ON roles.warehouse_id = users.warehouse_id AND roles.code = 'warehouse_admin'
WHERE users.kind = 'warehouse_admin';
