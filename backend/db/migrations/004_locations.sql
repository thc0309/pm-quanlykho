CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code text NOT NULL,
  barcode text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('storage', 'staging', 'shipping')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, code),
  UNIQUE (warehouse_id, barcode)
);
