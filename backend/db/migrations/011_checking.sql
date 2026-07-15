ALTER TABLE stock_documents
  ADD COLUMN IF NOT EXISTS checker_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS checker_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

CREATE TABLE IF NOT EXISTS checking_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES stock_documents(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES stock_reservations(id) ON DELETE CASCADE,
  checker_user_id uuid NOT NULL REFERENCES users(id), location_barcode text NOT NULL, item_barcode text NOT NULL,
  quantity numeric(18,4) NOT NULL DEFAULT 1 CHECK(quantity>0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checking_scans_document ON checking_scans(document_id,reservation_id);

CREATE TABLE IF NOT EXISTS shipment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES stock_documents(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(document_id,idempotency_key)
);
