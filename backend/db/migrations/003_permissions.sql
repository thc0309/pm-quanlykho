CREATE TABLE IF NOT EXISTS role_permission_codes (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL CHECK (permission_code ~ '^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$'),
  PRIMARY KEY (role_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
