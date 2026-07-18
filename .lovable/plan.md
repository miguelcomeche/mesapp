## 1) Botón "Limpiar pantalla" en KDS

### Base de datos (migración)
Nueva función RPC `public.clear_closed_kitchen_tickets(_restaurant uuid) RETURNS integer` con `SECURITY DEFINER`:

- Comprueba permisos: solo `platform_admin`, `restaurant_admin` o `manager` del restaurante indicado. En otro caso, `RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'`.
- **NO borra `order_items`.** Solo hace `UPDATE public.order_items SET status = 'served'` cuando:
  - la sesión de la mesa asociada tiene `status = 'closed'`,
  - el `status` actual está en (`pending`, `sent`, `preparing`, `ready`),
  - `restaurant_id` coincide con el parámetro.
- Devuelve el número de filas afectadas (`GET DIAGNOSTICS ... ROW_COUNT`).
- Nunca toca mesas `active` ni `billing`, así que las comandas en pleno servicio se respetan.
- No modifica `kitchen_tickets` directamente: al pasar los items a `served`, el hook `useKitchenTickets` ya los oculta.

### Interfaz (`src/pages/Kitchen.tsx`)
- Botón "Limpiar pantalla" en la cabecera, visible solo si el usuario es `admin`, `manager` o `platform_admin` (usa `usePermissions` / `hasRole`).
- Al pulsar, `AlertDialog` de confirmación con texto explicativo: "Se retirarán de la pantalla las comandas de mesas ya cerradas y cobradas. No se borra ningún dato: los productos siguen intactos en cuentas, cobros, facturas y analíticas."
- Al confirmar: `supabase.rpc('clear_closed_kitchen_tickets', { _restaurant: restaurantId })`, toast con "N comandas retiradas" y refetch de la lista.

---

## 2) Ajuste "Este local no usa KDS"

### Base de datos (misma migración)
- `ALTER TABLE public.restaurants ADD COLUMN uses_kds boolean NOT NULL DEFAULT true;`
  - Valor por defecto `true` → ningún restaurante existente cambia de comportamiento.
- Función trigger `public.order_items_auto_serve_when_no_kds()`:
  - `BEFORE INSERT OR UPDATE OF status ON public.order_items FOR EACH ROW`.
  - Lee `uses_kds` del `restaurants` asociado (vía `orders → table_sessions → restaurant_id`).
  - Si `uses_kds = false` y `NEW.status IN ('pending','sent')`, sustituye por `'served'` y marca `served_at = now()` si es null.
- Al pasar a `served` antes del insert, el flujo de `kitchen_tickets` no crea tickets pendientes en la pantalla (o se cierran de inmediato).

### Interfaz (`src/pages/settings/RestaurantSettings.tsx`)
- Nuevo `Switch` "Usar pantalla de cocina (KDS)" con descripción:
  > "Si lo desactivas, la pantalla de cocina de este local quedará vacía permanentemente y las comandas solo saldrán por impresora. Los productos siguen registrándose normalmente para cuentas y facturación."
- Guarda `uses_kds` en `restaurants`. Visible para `admin` / `restaurant_admin`.

---

## SQL resumido de la migración

```sql
-- 1) columna uses_kds
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS uses_kds boolean NOT NULL DEFAULT true;

-- 2) RPC limpiar pantalla
CREATE OR REPLACE FUNCTION public.clear_closed_kitchen_tickets(_restaurant uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'platform_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'restaurant_admin')
    OR public.has_restaurant_role(auth.uid(), _restaurant, 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  UPDATE public.order_items oi
     SET status='served', served_at = COALESCE(oi.served_at, now())
    FROM public.orders o
    JOIN public.table_sessions ts ON ts.id = o.session_id
   WHERE oi.order_id = o.id
     AND ts.restaurant_id = _restaurant
     AND ts.status = 'closed'
     AND oi.status IN ('pending','sent','preparing','ready');
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- 3) trigger auto-serve cuando uses_kds = false
CREATE OR REPLACE FUNCTION public.order_items_auto_serve_when_no_kds()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _uses_kds boolean;
BEGIN
  IF NEW.status NOT IN ('pending','sent') THEN RETURN NEW; END IF;
  SELECT r.uses_kds INTO _uses_kds
    FROM public.orders o
    JOIN public.table_sessions ts ON ts.id = o.session_id
    JOIN public.restaurants r ON r.id = ts.restaurant_id
   WHERE o.id = NEW.order_id;
  IF _uses_kds IS FALSE THEN
    NEW.status := 'served';
    IF NEW.served_at IS NULL THEN NEW.served_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_items_auto_serve_no_kds ON public.order_items;
CREATE TRIGGER trg_order_items_auto_serve_no_kds
BEFORE INSERT OR UPDATE OF status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.order_items_auto_serve_when_no_kds();
```

Confírmame y aplico migración + cambios de UI.
