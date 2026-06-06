DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'menu_items'
      AND policyname = 'Restaurant members can view active restaurant menu items'
  ) THEN
    CREATE POLICY "Restaurant members can view active restaurant menu items"
    ON public.menu_items
    FOR SELECT
    USING (public.is_restaurant_member(auth.uid(), restaurant_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'menu_items'
      AND policyname = 'Restaurant managers can manage active restaurant menu items'
  ) THEN
    CREATE POLICY "Restaurant managers can manage active restaurant menu items"
    ON public.menu_items
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'platform_admin')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
      OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'platform_admin')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
      OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'category_settings'
      AND policyname = 'Restaurant members can view active restaurant categories'
  ) THEN
    CREATE POLICY "Restaurant members can view active restaurant categories"
    ON public.category_settings
    FOR SELECT
    USING (public.is_restaurant_member(auth.uid(), restaurant_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'category_settings'
      AND policyname = 'Restaurant managers can manage active restaurant categories'
  ) THEN
    CREATE POLICY "Restaurant managers can manage active restaurant categories"
    ON public.category_settings
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'platform_admin')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
      OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'platform_admin')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
      OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
    );
  END IF;
END $$;