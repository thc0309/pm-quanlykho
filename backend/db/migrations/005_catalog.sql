CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  base_unit_id uuid REFERENCES units(id),
  conversion_factor numeric(18, 6) NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, code)
);

CREATE INDEX IF NOT EXISTS idx_categories_warehouse ON categories(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_units_warehouse ON units(warehouse_id);
