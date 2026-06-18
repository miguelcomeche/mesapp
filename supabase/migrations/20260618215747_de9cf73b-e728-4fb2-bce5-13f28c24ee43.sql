
-- ============= INVOICING MODULE - PHASE 1 =============

DO $$ BEGIN
  CREATE TYPE public.invoice_type AS ENUM ('simplificado','completa','rectificativa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('emitida','rectificada','anulada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rectification_reason AS ENUM ('datos_cliente','importe','devolucion','anulacion_parcial','otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS invoicing_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waiters_can_invoice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_series_prefix text;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 10;

-- Helper predicate for invoicing tables
CREATE OR REPLACE FUNCTION public.can_access_restaurant(_restaurant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'platform_admin')
      OR _restaurant = public.get_user_restaurant_id(auth.uid())
      OR EXISTS (SELECT 1 FROM public.restaurant_users ru
                 WHERE ru.user_id = auth.uid() AND ru.restaurant_id = _restaurant)
$$;
GRANT EXECUTE ON FUNCTION public.can_access_restaurant(uuid) TO authenticated;

-- ============= invoice_customers =============
CREATE TABLE IF NOT EXISTS public.invoice_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  tax_id text,
  address text,
  postal_code text,
  city text,
  country text DEFAULT 'ES',
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_customers_restaurant ON public.invoice_customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_customers_tax_id ON public.invoice_customers(restaurant_id, tax_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_customers TO authenticated;
GRANT ALL ON public.invoice_customers TO service_role;
ALTER TABLE public.invoice_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ic_select" ON public.invoice_customers FOR SELECT TO authenticated
  USING (public.can_access_restaurant(restaurant_id));
CREATE POLICY "ic_insert" ON public.invoice_customers FOR INSERT TO authenticated
  WITH CHECK (public.can_access_restaurant(restaurant_id));
CREATE POLICY "ic_update" ON public.invoice_customers FOR UPDATE TO authenticated
  USING (public.can_access_restaurant(restaurant_id));
CREATE POLICY "ic_delete" ON public.invoice_customers FOR DELETE TO authenticated
  USING (public.can_access_restaurant(restaurant_id));

-- ============= invoice_series =============
CREATE TABLE IF NOT EXISTS public.invoice_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  prefix text NOT NULL,
  year integer NOT NULL,
  type public.invoice_type NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, year, type)
);

GRANT SELECT ON public.invoice_series TO authenticated;
GRANT ALL ON public.invoice_series TO service_role;
ALTER TABLE public.invoice_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "is_select" ON public.invoice_series FOR SELECT TO authenticated
  USING (public.can_access_restaurant(restaurant_id));

-- ============= invoices =============
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
  series_id uuid REFERENCES public.invoice_series(id),
  invoice_number text NOT NULL,
  number_seq integer NOT NULL,
  year integer NOT NULL,
  type public.invoice_type NOT NULL DEFAULT 'completa',
  status public.invoice_status NOT NULL DEFAULT 'emitida',
  issued_at timestamptz NOT NULL DEFAULT now(),

  rest_commercial_name text,
  rest_legal_name text,
  rest_tax_id text,
  rest_address text,
  rest_postal_code text,
  rest_city text,
  rest_country text,
  rest_phone text,

  customer_id uuid REFERENCES public.invoice_customers(id) ON DELETE SET NULL,
  customer_legal_name text,
  customer_tax_id text,
  customer_address text,
  customer_postal_code text,
  customer_city text,
  customer_country text,
  customer_email text,
  customer_phone text,

  session_id uuid REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  table_number text,
  waiter_name text,
  issued_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_by_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL,

  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  currency text NOT NULL DEFAULT 'EUR',

  rectifies_invoice_id uuid REFERENCES public.invoices(id),
  rectification_reason public.rectification_reason,
  rectification_notes text,

  verifactu_hash text,
  verifactu_chain_prev text,
  verifactu_qr_url text,
  ticketbai_id text,
  ticketbai_signature text,
  digital_signature text,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_restaurant ON public.invoices(restaurant_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_session ON public.invoices(session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment ON public.invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_cash_session ON public.invoices(cash_session_id);

GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_select" ON public.invoices FOR SELECT TO authenticated
  USING (public.can_access_restaurant(restaurant_id));
CREATE POLICY "inv_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.can_access_restaurant(restaurant_id));
CREATE POLICY "inv_update" ON public.invoices FOR UPDATE TO authenticated
  USING (public.can_access_restaurant(restaurant_id));

-- ============= invoice_items =============
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  product_name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,4) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 10,
  base_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

GRANT SELECT, INSERT ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ii_select" ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_access_restaurant(i.restaurant_id)));
CREATE POLICY "ii_insert" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_access_restaurant(i.restaurant_id)));

