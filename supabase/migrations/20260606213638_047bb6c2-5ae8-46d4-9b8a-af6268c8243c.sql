ALTER TABLE public.category_settings
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.category_settings
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.category_settings
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_category_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_category_settings_updated_at
    BEFORE UPDATE ON public.category_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.category_settings(id) ON DELETE SET NULL;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS available_for_sale boolean NOT NULL DEFAULT true;

INSERT INTO public.category_settings (restaurant_id, category_name, active, display_order)
SELECT restaurant_id, category, true, MIN(COALESCE(display_order, 0))
FROM public.menu_items
WHERE category IS NOT NULL AND trim(category) <> ''
GROUP BY restaurant_id, category
ON CONFLICT (restaurant_id, category_name) DO UPDATE
SET active = true,
    display_order = LEAST(public.category_settings.display_order, EXCLUDED.display_order);

UPDATE public.menu_items mi
SET category_id = cs.id
FROM public.category_settings cs
WHERE mi.restaurant_id = cs.restaurant_id
  AND mi.category = cs.category_name
  AND mi.category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_category_visibility
  ON public.menu_items(restaurant_id, category_id, active, available_for_sale, available);

CREATE INDEX IF NOT EXISTS idx_category_settings_restaurant_active
  ON public.category_settings(restaurant_id, active, display_order);