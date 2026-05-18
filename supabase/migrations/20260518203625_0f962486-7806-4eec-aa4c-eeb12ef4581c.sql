
-- Zones table
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, slug),
  UNIQUE (restaurant_id, name)
);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view zones"
ON public.zones FOR SELECT
USING (
  restaurant_id = get_user_restaurant_id(auth.uid())
  OR is_restaurant_member(auth.uid(), restaurant_id)
  OR has_role(auth.uid(), 'platform_admin'::user_role)
);

CREATE POLICY "Admins manage zones"
ON public.zones FOR ALL
USING (
  has_role(auth.uid(), 'platform_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'manager'::user_role)
  OR has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin'::restaurant_role)
  OR has_restaurant_role(auth.uid(), restaurant_id, 'manager'::restaurant_role)
)
WITH CHECK (
  has_role(auth.uid(), 'platform_admin'::user_role)
  OR has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'manager'::user_role)
  OR has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin'::restaurant_role)
  OR has_restaurant_role(auth.uid(), restaurant_id, 'manager'::restaurant_role)
);

CREATE TRIGGER zones_touch_updated_at
BEFORE UPDATE ON public.zones
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill from existing tables.section and floor_plan_elements.zone
INSERT INTO public.zones (restaurant_id, name, slug, display_order)
SELECT DISTINCT restaurant_id, section AS name,
       lower(regexp_replace(section, '[^a-zA-Z0-9]+', '-', 'g')) AS slug,
       0
FROM public.tables
WHERE section IS NOT NULL AND section <> ''
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO public.zones (restaurant_id, name, slug, display_order)
SELECT DISTINCT restaurant_id, zone AS name,
       lower(regexp_replace(zone, '[^a-zA-Z0-9]+', '-', 'g')) AS slug,
       0
FROM public.floor_plan_elements
WHERE zone IS NOT NULL AND zone <> ''
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- Safe-delete trigger: block deletion when tables or floor elements still reference the zone
CREATE OR REPLACE FUNCTION public.prevent_zone_delete_when_in_use()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  table_count INT;
  element_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM public.tables
  WHERE restaurant_id = OLD.restaurant_id AND section = OLD.name;

  SELECT COUNT(*) INTO element_count
  FROM public.floor_plan_elements
  WHERE restaurant_id = OLD.restaurant_id AND zone = OLD.name;

  IF table_count > 0 OR element_count > 0 THEN
    RAISE EXCEPTION 'Esta zona tiene mesas o elementos. Muévelos o elimínalos antes de borrar la zona.'
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER zones_prevent_delete_in_use
BEFORE DELETE ON public.zones
FOR EACH ROW EXECUTE FUNCTION public.prevent_zone_delete_when_in_use();

-- Rename trigger: when zone name changes, propagate to tables/elements to keep links by name
CREATE OR REPLACE FUNCTION public.zones_propagate_rename()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.tables SET section = NEW.name
      WHERE restaurant_id = OLD.restaurant_id AND section = OLD.name;
    UPDATE public.floor_plan_elements SET zone = NEW.name
      WHERE restaurant_id = OLD.restaurant_id AND zone = OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zones_after_rename
AFTER UPDATE OF name ON public.zones
FOR EACH ROW EXECUTE FUNCTION public.zones_propagate_rename();
