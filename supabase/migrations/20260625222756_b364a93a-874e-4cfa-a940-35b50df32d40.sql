ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS content jsonb;

ALTER TABLE public.print_jobs
  ALTER COLUMN type DROP NOT NULL,
  ALTER COLUMN data DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_print_jobs_destination_status
  ON public.print_jobs (destination, status, created_at DESC);

GRANT SELECT, INSERT ON public.print_jobs TO authenticated;