ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS last_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_printed_at timestamptz;