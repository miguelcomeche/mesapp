
CREATE OR REPLACE FUNCTION public.reset_restaurant_production(_restaurant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_name text;
  c_categories int := 0;
  c_products int := 0;
  c_modifier_groups int := 0;
  c_modifiers int := 0;
  c_zones int := 0;
  c_tables int := 0;
  c_table_groups int := 0;
  c_floor_elements int := 0;
  c_reservations int := 0;
  c_sessions int := 0;
  c_orders int := 0;
  c_order_items int := 0;
  c_kitchen_tickets int := 0;
  c_payments int := 0;
  c_printers int := 0;
  c_users int := 0;
  c_waiters int := 0;
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

  -- 1) Close any open / ghost sessions first to release table state.
  UPDATE public.table_sessions
     SET status = 'closed', closed_at = COALESCE(closed_at, now())
   WHERE restaurant_id = _restaurant AND status <> 'closed';

  -- 2) OPERATIONS: payments -> kitchen tickets -> order items -> orders -> sessions -> reservations
  WITH del AS (
    DELETE FROM public.payments p
     USING public.table_sessions ts
     WHERE p.session_id = ts.id AND ts.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO c_payments FROM del;

  WITH del AS (
    DELETE FROM public.ticket_items ti
     USING public.kitchen_tickets kt
     WHERE ti.ticket_id = kt.id AND kt.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) FROM del;

  WITH del AS (
    DELETE FROM public.kitchen_tickets WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_kitchen_tickets FROM del;

  WITH del AS (
    DELETE FROM public.order_item_modifiers oim
     USING public.order_items oi, public.orders o, public.table_sessions ts
     WHERE oim.order_item_id = oi.id AND oi.order_id = o.id
       AND o.session_id = ts.id AND ts.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) FROM del;

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

  WITH del AS (
    DELETE FROM public.table_sessions WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_sessions FROM del;

  WITH del AS (
    DELETE FROM public.reservations WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_reservations FROM del;

  -- 3) FLOOR: tables / groups / elements (now safe — no sessions/reservations remain)
  UPDATE public.tables SET group_id = NULL WHERE restaurant_id = _restaurant;
  WITH del AS (
    DELETE FROM public.table_groups WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_table_groups FROM del;

  WITH del AS (
    DELETE FROM public.floor_plan_elements WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_floor_elements FROM del;

  WITH del AS (
    DELETE FROM public.tables WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_tables FROM del;

  WITH del AS (
    DELETE FROM public.zones WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_zones FROM del;

  -- 4) MENU: modifiers -> groups -> products -> category settings
  WITH del AS (
    DELETE FROM public.modifiers m
     USING public.modifier_groups g
     WHERE m.modifier_group_id = g.id AND g.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO c_modifiers FROM del;

  WITH del AS (
    DELETE FROM public.modifier_groups WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_modifier_groups FROM del;

  WITH del AS (
    DELETE FROM public.menu_items WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_products FROM del;

  WITH del AS (
    DELETE FROM public.category_settings WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_categories FROM del;

  -- 5) PRINTERS
  WITH del AS (
    DELETE FROM public.printers WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_printers FROM del;

  -- 6) STAFF: waiters + restaurant_users (but NEVER platform admins)
  WITH del AS (
    DELETE FROM public.waiters WHERE restaurant_id = _restaurant
    RETURNING 1
  ) SELECT count(*) INTO c_waiters FROM del;

  WITH del AS (
    DELETE FROM public.restaurant_users ru
     WHERE ru.restaurant_id = _restaurant
       AND NOT public.has_role(ru.user_id, 'platform_admin')
     RETURNING 1
  ) SELECT count(*) INTO c_users FROM del;

  RETURN jsonb_build_object(
    'restaurant_id', _restaurant,
    'restaurant_name', r_name,
    'categories_removed', c_categories,
    'products_removed', c_products,
    'modifier_groups_removed', c_modifier_groups,
    'modifiers_removed', c_modifiers,
    'zones_removed', c_zones,
    'tables_removed', c_tables,
    'table_groups_removed', c_table_groups,
    'floor_elements_removed', c_floor_elements,
    'reservations_removed', c_reservations,
    'sessions_removed', c_sessions,
    'orders_removed', c_orders,
    'order_items_removed', c_order_items,
    'kitchen_tickets_removed', c_kitchen_tickets,
    'payments_removed', c_payments,
    'printers_removed', c_printers,
    'waiters_removed', c_waiters,
    'users_removed', c_users
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_restaurant_production(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_restaurant_production(uuid) TO authenticated;
