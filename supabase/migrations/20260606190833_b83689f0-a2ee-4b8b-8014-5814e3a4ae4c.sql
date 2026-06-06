
-- ============ CASH MODULE ============

-- 1) cash_registers
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Caja Principal',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_registers TO authenticated;
GRANT ALL ON public.cash_registers TO service_role;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read registers" ON public.cash_registers FOR SELECT TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "Admins manage registers" ON public.cash_registers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin'));

CREATE TRIGGER trg_cash_registers_touch BEFORE UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a default register for every existing restaurant
INSERT INTO public.cash_registers (restaurant_id, name)
  SELECT id, 'Caja Principal' FROM public.restaurants
  ON CONFLICT DO NOTHING;

-- And for any future restaurant
CREATE OR REPLACE FUNCTION public.seed_default_cash_register()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cash_registers (restaurant_id, name) VALUES (NEW.id, 'Caja Principal')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_seed_cash_register ON public.restaurants;
CREATE TRIGGER trg_seed_cash_register AFTER INSERT ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_cash_register();

-- 2) cash_sessions
CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_by uuid NOT NULL,
  opened_by_name text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_amount numeric(10,2) NOT NULL DEFAULT 0,
  closed_by uuid,
  closed_by_name text,
  closed_at timestamptz,
  expected_amount numeric(10,2),
  counted_amount numeric(10,2),
  difference numeric(10,2),
  cash_sales numeric(10,2) NOT NULL DEFAULT 0,
  card_sales numeric(10,2) NOT NULL DEFAULT 0,
  other_sales numeric(10,2) NOT NULL DEFAULT 0,
  tips_cash numeric(10,2) NOT NULL DEFAULT 0,
  tips_card numeric(10,2) NOT NULL DEFAULT 0,
  cash_in_total numeric(10,2) NOT NULL DEFAULT 0,
  cash_out_total numeric(10,2) NOT NULL DEFAULT 0,
  denominations jsonb,
  signature text,
  signed_by_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cash_sessions_one_open_per_register
  ON public.cash_sessions (register_id) WHERE status = 'open';
CREATE INDEX cash_sessions_restaurant_idx ON public.cash_sessions (restaurant_id, opened_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read cash_sessions" ON public.cash_sessions FOR SELECT TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'platform_admin'));
-- Writes only via SECURITY DEFINER RPCs
CREATE POLICY "Admins write cash_sessions" ON public.cash_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin')
         OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
         OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin')
              OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
              OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager'));

CREATE TRIGGER trg_cash_sessions_touch BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) cash_movements
CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in','out')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cash_movements_session_idx ON public.cash_movements (session_id);
GRANT SELECT, INSERT ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read movements" ON public.cash_movements FOR SELECT TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "Managers insert movements" ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin')
              OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
              OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager'));

-- 4) payment_voids
CREATE TABLE public.payment_voids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  voided_by uuid NOT NULL,
  voided_by_name text,
  voided_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);
CREATE INDEX payment_voids_payment_idx ON public.payment_voids (payment_id);
GRANT SELECT, INSERT ON public.payment_voids TO authenticated;
GRANT ALL ON public.payment_voids TO service_role;
ALTER TABLE public.payment_voids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read voids" ON public.payment_voids FOR SELECT TO authenticated
  USING (public.is_restaurant_member(auth.uid(), restaurant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "Managers insert voids" ON public.payment_voids FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin')
              OR public.has_restaurant_role(auth.uid(), restaurant_id, 'restaurant_admin')
              OR public.has_restaurant_role(auth.uid(), restaurant_id, 'manager'));

-- 5) Extend payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS voided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;
CREATE INDEX IF NOT EXISTS payments_cash_session_idx ON public.payments (cash_session_id);
CREATE INDEX IF NOT EXISTS payments_restaurant_idx ON public.payments (restaurant_id, processed_at DESC);

-- Backfill restaurant_id from session
UPDATE public.payments p SET restaurant_id = ts.restaurant_id
  FROM public.table_sessions ts
  WHERE p.session_id = ts.id AND p.restaurant_id IS NULL;

-- 6) Trigger: auto-attach payment to open cash session (and require one)
CREATE OR REPLACE FUNCTION public.attach_payment_to_cash_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _restaurant uuid;
  _session uuid;
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    SELECT ts.restaurant_id INTO _restaurant FROM public.table_sessions ts WHERE ts.id = NEW.session_id;
    NEW.restaurant_id := _restaurant;
  ELSE
    _restaurant := NEW.restaurant_id;
  END IF;

  IF NEW.cash_session_id IS NULL THEN
    SELECT id INTO _session FROM public.cash_sessions
      WHERE restaurant_id = _restaurant AND status = 'open'
      ORDER BY opened_at DESC LIMIT 1;
    IF _session IS NULL THEN
      RAISE EXCEPTION 'Debe abrir una caja antes de comenzar a operar.' USING ERRCODE = 'P0001';
    END IF;
    NEW.cash_session_id := _session;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_payments_attach_session ON public.payments;
CREATE TRIGGER trg_payments_attach_session BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.attach_payment_to_cash_session();

