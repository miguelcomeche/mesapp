# SaaS Multi-Tenant Refactor

Split Mesapp into two clean layers: **Platform Admin** (manages the SaaS) and **Restaurant Tenant** (daily operations). Each tenant starts empty and configures itself.

## 1. Platform Admin layer

- New `PlatformLayout` (separate from `MainLayout`) used by all `/admin/*` routes.
- Platform sidebar shows only: **Restaurantes**, **Usuarios globales** (placeholder), **Configuración plataforma** (placeholder).
- Guarded so only `platform_admin` can enter. On login, if user is `platform_admin` and has no active tenant context, redirect to `/admin/restaurants`.
- Hide all operational items (Carta, Plano, Pedidos, Cocina, Barra, Pagos, Reservas, Analítica) from this layer.

## 2. Restaurant Tenant layer

- Existing `MainLayout` becomes the tenant shell, scoped by the current `TenantContext` slug.
- Tenant sidebar: **Panel**, **Carta**, **Plano de Sala**, **Reservas**, **Pedidos**, **Cocina**, **Barra**, **Pagos**, **Analítica**, **Ajustes**.
- Ajustes submenu: **Mesas**, **Zonas**, **Usuarios**, **Impresoras** (placeholder), **Horarios** (placeholder), **Restaurante** (placeholder). Remove `Ajustes > Menú` (already done — verify).
- Module filtering: each sidebar entry checks `tenant.modules.*` and is hidden when disabled. Blocked routes render `"Este módulo no está activado para este restaurante."` via `ModuleGuard`.

## 3. Empty restaurants on creation

- `RestaurantFormDialog` create flow inserts ONLY: `restaurants` row + `restaurant_modules` row. No tables, no zones, no floor elements, no categories, no products, no modifiers, no "BARRA".
- Audit `restaurant-seed-demo` edge function — keep it only as an explicit opt-in for `type='demo'` restaurants triggered by the Sparkles button (already the case).
- Remove any client-side seeding that runs on first tenant load.

## 4. Restaurant creation flow

After creating a restaurant, offer (optional) to create the first **restaurant_admin** user inline (reuses `RestaurantUserFormDialog`).

## 5/6. Restaurant users

- Use existing `restaurant_users` table with roles `restaurant_admin | manager | waiter`.
- `/admin/restaurants/:restaurantId/users` already exists — verify create/role/activate/reset-password actions all work and are gated to `platform_admin` or `restaurant_admin` of that tenant.

## 7. Support / impersonation

- Add **"Entrar"** action (door icon) in `/admin/restaurants` row.
- Behavior: sets `tenantSlug` in localStorage + a `supportMode=true` flag, navigates to `/dashboard`.
- `MainLayout` reads `supportMode` and shows a sticky top banner: **"Modo soporte plataforma — {restaurant name}"** with a **"Salir de soporte"** button that clears the flag and returns to `/admin/restaurants`.
- Access permitted only when current user has `platform_admin` role.

## 8/9. Carta single source of truth

Already done in prior turn (sidebar entry removed, `/settings/menu` redirects to `/menu`). Verify Carta has the three tabs **Categorías / Productos / Modificadores**.

## 10. Zones and floor plan

Already implemented in prior turns — verify: creating a zone produces an empty tab; no auto elements; manual add of tables/bars/walls/etc. works.

## 11. Module filtering

Sidebar item-level gating in addition to route-level `ModuleGuard`. Helper: `useModuleEnabled(key)` per item.

## 12. Tenant isolation

Existing RLS already keys everything by `restaurant_id` via `get_user_restaurant_id`. For `platform_admin` support-mode, queries continue to use the impersonated tenant because membership / has_role policies already permit it (`platform_admin` bypasses most checks). No schema changes required.

## 13. Platform admin access

User `mcomecheterol@gmail.com` retains `platform_admin` role (already restored in prior migration). No further DB changes.

## 14. UI cleanup

Login already cleaned (demo credentials removed in prior turn). Verify.

## 15. Spanish UI

All new copy in es-ES.

---

## Technical implementation

**New / edited files:**

- `src/components/layout/PlatformLayout.tsx` *(new)* — platform shell with platform-only sidebar.
- `src/components/layout/Sidebar.tsx` — split into two render modes (`platform` vs `tenant`), or add a `variant` prop. Filter tenant items by `useModuleEnabled`.
- `src/contexts/SupportModeContext.tsx` *(new)* — exposes `{ isSupport, enter(restaurantId,slug), exit() }`, persisted to `localStorage`.
- `src/components/layout/SupportBanner.tsx` *(new)* — sticky banner shown when `isSupport`.
- `src/components/layout/MainLayout.tsx` — render `<SupportBanner/>` at top when active.
- `src/pages/admin/Restaurants.tsx` — add **Entrar** button (LogIn icon) that calls support enter + navigates. Use `PlatformLayout`.
- `src/pages/admin/RestaurantUsers.tsx` — wrap in `PlatformLayout`.
- `src/App.tsx` — redirect logic: on `/` for platform_admin with no tenant context → `/admin/restaurants`. Add `SupportModeContext` provider.
- `src/components/admin/RestaurantFormDialog.tsx` — confirm create path inserts only restaurant + modules (no seed). Add post-create prompt to add first admin user.
- `src/components/auth/ModuleGuard.tsx` — update fallback message to required Spanish copy.

**No DB migrations required** for this refactor (schema already supports it).

## Acceptance verification

After implementation I will manually walk through:
1. Create restaurant "Burger" → confirm zero rows in `tables`, `zones`, `floor_plan_elements`, `menu_items`, `modifier_groups` for that `restaurant_id`.
2. Add restaurant_admin user via the admin users page.
3. Click **Entrar** as platform admin → banner appears, sidebar switches to tenant.
4. Verify Carta is the sole menu management surface and `/settings/menu` redirects.
5. Disable a module → corresponding sidebar entry hides and route shows the Spanish blocked message.
