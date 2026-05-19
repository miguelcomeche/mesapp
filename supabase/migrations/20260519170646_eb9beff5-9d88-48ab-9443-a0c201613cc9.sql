CREATE TABLE public.waiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  pin text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waiters_pin_format CHECK (pin ~ '^[0-9]{4,8}$')
);

CREATE UNIQUE INDEX waiters_unique_active_pin
  ON public.waiters (restaurant_id, pin)
  WHERE active = true;

CREATE INDEX waiters_restaurant_idx ON public.waiters (restaurant_id);

ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view waiters"
ON public.waiters FOR SELECT
USING (
  restaurant_id = public.get_user_restaurant_id(auth.uid())
  OR public.is_restaurant_member(auth.uid(), restaurant_id)
  OR public.has_role(auth.uid(), 'platform_admin')
);

CREATE POLICY "Admins manage waiters"
ON public.waiters FOR ALL
USING (
  public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
  OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager')
);

CREATE TRIGGER waiters_touch_updated_at
BEFORE UPDATE ON public.waiters
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();