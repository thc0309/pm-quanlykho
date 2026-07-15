ALTER TABLE products
  ADD COLUMN IF NOT EXISTS base_unit_id uuid REFERENCES units(id);

ALTER TABLE product_barcodes
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id) ON DELETE CASCADE;

UPDATE product_barcodes pb
SET warehouse_id = p.warehouse_id
FROM products p
WHERE pb.product_id = p.id AND pb.warehouse_id IS NULL;

ALTER TABLE product_barcodes
  ALTER COLUMN warehouse_id SET NOT NULL;

ALTER TABLE product_barcodes
  DROP CONSTRAINT IF EXISTS product_barcodes_barcode_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_barcodes_warehouse_barcode
  ON product_barcodes(warehouse_id, barcode);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_products_warehouse_sku ON products(warehouse_id, sku);
