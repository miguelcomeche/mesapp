
-- 1) Drop obsolete column if it exists
ALTER TABLE public.restaurant_users DROP COLUMN IF EXISTS waiter_pin;

-- 2) Recreate list_restaurant_members without waiter_pin
DROP FUNCTION IF EXISTS public.list_restaurant_members(uuid);

CREATE OR REPLACE FUNCTION public.list_restaurant_members(_restaurant uuid)
RETURNS TABLE(user_id uuid, name text, email text, role restaurant_role, status restaurant_user_status, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'platform_admin')
          OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT ru.user_id, p.name, p.email, ru.role, ru.status, ru.created_at
    FROM public.restaurant_users ru
    JOIN public.profiles p ON p.id = ru.user_id
    WHERE ru.restaurant_id = _restaurant
    ORDER BY p.name;
END;
$function$;

-- 3) Tracking columns
ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS opened_by_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_by_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS added_by_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL;

ALTER TABLE public.kitchen_tickets
  ADD COLUMN IF NOT EXISTS fired_by_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_by_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL;
