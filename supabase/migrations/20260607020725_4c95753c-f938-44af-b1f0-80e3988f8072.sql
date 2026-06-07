ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS protocol text NOT NULL DEFAULT 'http',
  ADD COLUMN IF NOT EXISTS endpoint_path text;