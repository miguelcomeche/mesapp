DROP POLICY IF EXISTS "auth_all_print_jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "anon_all_print_jobs" ON public.print_jobs;
CREATE POLICY "Members manage their restaurant print jobs" ON public.print_jobs
  FOR ALL TO authenticated
  USING (public.can_access_restaurant(restaurant_id))
  WITH CHECK (public.can_access_restaurant(restaurant_id));