
-- 1) production_stations table
CREATE TABLE IF NOT EXISTS public.production_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  sort_order integer NOT NULL DEFAULT 0,
  printer_id uuid REFERENCES public.printers(id) ON DELETE SET NULL,
  station order_station NOT NULL DEFAULT 'kitchen',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_stations TO authenticated;
GRANT ALL ON public.production_stations TO service_role;

ALTER TABLE public.production_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view production stations" ON public.production_stations
  FOR SELECT USING (
    public.is_restaurant_member(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

CREATE POLICY "Admins manage production stations" ON public.production_stations
  FOR ALL USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  );

CREATE TRIGGER trg_production_stations_touch
  BEFORE UPDATE ON public.production_stations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Link from category_settings
ALTER TABLE public.category_settings
  ADD COLUMN IF NOT EXISTS production_station_id uuid
  REFERENCES public.production_stations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_category_settings_station
  ON public.category_settings(production_station_id);

-- 3) Seed default stations for every existing restaurant
INSERT INTO public.production_stations (restaurant_id, name, color, sort_order, station)
SELECT r.id, 'Cocina', '#ef4444', 0, 'kitchen'::order_station
FROM public.restaurants r
ON CONFLICT (restaurant_id, name) DO NOTHING;

INSERT INTO public.production_stations (restaurant_id, name, color, sort_order, station)
SELECT r.id, 'Barra', '#3b82f6', 1, 'bar'::order_station
FROM public.restaurants r
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- 4) Migrate existing category_settings auto_marchar_station -> production_station_id
UPDATE public.category_settings cs
SET production_station_id = ps.id
FROM public.production_stations ps
WHERE cs.production_station_id IS NULL
  AND ps.restaurant_id = cs.restaurant_id
  AND ps.station::text = COALESCE(cs.auto_marchar_station, 'kitchen');

-- 5) Auto-seed default stations when a new restaurant is created
CREATE OR REPLACE FUNCTION public.seed_default_production_stations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.production_stations (restaurant_id, name, color, sort_order, station)
  VALUES
    (NEW.id, 'Cocina', '#ef4444', 0, 'kitchen'),
    (NEW.id, 'Barra',  '#3b82f6', 1, 'bar')
  ON CONFLICT (restaurant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_stations_on_restaurant ON public.restaurants;
CREATE TRIGGER trg_seed_stations_on_restaurant
  AFTER INSERT ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_production_stations();

-- 6) Safe delete RPC
CREATE OR REPLACE FUNCTION public.delete_production_station_safe(_station uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _restaurant uuid;
  _linked int;
BEGIN
  SELECT restaurant_id INTO _restaurant
    FROM public.production_stations WHERE id = _station;
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'station not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _linked
    FROM public.category_settings
   WHERE production_station_id = _station;

  IF _linked > 0 THEN
    RETURN jsonb_build_object(
      'action', 'blocked',
      'reason', 'has_categories',
      'linked_categories', _linked
    );
  END IF;

  DELETE FROM public.production_stations WHERE id = _station;
  RETURN jsonb_build_object('action', 'deleted', 'id', _station);
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_stations;