-- 7) RPCs
CREATE OR REPLACE FUNCTION public.current_cash_session(_restaurant uuid)
RETURNS public.cash_sessions LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.cash_sessions
    WHERE restaurant_id = _restaurant AND status = 'open'
    ORDER BY opened_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.open_cash_session(
  _restaurant uuid, _register uuid, _opening_amount numeric, _notes text DEFAULT NULL
) RETURNS public.cash_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.cash_sessions;
  _name text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _register IS NULL THEN
    SELECT id INTO _register FROM public.cash_registers
      WHERE restaurant_id = _restaurant AND active LIMIT 1;
    IF _register IS NULL THEN
      INSERT INTO public.cash_registers (restaurant_id, name) VALUES (_restaurant, 'Caja Principal') RETURNING id INTO _register;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.cash_sessions WHERE register_id = _register AND status='open') THEN
    RAISE EXCEPTION 'Ya existe una caja abierta para esta caja' USING ERRCODE = 'P0001';
  END IF;
  SELECT name INTO _name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.cash_sessions (restaurant_id, register_id, opened_by, opened_by_name, opening_amount, notes)
    VALUES (_restaurant, _register, auth.uid(), _name, COALESCE(_opening_amount,0), _notes)
    RETURNING * INTO _row;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.cash_session_summary(_session uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r jsonb;
  _opening numeric;
  _cash numeric := 0; _card numeric := 0; _other numeric := 0;
  _tip_cash numeric := 0; _tip_card numeric := 0;
  _in numeric := 0; _out numeric := 0;
  _expected numeric;
BEGIN
  SELECT opening_amount INTO _opening FROM public.cash_sessions WHERE id = _session;

  SELECT
    COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN method NOT IN ('cash','card') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN method = 'cash' THEN COALESCE(tip,0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN method = 'card' THEN COALESCE(tip,0) ELSE 0 END), 0)
  INTO _cash, _card, _other, _tip_cash, _tip_card
  FROM public.payments WHERE cash_session_id = _session AND NOT voided;

  SELECT
    COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type='out' THEN amount ELSE 0 END), 0)
  INTO _in, _out
  FROM public.cash_movements WHERE session_id = _session;

  _expected := COALESCE(_opening,0) + _cash + _tip_cash + _in - _out;

  _r := jsonb_build_object(
    'opening_amount', _opening,
    'cash_sales', _cash, 'card_sales', _card, 'other_sales', _other,
    'tips_cash', _tip_cash, 'tips_card', _tip_card,
    'cash_in_total', _in, 'cash_out_total', _out,
    'total_sales', _cash + _card + _other,
    'expected_amount', _expected
  );
  RETURN _r;
END $$;

CREATE OR REPLACE FUNCTION public.close_cash_session(
  _session uuid, _counted_amount numeric, _denominations jsonb DEFAULT NULL,
  _signature text DEFAULT NULL, _signed_by_name text DEFAULT NULL, _notes text DEFAULT NULL
) RETURNS public.cash_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _restaurant uuid; _row public.cash_sessions; _s jsonb; _name text;
BEGIN
  SELECT restaurant_id INTO _restaurant FROM public.cash_sessions WHERE id = _session AND status='open';
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Caja no encontrada o ya cerrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  _s := public.cash_session_summary(_session);
  SELECT name INTO _name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.cash_sessions SET
    status = 'closed', closed_at = now(),
    closed_by = auth.uid(), closed_by_name = _name,
    cash_sales = (_s->>'cash_sales')::numeric,
    card_sales = (_s->>'card_sales')::numeric,
    other_sales = (_s->>'other_sales')::numeric,
    tips_cash = (_s->>'tips_cash')::numeric,
    tips_card = (_s->>'tips_card')::numeric,
    cash_in_total = (_s->>'cash_in_total')::numeric,
    cash_out_total = (_s->>'cash_out_total')::numeric,
    expected_amount = (_s->>'expected_amount')::numeric,
    counted_amount = COALESCE(_counted_amount, 0),
    difference = COALESCE(_counted_amount, 0) - (_s->>'expected_amount')::numeric,
    denominations = _denominations,
    signature = _signature,
    signed_by_name = COALESCE(_signed_by_name, _name),
    notes = COALESCE(_notes, notes)
  WHERE id = _session RETURNING * INTO _row;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.register_cash_movement(
  _session uuid, _type text, _amount numeric, _reason text, _notes text DEFAULT NULL
) RETURNS public.cash_movements LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _restaurant uuid; _row public.cash_movements; _name text;
BEGIN
  SELECT restaurant_id INTO _restaurant FROM public.cash_sessions WHERE id = _session AND status='open';
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'La caja no está abierta' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _type NOT IN ('in','out') THEN
    RAISE EXCEPTION 'Tipo inválido' USING ERRCODE = 'P0001';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Importe inválido' USING ERRCODE = 'P0001';
  END IF;
  SELECT name INTO _name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.cash_movements (restaurant_id, session_id, type, amount, reason, notes, created_by, created_by_name)
    VALUES (_restaurant, _session, _type, _amount, _reason, _notes, auth.uid(), _name)
    RETURNING * INTO _row;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.void_payment(_payment uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _restaurant uuid; _name text;
BEGIN
  SELECT restaurant_id INTO _restaurant FROM public.payments WHERE id = _payment;
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Pago no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO _name FROM public.profiles WHERE id = auth.uid();
  UPDATE public.payments SET voided = true WHERE id = _payment;
  INSERT INTO public.payment_voids (restaurant_id, payment_id, voided_by, voided_by_name, reason)
    VALUES (_restaurant, _payment, auth.uid(), _name, _reason);
  RETURN jsonb_build_object('action','voided','id',_payment);
END $$;