-- ============= invoice_tax_breakdown =============
CREATE TABLE IF NOT EXISTS public.invoice_tax_breakdown (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  vat_rate numeric(5,2) NOT NULL,
  base_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, vat_rate)
);

GRANT SELECT, INSERT ON public.invoice_tax_breakdown TO authenticated;
GRANT ALL ON public.invoice_tax_breakdown TO service_role;
ALTER TABLE public.invoice_tax_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itb_select" ON public.invoice_tax_breakdown FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_access_restaurant(i.restaurant_id)));
CREATE POLICY "itb_insert" ON public.invoice_tax_breakdown FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_access_restaurant(i.restaurant_id)));

-- ============= Numbering function (atomic) =============
CREATE OR REPLACE FUNCTION public.issue_invoice_number(_restaurant uuid, _type public.invoice_type)
RETURNS TABLE(series_id uuid, prefix text, year integer, seq integer, invoice_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year integer := EXTRACT(YEAR FROM now())::int;
  _prefix text;
  _series_id uuid;
  _seq integer;
BEGIN
  SELECT COALESCE(NULLIF(invoice_series_prefix,''), UPPER(LEFT(COALESCE(NULLIF(commercial_name,''), name), 8)))
    INTO _prefix FROM public.restaurants WHERE id = _restaurant;
  IF _prefix IS NULL OR _prefix = '' THEN _prefix := 'INV'; END IF;

  SELECT id INTO _series_id FROM public.invoice_series
    WHERE restaurant_id = _restaurant AND year = _year AND type = _type
    FOR UPDATE;

  IF _series_id IS NULL THEN
    INSERT INTO public.invoice_series(restaurant_id, prefix, year, type, last_number)
      VALUES (_restaurant, _prefix, _year, _type, 0)
      RETURNING id INTO _series_id;
  END IF;

  UPDATE public.invoice_series
    SET last_number = last_number + 1, updated_at = now()
    WHERE id = _series_id
    RETURNING last_number INTO _seq;

  RETURN QUERY SELECT
    _series_id,
    _prefix,
    _year,
    _seq,
    _prefix || '-' || _year::text || '-' || LPAD(_seq::text, 6, '0');
END $$;

GRANT EXECUTE ON FUNCTION public.issue_invoice_number(uuid, public.invoice_type) TO authenticated;

-- ============= Immutability triggers =============
CREATE OR REPLACE FUNCTION public.invoices_protect_fiscal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las facturas emitidas no se pueden eliminar';
  END IF;
  IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.number_seq IS DISTINCT FROM OLD.number_seq
     OR NEW.year IS DISTINCT FROM OLD.year
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.tax_total IS DISTINCT FROM OLD.tax_total
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
  THEN
    RAISE EXCEPTION 'No se pueden modificar los campos fiscales de una factura emitida';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoices_protect ON public.invoices;
CREATE TRIGGER trg_invoices_protect
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_protect_fiscal();

CREATE OR REPLACE FUNCTION public.invoice_items_block_mutations()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Las líneas de factura son inmutables';
END $$;

DROP TRIGGER IF EXISTS trg_invoice_items_immutable ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_immutable
  BEFORE UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.invoice_items_block_mutations();

DROP TRIGGER IF EXISTS trg_invoice_tax_immutable ON public.invoice_tax_breakdown;
CREATE TRIGGER trg_invoice_tax_immutable
  BEFORE UPDATE OR DELETE ON public.invoice_tax_breakdown
  FOR EACH ROW EXECUTE FUNCTION public.invoice_items_block_mutations();
