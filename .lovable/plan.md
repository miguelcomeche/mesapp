## Goal

Make new restaurants start with a completely empty floor plan and let Owners/Admins add and edit both **tables** (operational) and **visual elements** (decorative: barra, paredes, separadores, texto, zonas, decoración) directly on the plan.

## 1) Remove default BARRA

`src/components/floor/FloorPlanCanvas.tsx` currently hard-codes a `BARRA` block in the Interior zone. Remove that block entirely so it doesn't appear on any restaurant.

The default grid auto-positioning for tables without `position_x/y` stays as fallback, but no extra visual element is injected by code.

## 2) New table: `floor_plan_elements`

```sql
create type floor_element_type as enum
  ('bar','wall','separator','text','zone_block','decoration');

create table floor_plan_elements (
  id uuid pk default gen_random_uuid(),
  restaurant_id uuid not null,
  zone text not null default 'Interior',     -- 'Interior' | 'Terraza'
  type floor_element_type not null,
  label text,
  x int not null default 0,
  y int not null default 0,
  width int not null default 120,
  height int not null default 40,
  rotation int not null default 0,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

RLS:
- SELECT: any member of the restaurant (`is_restaurant_member` or `get_user_restaurant_id` match).
- INSERT/UPDATE/DELETE: `platform_admin`, `restaurant_admin`, or legacy `admin`/`manager` role for backwards compat.

Trigger `touch_updated_at` on update.

No seed rows — table is empty for every restaurant (new and existing).

## 3) Frontend

New hook `useFloorPlanElements(restaurantId, zone)` with `fetch`, `create`, `update`, `remove`, `duplicate`.

Rewrite `FloorPlanCanvas.tsx`:

- Toolbar (only when `canEditTables`) with: Editar plano / Guardar / Cancelar, and in edit mode: **Añadir mesa, Añadir barra, Añadir pared, Añadir separador, Añadir texto, Añadir zona, Eliminar, Duplicar**.
- Render visual elements as absolutely-positioned divs styled per `type` (bar = muted box with label, wall = thick line, separator = thin line, text = label only, zone_block = translucent rectangle, decoration = small circle/icon).
- Visual elements are pointer-events: none in normal mode (not clickable). Tables remain clickable -> opens session as today.
- In edit mode: both tables and elements are draggable; selected element shows resize handles (corner) and a rotate handle for elements that support it; Delete/Duplicate apply to selection.
- "Añadir mesa" prompts for number + capacity + section and inserts into `tables` at center of canvas with a default position.
- Save persists all local diffs in one batch.
- Empty state message when no tables and no elements: *"El plano está vacío. Pulsa 'Editar plano' para añadir mesas y elementos."*

Permission gate: use `usePermissions().canEditTables` (Owner/Manager) for entering edit mode — already wired.

## 4) Files

- **Migration**: create `floor_plan_elements` + enum + RLS + trigger.
- **New**: `src/hooks/useFloorPlanElements.ts`, `src/components/floor/FloorElement.tsx`, `src/components/floor/AddTableDialog.tsx`.
- **Edit**: `src/components/floor/FloorPlanCanvas.tsx` (remove BARRA, add toolbar + element rendering + edit interactions), `src/pages/Floor.tsx` (empty-state copy in map view).
- **Types**: extend `src/types/database.ts` with `FloorPlanElement` + `FloorElementType`.

## 5) Acceptance

- Brand-new restaurant: `tables` and `floor_plan_elements` both empty → canvas shows empty-state message, no BARRA.
- Edit mode → "Añadir barra" inserts a bar element; drag to position; Guardar persists.
- Select bar → Eliminar removes it.
- "Añadir mesa" creates a table; in normal mode clicking it opens a session.
- Existing restaurants keep their tables; the old hard-coded BARRA simply disappears (it was never persisted), and admins can recreate one manually if desired.
