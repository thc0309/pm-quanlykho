ALTER TABLE stock_document_lines
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

CREATE INDEX IF NOT EXISTS idx_stock_document_lines_document
  ON stock_document_lines(document_id);
