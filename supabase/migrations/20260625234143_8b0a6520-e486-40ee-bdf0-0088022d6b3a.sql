DROP FUNCTION IF EXISTS public.issue_invoice_number(uuid, invoice_type);

CREATE OR REPLACE FUNCTION public.issue_invoice_number(_restaurant uuid, _type invoice_type)
RETURNS TABLE(series_id uuid, prefix text, v_year integer, v_seq integer, invoice_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _year integer := EXTRACT(YEAR FROM now())::int;
  _prefix text;
  _series_id uuid;
  _seq integer;
BEGIN
  SELECT COALESCE(NULLIF(r.invoice_series_prefix,''), UPPER(LEFT(COALESCE(NULLIF(r.commercial_name,''), r.name), 8)))
    INTO _prefix
    FROM public.restaurants r
    WHERE r.id = _restaurant;
  IF _prefix IS NULL OR _prefix = '' THEN _prefix := 'INV'; END IF;

  SELECT s.id INTO _series_id
    FROM public.invoice_series s
    WHERE s.restaurant_id = _restaurant
      AND s.year = _year
      AND s.type = _type
    FOR UPDATE;

  IF _series_id IS NULL THEN
    INSERT INTO public.invoice_series(restaurant_id, prefix, year, type, last_number)
      VALUES (_restaurant, _prefix, _year, _type, 0)
      RETURNING invoice_series.id INTO _series_id;
  END IF;

  UPDATE public.invoice_series s
    SET last_number = s.last_number + 1, updated_at = now()
    WHERE s.id = _series_id
    RETURNING s.last_number INTO _seq;

  RETURN QUERY SELECT
    _series_id,
    _prefix,
    _year,
    _seq,
    _prefix || '-' || _year::text || '-' || LPAD(_seq::text, 6, '0');
END $function$;