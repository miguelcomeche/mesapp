
CREATE TYPE public.floor_element_type AS ENUM ('bar','wall','separator','text','zone_block','decoration');

CREATE TABLE public.floor_plan_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  zone text NOT NULL DEFAULT 'Interior',
  type public.floor_element_type NOT NULL,
  label text,
  x integer NOT NULL DEFAULT 0,
  y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 120,
  height integer NOT NULL DEFAULT 40,
  rotation integer NOT NULL DEFAULT 0,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.floor_plan_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view floor elements"
ON public.floor_plan_elements FOR SELECT
USING (
  restaurant_id = public.get_user_restaurant_id(auth.uid())
  OR public.is_restaurant_member(auth.uid(), restaurant_id)
  OR public.has_role(auth.uid(), 'platform_admin')
);

CREATE POLICY "Admins manage floor elements"
ON public.floor_plan_elements FOR ALL
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

CREATE TRIGGER floor_plan_elements_touch_updated_at
BEFORE UPDATE ON public.floor_plan_elements
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_floor_plan_elements_restaurant_zone
ON public.floor_plan_elements(restaurant_id, zone);
