
-- Allow soft-deactivation of menu items that have order history
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Helper: is product referenced by historical order_items?
CREATE OR REPLACE FUNCTION public.menu_item_has_history(_item uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.order_items WHERE menu_item_id = _item);
$$;

CREATE OR REPLACE FUNCTION public.modifier_has_history(_modifier uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.order_item_modifiers WHERE modifier_id = _modifier);
$$;

-- Delete a single category + its products for one restaurant
CREATE OR REPLACE FUNCTION public.delete_category_with_products(_restaurant uuid, _category text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_deleted int := 0;
  c_deactivated int := 0;
  _id uuid;
BEGIN
  IF _restaurant IS NULL OR _category IS NULL THEN
    RAISE EXCEPTION 'restaurant and category required' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR _id IN SELECT id FROM public.menu_items
              WHERE restaurant_id = _restaurant AND category = _category LOOP
    IF public.menu_item_has_history(_id) THEN
      UPDATE public.menu_items SET active = false, available = false WHERE id = _id;
      c_deactivated := c_deactivated + 1;
    ELSE
      DELETE FROM public.menu_items WHERE id = _id;
      c_deleted := c_deleted + 1;
    END IF;
  END LOOP;

  DELETE FROM public.category_settings
   WHERE restaurant_id = _restaurant AND category = _category;

  RETURN jsonb_build_object('category', _category, 'deleted', c_deleted, 'deactivated', c_deactivated);
END;
$$;

-- Wipe full menu (categories, products, modifier groups, modifiers) for one restaurant
CREATE OR REPLACE FUNCTION public.wipe_restaurant_menu(_restaurant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_products_deleted int := 0;
  c_products_deactivated int := 0;
  c_modifiers_deleted int := 0;
  c_modifiers_deactivated int := 0;
  c_groups int := 0;
  c_categories int := 0;
  _id uuid;
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

  -- Products
  FOR _id IN SELECT id FROM public.menu_items WHERE restaurant_id = _restaurant LOOP
    IF public.menu_item_has_history(_id) THEN
      UPDATE public.menu_items SET active = false, available = false WHERE id = _id;
      c_products_deactivated := c_products_deactivated + 1;
    ELSE
      DELETE FROM public.menu_items WHERE id = _id;
      c_products_deleted := c_products_deleted + 1;
    END IF;
  END LOOP;

  -- Modifiers (in this restaurant's groups)
  FOR _id IN SELECT m.id FROM public.modifiers m
              JOIN public.modifier_groups g ON g.id = m.modifier_group_id
              WHERE g.restaurant_id = _restaurant LOOP
    IF public.modifier_has_history(_id) THEN
      UPDATE public.modifiers SET available = false WHERE id = _id;
      c_modifiers_deactivated := c_modifiers_deactivated + 1;
    ELSE
      DELETE FROM public.modifiers WHERE id = _id;
      c_modifiers_deleted := c_modifiers_deleted + 1;
    END IF;
  END LOOP;

  -- Modifier groups (only those with no remaining modifiers can be removed)
  WITH del AS (
    DELETE FROM public.modifier_groups g
     WHERE g.restaurant_id = _restaurant
       AND NOT EXISTS (SELECT 1 FROM public.modifiers m WHERE m.modifier_group_id = g.id)
     RETURNING 1
  ) SELECT count(*) INTO c_groups FROM del;

  -- Category settings (per restaurant)
  WITH del AS (
    DELETE FROM public.category_settings WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO c_categories FROM del;

  RETURN jsonb_build_object(
    'products_deleted', c_products_deleted,
    'products_deactivated', c_products_deactivated,
    'modifiers_deleted', c_modifiers_deleted,
    'modifiers_deactivated', c_modifiers_deactivated,
    'modifier_groups_removed', c_groups,
    'category_settings_removed', c_categories
  );
END;
$$;
