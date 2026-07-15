ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

CREATE TABLE IF NOT EXISTS stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id),
  product_id uuid NOT NULL REFERENCES products(id),
  lot_id uuid REFERENCES lots(id),
  serial_id uuid REFERENCES serials(id),
  on_hand numeric(18, 4) NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_balances_key
  ON stock_balances(warehouse_id, location_id, product_id, lot_id, serial_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_stock_balances_product
  ON stock_balances(warehouse_id, product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_location_product
  ON stock_movements(warehouse_id, location_id, product_id);
