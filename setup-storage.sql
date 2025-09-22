-- Run this in Supabase SQL Editor to create storage buckets
-- Only run if you haven't created storage buckets yet

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('datasets', 'datasets', false),
  ('annotated-files', 'annotated-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for datasets bucket
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for annotated-files bucket
CREATE POLICY "Users can view their annotated files" ON storage.objects
  FOR SELECT USING (bucket_id = 'annotated-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service can upload annotated files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'annotated-files');