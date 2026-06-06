CREATE OR REPLACE FUNCTION public.menu_items_sync_category_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.category_id IS NULL AND NEW.category IS NOT NULL THEN
    SELECT id INTO NEW.category_id
    FROM public.category_settings
    WHERE restaurant_id = NEW.restaurant_id
      AND category_name = NEW.category
    LIMIT 1;
  END IF;

  IF NEW.category_id IS NOT NULL THEN
    SELECT category_name INTO NEW.category
    FROM public.category_settings
    WHERE id = NEW.category_id
      AND restaurant_id = NEW.restaurant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_items_sync_category_id ON public.menu_items;
CREATE TRIGGER trg_menu_items_sync_category_id
BEFORE INSERT OR UPDATE OF restaurant_id, category_id, category
ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.menu_items_sync_category_id();