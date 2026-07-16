-- Forward fix for development databases that already applied migration 019.
DELETE FROM role_permission_codes
WHERE permission_code = 'inventory.update';

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, 'inventory.create'
FROM roles
WHERE code = 'warehouse_admin'
ON CONFLICT DO NOTHING;
