
DO $$ BEGIN
  CREATE TYPE restaurant_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE restaurant_type AS ENUM ('production', 'demo');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS status restaurant_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS type restaurant_type NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.restaurants
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))
WHERE slug IS NULL OR slug = '';

UPDATE public.restaurants
SET slug = 'santachiara', type = 'production', status = 'active'
WHERE name ILIKE '%santa chiara%';

ALTER TABLE public.restaurants ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_slug_key ON public.restaurants (slug);

DO $$ BEGIN
  ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_slug_format CHECK (slug ~ '^[a-z0-9-]+$');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.restaurant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  pos_enabled boolean NOT NULL DEFAULT true,
  reservations_enabled boolean NOT NULL DEFAULT false,
  public_booking_enabled boolean NOT NULL DEFAULT false,
  menu_enabled boolean NOT NULL DEFAULT true,
  payments_enabled boolean NOT NULL DEFAULT true,
  kitchen_bar_enabled boolean NOT NULL DEFAULT false,
  analytics_enabled boolean NOT NULL DEFAULT false,
  tickets_enabled boolean NOT NULL DEFAULT false,
  printing_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_modules ENABLE ROW LEVEL SECURITY;

INSERT INTO public.restaurant_modules (restaurant_id)
SELECT r.id FROM public.restaurants r
WHERE NOT EXISTS (SELECT 1 FROM public.restaurant_modules m WHERE m.restaurant_id = r.id);

UPDATE public.restaurant_modules m
SET reservations_enabled = true, public_booking_enabled = true,
    kitchen_bar_enabled = true, tickets_enabled = true, updated_at = now()
FROM public.restaurants r
WHERE r.id = m.restaurant_id AND r.slug = 'santachiara';

INSERT INTO public.restaurants (name, slug, type, status, timezone, currency)
SELECT 'Demo Mesapp', 'demo', 'demo'::restaurant_type, 'active'::restaurant_status, 'Europe/Madrid', 'EUR'
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants WHERE slug = 'demo');

INSERT INTO public.restaurant_modules (
  restaurant_id, pos_enabled, reservations_enabled, public_booking_enabled,
  menu_enabled, payments_enabled, kitchen_bar_enabled, analytics_enabled,
  tickets_enabled, printing_enabled
)
SELECT r.id, true, true, true, true, true, true, true, true, true
FROM public.restaurants r
WHERE r.slug = 'demo'
  AND NOT EXISTS (SELECT 1 FROM public.restaurant_modules m WHERE m.restaurant_id = r.id);

UPDATE public.restaurant_modules m
SET pos_enabled=true, reservations_enabled=true, public_booking_enabled=true,
    menu_enabled=true, payments_enabled=true, kitchen_bar_enabled=true,
    analytics_enabled=true, tickets_enabled=true, printing_enabled=true,
    updated_at=now()
FROM public.restaurants r
WHERE r.id = m.restaurant_id AND r.slug = 'demo';

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_restaurants_updated ON public.restaurants;
CREATE TRIGGER trg_restaurants_updated BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_modules_updated ON public.restaurant_modules;
CREATE TRIGGER trg_restaurant_modules_updated BEFORE UPDATE ON public.restaurant_modules
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "Platform admins manage restaurants" ON public.restaurants;
CREATE POLICY "Platform admins manage restaurants" ON public.restaurants
  FOR ALL USING (has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "Anyone can resolve restaurant by slug" ON public.restaurants;
CREATE POLICY "Anyone can resolve restaurant by slug" ON public.restaurants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users view their restaurant modules" ON public.restaurant_modules;
CREATE POLICY "Users view their restaurant modules" ON public.restaurant_modules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform admins manage modules" ON public.restaurant_modules;
CREATE POLICY "Platform admins manage modules" ON public.restaurant_modules
  FOR ALL USING (has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'));

DROP POLICY IF EXISTS "Restaurant admins manage their modules" ON public.restaurant_modules;
CREATE POLICY "Restaurant admins manage their modules" ON public.restaurant_modules
  FOR ALL USING (
    restaurant_id = get_user_restaurant_id(auth.uid())
    AND has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    restaurant_id = get_user_restaurant_id(auth.uid())
    AND has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(_slug text)
RETURNS TABLE (
  restaurant_id uuid, name text, slug text,
  status restaurant_status, type restaurant_type,
  pos_enabled boolean, reservations_enabled boolean, public_booking_enabled boolean,
  menu_enabled boolean, payments_enabled boolean, kitchen_bar_enabled boolean,
  analytics_enabled boolean, tickets_enabled boolean, printing_enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.slug, r.status, r.type,
         COALESCE(m.pos_enabled, true), COALESCE(m.reservations_enabled, false),
         COALESCE(m.public_booking_enabled, false), COALESCE(m.menu_enabled, true),
         COALESCE(m.payments_enabled, true), COALESCE(m.kitchen_bar_enabled, false),
         COALESCE(m.analytics_enabled, false), COALESCE(m.tickets_enabled, false),
         COALESCE(m.printing_enabled, false)
  FROM public.restaurants r
  LEFT JOIN public.restaurant_modules m ON m.restaurant_id = r.id
  WHERE r.slug = lower(_slug)
  LIMIT 1;
$$;
