/*
# Create product-files storage bucket

1. Storage
- Create public bucket 'product-files' for uploading product PDFs, files and cover images
- Allow authenticated users to upload/read files
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-files', 'product-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_read_product_files" ON storage.objects;
CREATE POLICY "auth_read_product_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-files');

DROP POLICY IF EXISTS "auth_insert_product_files" ON storage.objects;
CREATE POLICY "auth_insert_product_files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-files');

DROP POLICY IF EXISTS "auth_update_product_files" ON storage.objects;
CREATE POLICY "auth_update_product_files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-files');

DROP POLICY IF EXISTS "auth_delete_product_files" ON storage.objects;
CREATE POLICY "auth_delete_product_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-files');
