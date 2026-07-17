CREATE TABLE IF NOT EXISTS category_spec_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'number', 'boolean', 'select')),
  required boolean NOT NULL DEFAULT false,
  unit text,
  min_value numeric(18, 4),
  max_value numeric(18, 4),
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, code),
  CHECK (
    type = 'number'
    OR (unit IS NULL AND min_value IS NULL AND max_value IS NULL)
  ),
  CHECK (
    min_value IS NULL OR max_value IS NULL OR min_value <= max_value
  )
);

CREATE TABLE IF NOT EXISTS category_spec_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES category_spec_definitions(id) ON DELETE CASCADE,
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, value)
);

CREATE TABLE IF NOT EXISTS product_spec_values (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES category_spec_definitions(id) ON DELETE RESTRICT,
  text_value text,
  number_value numeric(18, 4),
  boolean_value boolean,
  option_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, definition_id),
  CHECK (num_nonnulls(text_value, number_value, boolean_value, option_value) = 1)
);

CREATE INDEX IF NOT EXISTS idx_category_spec_definitions_category
  ON category_spec_definitions (category_id, status, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_category_spec_options_definition
  ON category_spec_options (definition_id, status, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_product_spec_values_definition
  ON product_spec_values (definition_id);

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT r.id, permission_code
FROM roles r
CROSS JOIN unnest(ARRAY[
  'catalog.specs.view',
  'catalog.specs.create',
  'catalog.specs.update',
  'catalog.specs.delete'
]) AS permission_code
WHERE r.code = 'warehouse_admin'
ON CONFLICT DO NOTHING;
