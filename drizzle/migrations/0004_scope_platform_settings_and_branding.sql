DROP POLICY IF EXISTS "Anyone authenticated reads platform settings" ON public.platform_settings;

CREATE OR REPLACE FUNCTION public.can_manage_branding_path(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _rid uuid;
BEGIN
  IF public.has_role(auth.uid(), 'platform_admin') THEN RETURN true; END IF;
  BEGIN
    _rid := (split_part(_name, '/', 1))::uuid;
  EXCEPTION WHEN others THEN RETURN false;
  END;
  RETURN public.has_restaurant_role(auth.uid(), _rid, 'restaurant_admin')
      OR public.has_restaurant_role(auth.uid(), _rid, 'manager')
      OR (public.has_role(auth.uid(), 'admin') AND public.get_user_restaurant_id(auth.uid()) = _rid);
END $$;

DROP POLICY IF EXISTS "Admins upload branding" ON storage.objects;
DROP POLICY IF EXISTS "Admins update branding" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete branding" ON storage.objects;

CREATE POLICY "Admins upload branding" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'restaurant-branding' AND public.can_manage_branding_path(name));
CREATE POLICY "Admins update branding" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'restaurant-branding' AND public.can_manage_branding_path(name))
  WITH CHECK (bucket_id = 'restaurant-branding' AND public.can_manage_branding_path(name));
CREATE POLICY "Admins delete branding" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'restaurant-branding' AND public.can_manage_branding_path(name));