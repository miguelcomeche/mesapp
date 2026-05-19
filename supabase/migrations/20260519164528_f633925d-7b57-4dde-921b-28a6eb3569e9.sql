
-- =========================================================
-- Phase 1: schema for platform settings, restaurant settings,
-- hours, reservation settings, printers
-- =========================================================

-- Restaurants: extra business fields + branding
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'España',
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

-- Profiles: status + last sign in mirror
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

-- =========================================================
-- platform_settings (singleton, id always = 1)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  platform_name text NOT NULL DEFAULT 'Mesapp',
  base_domain text NOT NULL DEFAULT 'mesapp.com',
  support_email text,
  maintenance_mode boolean NOT NULL DEFAULT false,
  allow_demo_restaurants boolean NOT NULL DEFAULT true,
  primary_color text,
  secondary_color text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (id = 1)
);
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated reads platform settings"
  ON public.platform_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Platform admins manage platform settings"
  ON public.platform_settings FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER trg_platform_settings_touch
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- restaurant_hours (weekly schedule, one row per day per restaurant)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.restaurant_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  lunch_open time,
  lunch_close time,
  dinner_open time,
  dinner_close time,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, day_of_week)
);
ALTER TABLE public.restaurant_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view hours"
  ON public.restaurant_hours FOR SELECT
  USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    OR public.is_restaurant_member(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins manage hours"
  ON public.restaurant_hours FOR ALL
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  );

CREATE TRIGGER trg_restaurant_hours_touch
  BEFORE UPDATE ON public.restaurant_hours
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- restaurant_special_days
-- =========================================================
CREATE TABLE IF NOT EXISTS public.restaurant_special_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  date date NOT NULL,
  closed boolean NOT NULL DEFAULT true,
  lunch_open time,
  lunch_close time,
  dinner_open time,
  dinner_close time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, date)
);
ALTER TABLE public.restaurant_special_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view special days"
  ON public.restaurant_special_days FOR SELECT
  USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    OR public.is_restaurant_member(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins manage special days"
  ON public.restaurant_special_days FOR ALL
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  );

CREATE TRIGGER trg_special_days_touch
  BEFORE UPDATE ON public.restaurant_special_days
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- restaurant_reservation_settings (one per restaurant)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.restaurant_reservation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE,
  default_duration_minutes int NOT NULL DEFAULT 90,
  buffer_minutes int NOT NULL DEFAULT 15,
  max_online_party_size int NOT NULL DEFAULT 8,
  max_lead_days int NOT NULL DEFAULT 60,
  min_lead_minutes int NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_reservation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view reservation settings"
  ON public.restaurant_reservation_settings FOR SELECT
  USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    OR public.is_restaurant_member(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins manage reservation settings"
  ON public.restaurant_reservation_settings FOR ALL
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
  );

CREATE TRIGGER trg_reservation_settings_touch
  BEFORE UPDATE ON public.restaurant_reservation_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- printers
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.printer_type AS ENUM ('browser_print','network','escpos','epson_epos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.printer_station AS ENUM ('cocina','barra','tickets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  type public.printer_type NOT NULL DEFAULT 'browser_print',
  ip_address text,
  port int,
  station public.printer_station NOT NULL DEFAULT 'cocina',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view printers"
  ON public.printers FOR SELECT
  USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
    OR public.is_restaurant_member(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins manage printers"
  ON public.printers FOR ALL
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  );

CREATE TRIGGER trg_printers_touch
  BEFORE UPDATE ON public.printers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- list_global_users RPC (platform_admin only)
-- =========================================================
CREATE OR REPLACE FUNCTION public.list_global_users()
RETURNS TABLE(
  user_id uuid,
  name text,
  email text,
  status text,
  last_sign_in_at timestamptz,
  global_roles user_role[],
  restaurants jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.name,
      p.email,
      p.status,
      COALESCE(p.last_sign_in_at, au.last_sign_in_at),
      COALESCE(
        (SELECT array_agg(ur.role) FROM public.user_roles ur WHERE ur.user_id = p.id),
        ARRAY[]::user_role[]
      ),
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'restaurant_id', r.id,
          'name', r.name,
          'slug', r.slug,
          'role', ru.role,
          'status', ru.status
        )) FROM public.restaurant_users ru
        JOIN public.restaurants r ON r.id = ru.restaurant_id
        WHERE ru.user_id = p.id),
        '[]'::jsonb
      )
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    ORDER BY p.name;
END;
$$;

-- =========================================================
-- Storage bucket for branding
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-branding', 'restaurant-branding', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Branding public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-branding');

CREATE POLICY "Admins upload branding"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'restaurant-branding'
    AND (
      public.has_role(auth.uid(), 'platform_admin')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins update branding"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'restaurant-branding'
    AND (
      public.has_role(auth.uid(), 'platform_admin')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins delete branding"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'restaurant-branding'
    AND (
      public.has_role(auth.uid(), 'platform_admin')
      OR public.has_role(auth.uid(), 'admin')
    )
  );
