This is a large scope (4 full modules). Proposing an organized phased plan before implementing.

## Phase 1 — Database schema (single migration)

New tables:
- `platform_settings` (singleton row): `platform_name`, `base_domain`, `support_email`, `maintenance_mode`, `allow_demo_restaurants`, branding.
- `restaurant_settings` extension on `restaurants`: add `city`, `postal_code`, `country`, `email`, `tax_id`, `logo_url`, `primary_color`, `secondary_color`. (`currency`, `timezone`, `address`, `phone`, `slug`, `status`, `type` already exist.)
- `restaurant_hours`: `restaurant_id`, `day_of_week` (0–6), `lunch_open`, `lunch_close`, `dinner_open`, `dinner_close`, `closed`.
- `restaurant_special_days`: `restaurant_id`, `date`, `closed`, `lunch_open`, `lunch_close`, `dinner_open`, `dinner_close`, `note`.
- `restaurant_reservation_settings`: `restaurant_id` (unique), `default_duration_minutes`, `buffer_minutes`, `max_online_party_size`, `max_lead_days`, `min_lead_minutes`.
- `printers`: `restaurant_id`, `name`, `type` (enum: browser_print|network|escpos|epson_epos), `ip_address`, `port`, `station` (enum: cocina|barra|tickets), `active`.

RLS:
- `platform_settings`: read by anyone authenticated; write only `platform_admin`.
- All restaurant-scoped tables: read by tenant members + platform_admin; write by `restaurant_admin`/`admin`/`platform_admin` (hours editable by manager too).
- `printers` write: restaurant_admin + platform_admin.

`profiles` already has `name`, `email`. Add `status` column ('active'|'inactive') and `last_sign_in_at` (synced via edge function or query from `auth.users`).

## Phase 2 — Platform Admin
- **`/admin/users`** new page: lists all profiles (via `list_global_users` SECURITY DEFINER RPC restricted to platform_admin), shows name/email/global roles (user_roles)/linked restaurants (restaurant_users)/status/last_sign_in. Search + role/status filters. Actions: edit modal, toggle active, grant/revoke `platform_admin`, reset password (reuse `admin-reset-password` edge function with platform_admin check).
- **User edit modal**: edit name/email/status/global roles.
- **`/admin/platform-settings`** new page: loads/saves `platform_settings` singleton row with sections (general, branding, security, mantenimiento, demo).
- New edge function `admin-list-users` (uses service role) to fetch auth.users last_sign_in_at + emails joined with profiles. Or a SECURITY DEFINER function reading `auth.users` (preferred — no new function needed if we expose via RPC).
- Route guards: `allowedRoles={['platform_admin']}` already enforced; add explicit redirect.

## Phase 3 — Ajustes > Restaurante (`/settings/restaurant`)
- Replace `ComingSoon` with full form: business info, slug (validated unique, lowercase, no spaces), status, type, address fields, contact, tax id, currency, timezone.
- Module toggles section: read/write `restaurant_modules` (TPV/Reservas/Reserva pública/Cocina-Barra/Analíticas/Tickets/Impresión).
- Branding: logo upload (new storage bucket `restaurant-branding`), primary/secondary color pickers (HSL stored).
- Role guard: `platform_admin`/`restaurant_admin` edit; `manager` view-only.
- After save: invalidate `TenantContext` so sidebar reflects changes.

## Phase 4 — Ajustes > Horarios (`/settings/hours`)
- Weekly grid (7 days) with lunch & dinner intervals + cerrado toggle. Saves to `restaurant_hours`.
- Special days table with add/edit/delete (date picker, closed toggle, custom intervals, note).
- Reservation settings card (5 fields). Saves to `restaurant_reservation_settings`.
- Editable by platform_admin/restaurant_admin/manager.

## Phase 5 — Ajustes > Impresoras (`/settings/printers`)
- CRUD table for `printers` (name, type, ip:port, station, active).
- "Probar impresión" button: opens dialog with sample ticket HTML preview (no real network printing — just rendered preview suitable for browser_print).
- Product routing: extend `category_settings` with `default_station` (cocina|barra) — already partially supported via `auto_marchar_station`; add a clean "Routing por categoría" subsection so admins map categories → station.

## Phase 6 — Sidebar/Routing wiring
- `Sidebar.tsx` platform variant: link `/admin/users` and `/admin/platform-settings` to new pages.
- `Sidebar.tsx` tenant variant: ensure Ajustes shows Mesas, Usuarios, Impresoras, Horarios, Restaurante; gate by role.
- `App.tsx`: replace `ComingSoon` routes with new pages.

## Files to create
- `supabase/migrations/<new>.sql` (Phase 1)
- `src/pages/admin/GlobalUsers.tsx`, `src/pages/admin/PlatformSettings.tsx`
- `src/components/admin/GlobalUserEditDialog.tsx`
- `src/pages/settings/RestaurantSettings.tsx`
- `src/pages/settings/HoursSettings.tsx`
- `src/pages/settings/PrintersSettings.tsx`
- `src/components/settings/PrinterFormDialog.tsx`, `TestPrintDialog.tsx`
- `src/hooks/usePlatformSettings.ts`, `useRestaurantHours.ts`, `usePrinters.ts`, `useGlobalUsers.ts`
- Optional edge function `admin-list-users` (service-role) if RPC approach blocked.

## Files to edit
- `src/App.tsx` (routes)
- `src/components/layout/Sidebar.tsx` (entries)
- `src/contexts/TenantContext.tsx` (refetch on settings save)

## Scope warning
This is ~15+ new files plus a substantial migration. It will take a long single turn. Please confirm to proceed, or tell me which phase(s) to do first (recommended order: 1 → 3 → 4 → 5 → 2).