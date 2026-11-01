DROP POLICY IF EXISTS "anon_read_kitchen_tickets" ON public.kitchen_tickets;
DROP POLICY IF EXISTS "anon_read_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "anon_read_order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon_read_ticket_items" ON public.ticket_items;
DROP POLICY IF EXISTS "anon_read_printers" ON public.printers;
DROP POLICY IF EXISTS "anon_read_table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "anon_read_tables" ON public.tables;
DROP POLICY IF EXISTS "anon_all_print_jobs" ON public.print_jobs;

DROP POLICY IF EXISTS "Users view their restaurant modules" ON public.restaurant_modules;
CREATE POLICY "Members view their restaurant modules" ON public.restaurant_modules
  FOR SELECT TO authenticated USING (public.can_access_restaurant(restaurant_id));

DROP POLICY IF EXISTS "Anyone can resolve restaurant by slug" ON public.restaurants;
CREATE POLICY "Members view accessible restaurants" ON public.restaurants
  FOR SELECT TO authenticated USING (public.can_access_restaurant(id));