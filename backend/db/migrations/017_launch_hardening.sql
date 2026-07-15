CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_one_invoice_per_order
  ON sales_documents(source_document_id)
  WHERE kind = 'invoice' AND source_document_id IS NOT NULL;
