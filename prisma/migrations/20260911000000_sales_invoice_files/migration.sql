-- Optional PDF/XML files on sales invoices
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "pdf_pathname" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "pdf_file_name" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "pdf_content_type" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "pdf_size_bytes" INTEGER;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "xml_pathname" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "xml_file_name" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "xml_url" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "xml_content_type" TEXT;
ALTER TABLE "sales_invoices" ADD COLUMN IF NOT EXISTS "xml_size_bytes" INTEGER;
