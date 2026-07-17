CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS department_roles (
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (department_id, role_id)
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id);

CREATE INDEX IF NOT EXISTS idx_departments_warehouse ON departments (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_department_roles_department ON department_roles (department_id);
CREATE INDEX IF NOT EXISTS idx_department_roles_role ON department_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users (department_id);

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT r.id, permission_code
FROM roles r
CROSS JOIN unnest(ARRAY[
  'admin.departments.view',
  'admin.departments.create',
  'admin.departments.update',
  'admin.departments.delete'
]) AS permission_code
WHERE r.code = 'warehouse_admin'
ON CONFLICT DO NOTHING;
