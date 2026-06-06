## Objetivo

Convertir el plano de sala en un editor avanzado y permitir agrupar mesas físicamente y operativamente en una sola unidad de servicio.

---

## 1. Transformaciones para todos los elementos

Aplicable a: **mesas**, **barras**, **paredes**, **separadores**, **zonas**, **decoraciones** y **texto**.

- **Drag**: ya existe; se mantiene.
- **Resize**: 8 handles (esquinas + lados) en modo edición. Ancho/alto en píxeles del canvas, con mínimos por tipo (mesa 40×40, pared 20×20, etc.).
- **Rotación**:
  - Botones rápidos `+90°` y `-90°` en la toolbar de selección.
  - Handle visual de rotación libre (círculo arriba del elemento) con snap cada 15° si se mantiene Shift.
- Las mesas ya tienen `position_x/y`; añadiremos `width`, `height`, `rotation` (igual que `floor_plan_elements`). Los demás elementos ya los tienen.

## 2. Sistema de capacidad (mesas)

Reemplaza el `capacity` único por:

- `min_capacity` (por defecto 1)
- `default_capacity` (lo que hoy es `capacity`)
- `max_capacity` (por defecto = default)

Se mantiene `capacity` como columna generada/espejo de `default_capacity` para no romper consumidores existentes en esta iteración.

Tope global: **50** (validación en cliente + check constraint).

UI de Ajustes > Mesas y diálogo "Añadir mesa" exponen los tres valores.

## 3. Combinación de mesas (sesión única compartida)

### Datos

Nueva tabla `table_groups`:

- `id`, `restaurant_id`, `name` (autogenerado "10+11+12"),
- `min_capacity`, `default_capacity`, `max_capacity` (suma de las mesas miembro),
- `active_session_id` (nullable → FK a `table_sessions`),
- `created_at`, `updated_at`.

Nueva columna en `tables`: `group_id uuid` (nullable, FK a `table_groups`).

Reglas SQL (trigger):

- Una mesa pertenece como máximo a 1 grupo.
- Al insertar/borrar miembros, recalcular `name` y capacidades en el grupo.
- `default_capacity` del grupo se valida ≤ 50.

### Comportamiento operativo

- En modo edición: multi-selección con click + Shift / lasso. Botón `Combinar mesas` cuando hay ≥2 mesas seleccionadas, sin grupo previo y de la misma zona.
- En modo operación, una mesa con `group_id`:
  - Se renderiza como **una sola tarjeta** posicionada en el bounding-box de las mesas miembro.
  - Muestra `nombre combinado` + `aforo combinado` + estado de la sesión compartida.
  - Al abrir, **crea una única `table_sessions`** vinculada al grupo (via `table_id` de cualquiera de las mesas + `group_id` en una nueva columna de `table_sessions`).
  - Todas las mesas miembro reflejan ese estado (ocupada / cuenta abierta / cobrada).
  - Pagos, KDS y pedidos consumen esa única sesión sin cambios funcionales.
- `Separar mesas` libera el grupo: borra `table_groups`, limpia `group_id` en las mesas y restaura sus capacidades originales. Bloqueado si hay sesión abierta.

### Cambios mínimos en sesiones

`table_sessions` añade `group_id uuid` (nullable). El hook `useTableSessions` agrupa las mesas por `group_id` para presentación y enruta acciones a la sesión del grupo.

## 4. UI

- Toolbar de selección con: rotar ±90°, duplicar, eliminar, traer al frente/enviar atrás (ya existe), y `Combinar`/`Separar` según contexto.
- Handles de resize/rotación con feedback visual (cursor, badge con dimensiones / ángulo).
- En el plano operativo, mesa combinada con badge `10+11+12 · 8 pax`.

## 5. Compatibilidad con reservas

- `SeatReservationFloorDialog` y `SeatReservationDialog` aceptan grupos: capacidad efectiva = `group.default_capacity` cuando existe.
- Helper SQL `suggest_table_combinations(restaurant_id, party_size, zone)` opcional (solo si entra holgado en esta iteración; si no, queda con un comentario `TODO reservas`).
- Persistencia lista: las reservas pueden seatearse contra un grupo igual que contra una mesa.

## 6. Limpieza

- Quita el límite duro `max=20` del diálogo actual; aplica 1–50.
- Migración añade defaults seguros para mesas existentes (`min=1`, `max=default`).

---

## Detalles técnicos

### Migración SQL

1. `ALTER TABLE public.tables` — añadir `min_capacity`, `max_capacity`, `width`, `height`, `rotation`, `group_id`, índices y checks (`min ≤ default ≤ max ≤ 50`).
2. `CREATE TABLE public.table_groups (...)` + GRANTs + RLS scoping por `restaurant_id` (mismas políticas que `tables`).
3. Trigger `recalc_table_group()` recalcula nombre y capacidades al cambiar miembros.
4. `ALTER TABLE public.table_sessions ADD COLUMN group_id uuid REFERENCES public.table_groups(id)`.
5. RPCs `combine_tables(_restaurant uuid, _table_ids uuid[])` y `split_table_group(_group uuid)` (SECURITY DEFINER, manager/admin).

### Frontend

- `useFloorPlanElements` / `useRestaurantData`: incluir `group_id`, devolver mesas agrupadas.
- Nuevo componente `TransformWrapper` (resize + rotate handles) reutilizado por `FloorPlanTable` y `FloorElement`.
- `FloorPlanCanvas`: gestor de selección múltiple + toolbar.
- `OpenTableDialog`, `TableSessionView`, `Payments`, `KDS`: usar `effectiveCapacity` y `displayName` derivados (mesa o grupo).
- Tipos en `src/types/database.ts` extendidos.

### Estado fuera de alcance (explícito)

- Drag/resize colaborativo en tiempo real.
- Reservas que **autoseleccionan** combinaciones (queda el helper SQL listo pero la UI sugerida se entregará después).
- Migrar `capacity` legacy a columna generada se hace en esta iteración para no romper consumidores.

---

## Riesgos

- Tocar `table_sessions` afecta pagos y KDS; añadiremos `group_id` opcional y no romperemos el flujo existente.
- Multi-select + transformaciones en el mismo canvas requiere cuidado con eventos (pointerdown vs click) para no inhibir el drag actual.

## Validación

- Editar capacidad min/default/max y comprobar persistencia.
- Rotar ±90° y libre, redimensionar, sobre cada tipo de elemento.
- Combinar 2 y 3 mesas; abrir sesión; pagar; cerrar; comprobar que Cocina/Barra reciben pedidos como una sola mesa.
- Separar combinación; comprobar que capacidades originales se restauran.
- Comprobar que reservas pueden seatearse contra el grupo.