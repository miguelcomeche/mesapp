
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

  -- Unlink any invoice that rectifies this one
  UPDATE public.invoices SET rectifies_invoice_id = NULL WHERE rectifies_invoice_id = _invoice;

  ALTER TABLE public.invoices DISABLE TRIGGER trg_invoices_protect;
  DELETE FROM public.invoice_tax_breakdown WHERE invoice_id = _invoice;
  DELETE FROM public.invoice_items WHERE invoice_id = _invoice;
  DELETE FROM public.invoices WHERE id = _invoice;
  ALTER TABLE public.invoices ENABLE TRIGGER trg_invoices_protect;

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

  ALTER TABLE public.invoices DISABLE TRIGGER trg_invoices_protect;

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

  WITH del AS (
    DELETE FROM public.invoices WHERE restaurant_id = _restaurant RETURNING 1
  ) SELECT count(*) INTO _invoices_removed FROM del;

  ALTER TABLE public.invoices ENABLE TRIGGER trg_invoices_protect;

  WITH upd AS (
    UPDATE public.invoice_series SET last_number = 0, updated_at = now()
     WHERE restaurant_id = _restaurant
     RETURNING 1
  ) SELECT count(*) INTO _series_reset FROM upd;

  RETURN jsonb_build_object(
    'invoices_removed', _invoices_removed,
    'items_removed', _items_removed,
    'tax_rows_removed', _tax_removed,
    'series_reset', _series_reset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_invoicing(uuid) TO authenticated;
