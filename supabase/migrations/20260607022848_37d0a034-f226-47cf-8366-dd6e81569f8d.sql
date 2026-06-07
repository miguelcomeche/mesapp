ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS connection_mode text NOT NULL DEFAULT 'epos_direct',
  ADD COLUMN IF NOT EXISTS bridge_url text;