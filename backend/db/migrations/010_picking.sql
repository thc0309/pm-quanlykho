ALTER TABLE stock_documents
  ADD COLUMN IF NOT EXISTS picker_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS picker_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS picking_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES stock_documents(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES stock_reservations(id) ON DELETE CASCADE,
  picker_user_id uuid NOT NULL REFERENCES users(id),
  location_barcode text NOT NULL,
  item_barcode text NOT NULL,
  quantity numeric(18, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_picking_scans_document ON picking_scans(document_id, reservation_id);
