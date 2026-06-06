
-- Safely delete an operational waiter only if it has no recorded activity.
CREATE OR REPLACE FUNCTION public.delete_waiter_safe(_restaurant uuid, _waiter uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uses int := 0;
BEGIN
  -- Permission: platform_admin OR restaurant_admin OR manager of that restaurant
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Sanity: waiter belongs to that restaurant
  IF NOT EXISTS (SELECT 1 FROM public.waiters WHERE id = _waiter AND restaurant_id = _restaurant) THEN
    RAISE EXCEPTION 'Camarero no encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    (SELECT count(*) FROM public.table_sessions
       WHERE waiter_id = _waiter OR opened_by_waiter_id = _waiter OR closed_by_waiter_id = _waiter)
    + (SELECT count(*) FROM public.order_items WHERE added_by_waiter_id = _waiter)
    + (SELECT count(*) FROM public.kitchen_tickets WHERE fired_by_waiter_id = _waiter)
    + (SELECT count(*) FROM public.payments WHERE paid_by_waiter_id = _waiter)
  INTO uses;

  IF uses > 0 THEN
    RAISE EXCEPTION 'WAITER_HAS_HISTORY' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.waiters WHERE id = _waiter AND restaurant_id = _restaurant;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_waiter_safe(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_waiter_safe(uuid, uuid) TO authenticated;

-- Unlink an auth user from a restaurant (remove membership only).
CREATE OR REPLACE FUNCTION public.unlink_restaurant_user(_restaurant uuid, _user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.restaurant_users
   WHERE restaurant_id = _restaurant AND user_id = _user;
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_restaurant_user(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unlink_restaurant_user(uuid, uuid) TO authenticated;
