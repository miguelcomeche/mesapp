# Diseñador de Tickets — Plan

Build a per-restaurant visual ticket template builder for thermal printers (58/80mm), with 4 template kinds, a drag & drop block editor, live preview, and an Epson ePOS–ready schema.

## Scope

### New route
- `/settings/printing/ticket-designer` (under Ajustes > Impresión)
- Adds a sidebar entry "Diseñador de Tickets" within the existing Impresión section.

### Template kinds (per restaurant)
- `customer` — Ticket Cliente
- `kitchen` — Ticket Cocina
- `bar` — Ticket Barra
- `delivery` — Ticket Delivery

Each restaurant has exactly one active template per kind (uniqueness enforced). Defaults are auto-seeded the first time the designer opens for a restaurant.

### Layout (3 columns)

```text
┌────────────┬──────────────────────┬─────────────────┐
│ Bloques    │  Lienzo (reordenable)│ Vista previa    │
│ (paleta)   │  drag & drop         │ 80mm / 58mm     │
└────────────┴──────────────────────┴─────────────────┘
```

- **Left** — palette of available blocks. Click to append, or drag onto canvas.
- **Center** — vertical list of blocks. Reorder via drag handles (dnd-kit). Each block is selectable; selection opens its inline settings (align, bold, font size, content for `text`, QR type/url, toggles like `show_prices`, `show_logo`).
- **Right** — sticky thermal-paper preview (paper width 58/80mm) rendered with mock data so the user sees a realistic ticket. Re-renders on every change.

### Block types
`logo`, `text`, `separator`, `restaurant_info`, `table_info`, `waiter_info`, `datetime`, `ticket_number`, `order_items`, `totals`, `payment_method`, `qr`, `barcode`, `footer`.

Each block: `{ id, type, settings: { align, bold, font_size, ...type-specific } }`.

### Variables (rendered in preview + at print time)
`{{restaurant_name}}`, `{{restaurant_address}}`, `{{restaurant_phone}}`, `{{restaurant_tax_id}}`, `{{table_name}}`, `{{waiter_name}}`, `{{ticket_number}}`, `{{date_time}}`, `{{order_items}}`, `{{subtotal}}`, `{{tax}}`, `{{total}}`, `{{payment_method}}`.

A shared resolver `renderTemplate(blocks, ctx)` substitutes variables and produces both the preview HTML and a normalized command list ready to map to Epson ePOS later.

### QR options
`google_reviews | instagram | website | custom`. Builder stores the type plus a URL (auto-filled from `restaurants.google_reviews_url` / `instagram_url` / `website` when present; editable). Rendered in preview using `qrcode.react`.

### Template-level settings
`paper_width` (58/80), default `font_size`, default `align`, `bold` default, `show_logo`, `show_prices`.

### Actions
- **Guardar** — upsert template.
- **Duplicar** — copy current to new name/kind.
- **Restaurar por defecto** — replace blocks with the default for that kind.
- **Vista previa** — opens a modal with full-size mock ticket.
- **Imprimir prueba** — calls a stub `printTestTicket()` that for now opens the browser print dialog with the rendered HTML. Real Epson ePOS integration ships later behind the same call.

### Permissions
- `platform_admin`: read/write all restaurants' templates (uses active tenant context).
- `restaurant_admin`: read/write own restaurant's templates.
- `manager` / `waiter`: no access to the designer.

RLS uses existing helpers (`has_role`, `has_restaurant_role`, `is_restaurant_member`) and the active restaurant comes from `useAuth().restaurantId` (tenant-aware after the previous fix).

## Technical details

### Database migration
New table `public.ticket_templates`:
- `restaurant_id uuid not null`
- `kind text not null check in ('customer','kitchen','bar','delivery')`
- `name text not null`
- `paper_width smallint not null default 80` (58 or 80)
- `settings jsonb not null default '{}'` — default font size/align/bold, show_logo, show_prices
- `blocks jsonb not null default '[]'` — ordered array of block objects
- `is_default boolean not null default false`
- `active boolean not null default true`
- `created_at`, `updated_at`
- unique `(restaurant_id, kind)` for the active template
- GRANTs to `authenticated` + `service_role`; RLS:
  - SELECT: platform_admin OR `is_restaurant_member(auth.uid(), restaurant_id)`
  - ALL (write): platform_admin OR `has_restaurant_role(... , 'restaurant_admin')`

### Files added
- `supabase/migrations/<ts>_ticket_templates.sql`
- `src/types/tickets.ts` — block + template types, defaults per kind
- `src/lib/ticketRender.tsx` — `renderBlocks(blocks, ctx)` → preview JSX; `renderToCommands(blocks, ctx)` → normalized command list (text/align/bold/cut/qr/barcode) for future Epson ePOS adapter
- `src/lib/ticketMockData.ts` — realistic sample context per kind
- `src/hooks/useTicketTemplates.ts` — fetch/upsert/duplicate/reset, scoped to active `restaurantId`
- `src/components/printing/BlockPalette.tsx`
- `src/components/printing/BlockEditorCanvas.tsx` (uses `@dnd-kit/core` + `@dnd-kit/sortable` — already in stack; add if missing)
- `src/components/printing/BlockSettingsPanel.tsx`
- `src/components/printing/ThermalPreview.tsx` (58/80mm paper, monospace, mock data)
- `src/components/printing/TemplateToolbar.tsx` (kind tabs, save/duplicate/reset/preview/test print)
- `src/pages/settings/TicketDesigner.tsx`

### Files edited
- `src/App.tsx` — route `/settings/printing/ticket-designer` guarded for `platform_admin` + `restaurant_admin`
- `src/components/layout/Sidebar.tsx` — entry under Ajustes > Impresión
- `src/pages/settings/PrintersSettings.tsx` — link/CTA to the new designer

### Epson ePOS readiness
`renderToCommands` outputs a stable IR (`{ op: 'text'|'align'|'bold'|'feed'|'cut'|'qr'|'barcode'|'image', ... }`). A later `EpsonEposAdapter` will translate that IR to ePOS XML/Builder calls without touching the editor.

## Out of scope (intentional)
- Real device printing (stub uses browser print).
- Multiple templates per kind (one active per kind for now; "duplicar" creates a draft you can promote later).
- Per-station overrides beyond the 4 kinds.

## Acceptance
- Admin opens designer → sees 4 kind tabs, defaults loaded.
- Drag/reorder blocks → preview updates live.
- Change paper width → preview width changes.
- Save → reload preserves layout.
- Switch active restaurant → designer loads that restaurant's templates only.
- Manager/waiter cannot reach the route.
