
ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS stations text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.printers
SET stations = ARRAY[
  CASE station::text
    WHEN 'tickets' THEN 'ticket_cliente'
    ELSE station::text
  END
]
WHERE (stations IS NULL OR array_length(stations, 1) IS NULL);

ALTER TABLE public.printers
  ADD CONSTRAINT printers_stations_valid
  CHECK (
    stations <@ ARRAY['cocina','barra','ticket_cliente','cancelaciones','cierre_caja']::text[]
  );
