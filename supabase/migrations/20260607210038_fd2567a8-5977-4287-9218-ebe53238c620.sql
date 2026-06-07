CREATE TABLE IF NOT EXISTS public.print_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  restaurant_id uuid NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  data jsonb NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_print_jobs" ON public.print_jobs
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_print_jobs" ON public.print_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS print_jobs_restaurant_status_idx
  ON public.print_jobs (restaurant_id, status, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;