
CREATE OR REPLACE FUNCTION public.list_restaurant_members(_restaurant uuid)
RETURNS TABLE(user_id uuid, name text, email text, role public.restaurant_role, status public.restaurant_user_status, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;
