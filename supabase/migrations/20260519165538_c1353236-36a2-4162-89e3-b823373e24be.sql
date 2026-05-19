
DROP FUNCTION IF EXISTS public.list_restaurant_members(uuid);

CREATE OR REPLACE FUNCTION public.list_restaurant_members(_restaurant uuid)
 RETURNS TABLE(user_id uuid, name text, email text, role restaurant_role, status restaurant_user_status, waiter_pin text, created_at timestamp with time zone)
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
    SELECT ru.user_id, p.name, p.email, ru.role, ru.status, ru.waiter_pin, ru.created_at
    FROM public.restaurant_users ru
    JOIN public.profiles p ON p.id = ru.user_id
    WHERE ru.restaurant_id = _restaurant
    ORDER BY p.name;
END;
$function$;
