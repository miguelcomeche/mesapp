
-- Allow bypass via session flag app.allow_invoice_reset = 'true'
CREATE OR REPLACE FUNCTION public.invoice_items_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('app.allow_invoice_reset', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Las líneas de factura son inmutables';
END;
$$;

CREATE OR REPLACE FUNCTION public.invoices_protect_fiscal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_invoice_reset', true) = 'true' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Las facturas emitidas no se pueden eliminar';
  END IF;
  IF current_setting('app.allow_invoice_reset', true) = 'true' THEN
    NEW.updated_at := now();
    RETURN NEW;
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
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_invoice(_invoice uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _restaurant uuid;
  _num text;
BEGIN
  SELECT restaurant_id, invoice_number INTO _restaurant, _num
    FROM public.invoices WHERE id = _invoice;
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.allow_invoice_reset', 'true', true);

  UPDATE public.invoices SET rectifies_invoice_id = NULL WHERE rectifies_invoice_id = _invoice;
  DELETE FROM public.invoice_tax_breakdown WHERE invoice_id = _invoice;
  DELETE FROM public.invoice_items WHERE invoice_id = _invoice;
  DELETE FROM public.invoices WHERE id = _invoice;

  PERFORM set_config('app.allow_invoice_reset', 'false', true);

  RETURN jsonb_build_object('action','deleted','invoice_number', _num);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_invoicing(_restaurant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoices_removed int := 0;
  _items_removed int := 0;
  _tax_removed int := 0;
  _series_reset int := 0;
BEGIN
  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'restaurant required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.allow_invoice_reset', 'true', true);

  WITH del AS (
    DELETE FROM public.invoice_tax_breakdown b
     USING public.invoices i
     WHERE b.invoice_id = i.id AND i.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO _tax_removed FROM del;

  WITH del AS (
    DELETE FROM public.invoice_items ii
     USING public.invoices i
     WHERE ii.invoice_id = i.id AND i.restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO _items_removed FROM del;

  UPDATE public.invoices SET rectifies_invoice_id = NULL
   WHERE restaurant_id = _restaurant AND rectifies_invoice_id IS NOT NULL;

  WITH del AS (
    DELETE FROM public.invoices WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO _invoices_removed FROM del;

  WITH upd AS (
    UPDATE public.invoice_series SET last_number = 0, updated_at = now()
     WHERE restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO _series_reset FROM upd;

  PERFORM set_config('app.allow_invoice_reset', 'false', true);

  RETURN jsonb_build_object(
    'invoices_removed', _invoices_removed,
    'items_removed', _items_removed,
    'tax_rows_removed', _tax_removed,
    'series_reset', _series_reset
  );
END;
$$;
