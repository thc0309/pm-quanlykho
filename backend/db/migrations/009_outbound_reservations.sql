ALTER TABLE stock_documents
  DROP CONSTRAINT IF EXISTS stock_documents_status_check;

ALTER TABLE stock_documents
  ADD CONSTRAINT stock_documents_status_check CHECK (status IN (
    'draft', 'confirmed', 'cancelled', 'reversed',
    'ready_to_pick', 'picking', 'picked', 'checking', 'needs_repick', 'shipped'
  ));

CREATE TABLE IF NOT EXISTS stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES stock_documents(id) ON DELETE CASCADE,
  document_line_id uuid NOT NULL REFERENCES stock_document_lines(id) ON DELETE CASCADE,
  stock_balance_id uuid NOT NULL REFERENCES stock_balances(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  product_id uuid NOT NULL REFERENCES products(id),
  lot_id uuid REFERENCES lots(id),
  serial_id uuid REFERENCES serials(id),
  quantity numeric(18, 4) NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'picked', 'consumed', 'released')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_available
  ON stock_reservations(warehouse_id, stock_balance_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_document
  ON stock_reservations(document_id, status);

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, permission_code
FROM roles
CROSS JOIN unnest(ARRAY[
  'outbound.release', 'outbound.pick', 'outbound.check',
  'outbound.ship', 'outbound.resolveDiscrepancy'
]) AS permission_code
WHERE code = 'warehouse_admin'
ON CONFLICT DO NOTHING;
