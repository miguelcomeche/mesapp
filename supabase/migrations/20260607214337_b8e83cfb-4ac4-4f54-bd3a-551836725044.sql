
ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS printer_id uuid REFERENCES public.printers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_type text,
  ADD COLUMN IF NOT EXISTS station text,
  ADD COLUMN IF NOT EXISTS payload_json jsonb,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_print timestamptz,
  ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS bridge_token text;
