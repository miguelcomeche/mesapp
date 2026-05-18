
-- Enums
DO $$ BEGIN
  CREATE TYPE public.restaurant_role AS ENUM ('restaurant_admin', 'manager', 'waiter');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.restaurant_user_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.restaurant_users (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role public.restaurant_role NOT NULL DEFAULT 'waiter',
  status public.restaurant_user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_users_restaurant ON public.restaurant_users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_users_user ON public.restaurant_users(user_id);

DROP TRIGGER IF EXISTS trg_restaurant_users_updated ON public.restaurant_users;
CREATE TRIGGER trg_restaurant_users_updated
  BEFORE UPDATE ON public.restaurant_users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.restaurant_users ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.has_restaurant_role(_user uuid, _restaurant uuid, _role public.restaurant_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_users
    WHERE user_id = _user AND restaurant_id = _restaurant
      AND role = _role AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_member(_user uuid, _restaurant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_users
    WHERE user_id = _user AND restaurant_id = _restaurant AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_restaurants(_user uuid)
RETURNS TABLE(restaurant_id uuid, name text, slug text, role public.restaurant_role, status public.restaurant_user_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.slug, ru.role, ru.status
  FROM public.restaurant_users ru
  JOIN public.restaurants r ON r.id = ru.restaurant_id
  WHERE ru.user_id = _user
  ORDER BY r.name;
$$;

-- RLS Policies
DROP POLICY IF EXISTS "Users view own memberships" ON public.restaurant_users;
CREATE POLICY "Users view own memberships" ON public.restaurant_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  );

DROP POLICY IF EXISTS "Admins manage memberships" ON public.restaurant_users;
CREATE POLICY "Admins manage memberships" ON public.restaurant_users
  FOR ALL USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  );

-- Backfill from existing profiles + user_roles
INSERT INTO public.restaurant_users (user_id, restaurant_id, role, status)
SELECT
  p.id,
  p.restaurant_id,
  CASE
    WHEN ur.role = 'admin' THEN 'restaurant_admin'::public.restaurant_role
    WHEN ur.role = 'manager' THEN 'manager'::public.restaurant_role
    ELSE 'waiter'::public.restaurant_role
  END,
  'active'
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT role FROM public.user_roles WHERE user_id = p.id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
  LIMIT 1
) ur ON true
WHERE p.restaurant_id IS NOT NULL
ON CONFLICT (user_id, restaurant_id) DO NOTHING;
