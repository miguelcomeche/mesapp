GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_settings TO authenticated;
GRANT ALL ON public.category_settings TO service_role;