
CREATE OR REPLACE FUNCTION public.delete_menu_item_safe(_item uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _restaurant uuid;
BEGIN
  SELECT restaurant_id INTO _restaurant FROM public.menu_items WHERE id = _item;
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'product not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF public.menu_item_has_history(_item) THEN
    UPDATE public.menu_items SET active = false, available = false WHERE id = _item;
    RETURN jsonb_build_object('action', 'deactivated', 'id', _item);
  END IF;

  DELETE FROM public.menu_items WHERE id = _item;
  RETURN jsonb_build_object('action', 'deleted', 'id', _item);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_modifier_safe(_modifier uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _restaurant uuid;
BEGIN
  SELECT g.restaurant_id INTO _restaurant
    FROM public.modifiers m JOIN public.modifier_groups g ON g.id = m.modifier_group_id
   WHERE m.id = _modifier;
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'modifier not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF public.modifier_has_history(_modifier) THEN
    UPDATE public.modifiers SET available = false WHERE id = _modifier;
    RETURN jsonb_build_object('action', 'deactivated', 'id', _modifier);
  END IF;
  DELETE FROM public.modifiers WHERE id = _modifier;
  RETURN jsonb_build_object('action', 'deleted', 'id', _modifier);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_modifier_group_safe(_group uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _restaurant uuid;
  _d int := 0;
  _da int := 0;
  _id uuid;
BEGIN
  SELECT restaurant_id INTO _restaurant FROM public.modifier_groups WHERE id = _group;
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'group not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR _id IN SELECT id FROM public.modifiers WHERE modifier_group_id = _group LOOP
    IF public.modifier_has_history(_id) THEN
      UPDATE public.modifiers SET available = false WHERE id = _id;
      _da := _da + 1;
    ELSE
      DELETE FROM public.modifiers WHERE id = _id;
      _d := _d + 1;
    END IF;
  END LOOP;

  -- If any modifier was kept (had history), keep the group too so historical references remain.
  IF _da > 0 THEN
    RETURN jsonb_build_object('action', 'partial', 'modifiers_deleted', _d, 'modifiers_kept', _da);
  END IF;

  DELETE FROM public.modifier_groups WHERE id = _group;
  RETURN jsonb_build_object('action', 'deleted', 'modifiers_deleted', _d);
END;
$$;
