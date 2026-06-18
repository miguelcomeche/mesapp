
CREATE OR REPLACE FUNCTION public.reset_restaurant_operations(_restaurant uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r_name text;
  c_payments int := 0;
  c_payment_items int := 0;
  c_payment_voids int := 0;
  c_kitchen_tickets int := 0;
  c_ticket_items int := 0;
  c_order_item_mods int := 0;
  c_order_items int := 0;
  c_orders int := 0;
  c_sessions int := 0;
  c_reservations int := 0;
  c_cash_movements int := 0;
  c_cash_sessions int := 0;
  c_print_jobs int := 0;
  c_audit_logs int := 0;
  c_tables_reset int := 0;
BEGIN
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'restaurant required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO r_name FROM public.restaurants WHERE id = _restaurant;
  IF r_name IS NULL THEN
    RAISE EXCEPTION 'restaurant not found' USING ERRCODE = 'P0002';
  END IF;

  -- 1) Close any open/ghost sessions first
  UPDATE public.table_sessions
     SET status = 'closed', closed_at = COALESCE(closed_at, now())
   WHERE restaurant_id = _restaurant AND status <> 'closed';

  -- 2) Payment voids → payment items → payments
  WITH del AS (
    DELETE FROM public.payment_voids WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_payment_voids FROM del;

  WITH del AS (
    DELETE FROM public.payment_items pi
     USING public.payments p
     WHERE pi.payment_id = p.id AND p.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO c_payment_items FROM del;

  WITH del AS (
    DELETE FROM public.payments WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_payments FROM del;

  -- 3) Kitchen/bar/customer tickets and their items
  WITH del AS (
    DELETE FROM public.ticket_items ti
     USING public.kitchen_tickets kt
     WHERE ti.ticket_id = kt.id AND kt.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO c_ticket_items FROM del;

  WITH del AS (
    DELETE FROM public.kitchen_tickets WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_kitchen_tickets FROM del;

  -- 4) Order item modifiers → order items → orders
  WITH del AS (
    DELETE FROM public.order_item_modifiers oim
     USING public.order_items oi, public.orders o, public.table_sessions ts
     WHERE oim.order_item_id = oi.id AND oi.order_id = o.id
       AND o.session_id = ts.id AND ts.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO c_order_item_mods FROM del;

  WITH del AS (
    DELETE FROM public.order_items oi
     USING public.orders o, public.table_sessions ts
     WHERE oi.order_id = o.id AND o.session_id = ts.id
       AND ts.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO c_order_items FROM del;

  WITH del AS (
    DELETE FROM public.orders o
     USING public.table_sessions ts
     WHERE o.session_id = ts.id AND ts.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO c_orders FROM del;

  -- 5) Order item audit / cancellation logs
  WITH del AS (
    DELETE FROM public.order_item_audit_logs WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_audit_logs FROM del;

  -- 6) Table sessions
  WITH del AS (
    DELETE FROM public.table_sessions WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_sessions FROM del;

  -- 7) Reservations
  WITH del AS (
    DELETE FROM public.reservations WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_reservations FROM del;

  -- 8) Cash movements → cash sessions
  WITH del AS (
    DELETE FROM public.cash_movements WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_cash_movements FROM del;

  WITH del AS (
    DELETE FROM public.cash_sessions WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_cash_sessions FROM del;

  -- 9) Print jobs
  WITH del AS (
    DELETE FROM public.print_jobs WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_print_jobs FROM del;

  -- 10) Reset table statuses
  WITH upd AS (
    UPDATE public.tables SET status = 'available'
     WHERE restaurant_id = _restaurant AND status <> 'available'
     RETURNING 1
  ) SELECT count(*) INTO c_tables_reset FROM upd;

  -- 11) Clear any active_session_id on table groups
  UPDATE public.table_groups SET active_session_id = NULL
   WHERE restaurant_id = _restaurant AND active_session_id IS NOT NULL;

  RETURN jsonb_build_object(
    'restaurant_id', _restaurant,
    'restaurant_name', r_name,
    'payments_removed', c_payments,
    'payment_items_removed', c_payment_items,
    'payment_voids_removed', c_payment_voids,
    'kitchen_tickets_removed', c_kitchen_tickets,
    'ticket_items_removed', c_ticket_items,
    'order_item_modifiers_removed', c_order_item_mods,
    'order_items_removed', c_order_items,
    'orders_removed', c_orders,
    'sessions_removed', c_sessions,
    'reservations_removed', c_reservations,
    'cash_movements_removed', c_cash_movements,
    'cash_sessions_removed', c_cash_sessions,
    'print_jobs_removed', c_print_jobs,
    'audit_logs_removed', c_audit_logs,
    'tables_reset_to_available', c_tables_reset
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reset_restaurant_operations(uuid) TO authenticated;
