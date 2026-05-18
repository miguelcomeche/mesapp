## Multi-restaurant architecture for Mesapp

Implement tenant-based multi-restaurant support with per-restaurant module configuration, a global admin area, subdomain resolution, and navigation/route filtering.

### 1. Database changes (migration)

Extend `restaurants` table:
- `slug` text unique (lowercase)
- `status` enum `restaurant_status` ('active', 'inactive') default 'active'
- `type` enum `restaurant_type` ('production', 'demo') default 'production'
- `updated_at` timestamptz default now()

New table `restaurant_modules` (1:1 with restaurant):
- `restaurant_id` uuid PK/unique → restaurants
- `pos_enabled` bool default true
- `reservations_enabled` bool default false
- `public_booking_enabled` bool default false
- `menu_enabled` bool default true
- `payments_enabled` bool default true
- `kitchen_bar_enabled` bool default false
- `analytics_enabled` bool default false
- `tickets_enabled` bool default false
- `printing_enabled` bool default false
- timestamps

Add new user role `platform_admin` to the `user_role` enum (global super-admin separate from restaurant admin).

RLS:
- `restaurants`: keep existing; add policy for `platform_admin` full CRUD; allow SELECT by slug publicly (for tenant resolution) OR via security-definer function `get_restaurant_by_slug`.
- `restaurant_modules`: SELECT for users whose `restaurant_id` matches OR `platform_admin`; ALL for `platform_admin` and restaurant admins of that restaurant.

Seed:
- Update existing "Santa Chiara Blanquerna" with `slug='santachiara'`, type='production', and insert modules row (pos, menu, payments, reservations, public_booking, kitchen_bar, tickets enabled).
- Create "Demo Mesapp" restaurant with `slug='demo'`, type='demo', all modules enabled.

Backfill `restaurant_modules` for all existing restaurants with defaults.

### 2. Tenant resolution

New `src/contexts/TenantContext.tsx`:
- Parses `window.location.hostname` → extracts subdomain (`{slug}.mesapp.com`, `{slug}.lovable.app`).
- Local/preview fallback: reads `?tenant=slug` query param or `localStorage.tenantSlug`, defaulting to `santachiara`.
- Fetches restaurant + modules via Supabase, exposes `{ restaurant, modules, isLoading }`.
- Wraps app inside `AuthProvider`.

New hook `useTenant()` and `useModuleEnabled(moduleKey)`.

### 3. Navigation filtering

Update `src/components/layout/Sidebar.tsx` to read `useTenant().modules` and conditionally hide:
- Reservas (reservations_enabled)
- Cocina, Barra (kitchen_bar_enabled)
- Analítica (analytics_enabled)
- Tickets-related (tickets_enabled)

### 4. Route protection

New `src/components/auth/ModuleGuard.tsx`:
- Wraps a route; if module flag is disabled, renders message "Este módulo no está activado para este restaurante."
- Apply to `/reservations`, `/kitchen`, `/bar`, `/analytics`, etc. in `App.tsx`.

### 5. Global admin area

New role check `usePlatformAdmin()` via `has_role(user, 'platform_admin')`.

New page `src/pages/admin/Restaurants.tsx`:
- Table: nombre, slug, URL preview (`https://{slug}.mesapp.com`), estado, tipo, módulos activos (chips), acciones (Editar, Activar/Desactivar, Abrir).
- "Crear restaurante" button → dialog with name, slug, type, status, module toggles.
- Edit dialog reuses same form.
- Activar/Desactivar toggles `status`.
- Abrir → opens `https://{slug}.mesapp.com` in new tab (or `?tenant=slug` in dev).

Add route `/admin/restaurants` protected by `platform_admin` role.
Add sidebar entry "Restaurantes (Admin)" only visible to platform admins.

### 6. Data scoping

Existing tables already include `restaurant_id` and RLS via `get_user_restaurant_id`. No changes needed beyond ensuring new entities follow the same pattern. Add note in security memory.

### 7. Files to create/edit

Create:
- `supabase/migrations/<ts>_multitenant.sql`
- `src/contexts/TenantContext.tsx`
- `src/hooks/useTenant.ts`
- `src/components/auth/ModuleGuard.tsx`
- `src/pages/admin/Restaurants.tsx`
- `src/components/admin/RestaurantFormDialog.tsx`

Edit:
- `src/App.tsx` (TenantProvider, ModuleGuard on routes, /admin/restaurants route)
- `src/components/layout/Sidebar.tsx` (module filtering + admin entry)
- `src/types/database.ts` (Restaurant fields + RestaurantModules + UserRole 'platform_admin')

### Notes

- All UI labels in Spanish.
- Slug input validated `^[a-z0-9-]+$`.
- Subdomain parser ignores `www`, `id-preview--*`, raw `lovable.app` apex.
- Tenant fetch uses anon-readable SELECT via a security-definer RPC `get_tenant_by_slug` returning restaurant + modules (so unauthenticated subdomain visitors can still resolve tenant for the future public booking page).
