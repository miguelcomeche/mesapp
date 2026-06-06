# Módulo de Analíticas V1 — Mesapp

Construir una página de Analíticas profesional, orientada a decisiones operativas. Toda la lógica se calcula en cliente a partir de las tablas existentes (`table_sessions`, `orders`, `order_items`, `payments`, `menu_items`, `tables`), respetando el restaurante activo del `TenantContext` y los permisos de rol.

## Estructura general

Ruta: `/analytics` (ya existe, hoy muestra `ComingSoon`). Se sustituye por la nueva página `src/pages/Analytics.tsx`. Se reusa `MainLayout` y el sistema de tokens actual.

Permisos:
- `platform_admin`, `admin` (restaurant_admin): acceso completo + exportación.
- `manager`: solo lectura (sin botones de exportación opcional).
- `waiter`: bloqueado por `ProtectedRoute` (`allowedRoles: ['admin','manager','platform_admin']`).

## Filtros globales (barra superior sticky)

Componente `AnalyticsFilters` con presets: Hoy, Ayer, Últimos 7 días, Últimos 30 días, Este mes, Mes anterior, Este año, Personalizado (date range picker). El estado vive en `Analytics.tsx` y se pasa a los bloques.

Para Platform Admin se muestra además un selector `Restaurante activo / Todos los restaurantes` (en V1 "Todos" queda deshabilitado con tooltip "Próximamente — consolidación multi-restaurante"). La arquitectura del hook `useAnalytics` ya recibirá `restaurantIds: string[]` para consolidar en el futuro.

## Capa de datos: `src/hooks/useAnalytics.ts`

Un solo hook con React Query que dado `{ restaurantId, from, to }` hace en paralelo:
- `table_sessions` cerradas en el rango (con `started_at`, `closed_at`, `guests`, `table_id`, `total_amount`).
- `orders` + `order_items` (no canceladas) unidos por `session_id`.
- `payments` agregados por sesión.
- `menu_items` y `tables` para nombres/categorías.

Devuelve objetos derivados memoizados:
- `kpis`: facturación, ticket medio, mesas cerradas, comensales, tiempo medio, hora punta.
- `salesByDay`, `salesByHour`.
- `productsByRevenue`, `productsByUnits`, `topProduct`.
- `categoriesBreakdown`.
- `tablesRanking`, `tableAvgTime`, `tableAvgTicket`.
- `comparisons`: hoy vs ayer, semana vs semana anterior, mes vs mes anterior (segunda query con rango anterior equivalente).

Preparado para futuras dimensiones (camarero, partida, impresora, food cost) exponiendo el dataset crudo en `raw` para nuevos selectores sin reescribir queries.

## Bloques visuales

Componentes en `src/components/analytics/`:

1. `KpiGrid` — 6 tarjetas (reutiliza `MetricCard`): Facturación, Ticket medio, Mesas cerradas, Comensales, Tiempo medio mesa, Hora punta (con franja + importe).
2. `SalesTrendChart` — Recharts `LineChart`/`BarChart` con toggle Día/Semana/Mes.
3. `ProductsBlock` — Tabs (Por facturación / Por unidades) con tabla TOP 20 + tarjeta destacada `TopProductCard`.
4. `CategoriesBlock` — `PieChart` + tabla de ranking de categorías.
5. `HourlySalesChart` — `BarChart` por hora (0–23, recortado al rango con datos).
6. `TablesBlock` — Tres mini-tablas: ranking facturación, tiempo medio, ticket medio.
7. `ComparisonsBlock` — Tarjetas Hoy vs Ayer / Semana / Mes con flecha verde/roja y %.
8. `ExportBar` — Botones PDF, Excel, CSV (PDF y Excel via `jspdf`/`xlsx` ya disponibles si están instaladas; si no, se usa CSV nativo + impresión del DOM para PDF).

## Diseño

- Mantener tokens HSL existentes (`bg-card`, `text-foreground`, `text-muted-foreground`, `primary`).
- Layout: grid responsive (1 col móvil, 2–3 col desktop). Primer viewport debe enseñar KPIs + tendencia + top productos.
- Tipografía y espaciados idénticos al Dashboard actual.

## Navegación

Se actualiza `Sidebar` solo si "Analíticas" no aparece ya enlazado a `/analytics` (verificar). La ruta en `App.tsx` mantiene `ModuleGuard module="analytics_enabled"`.

## Detalles técnicos

- Sin cambios de esquema: todo se calcula desde tablas existentes.
- Dependencias: `recharts` (ya presente para charts del dashboard), `date-fns` (ya presente). Para exportación XLSX se añadirá `xlsx` y para PDF `jspdf` + `jspdf-autotable` solo si no existen.
- Cálculo de "hora punta": agrupar `payments` (o `total_amount` de sesión repartido por `started_at`) por hora y elegir la franja de 1h con mayor importe.
- Tiempo medio mesa: media de `closed_at - started_at` en minutos.
- Comparativas: se ejecuta segundo fetch con rango previo de la misma duración.

## Preparación futura (no implementar)

`useAnalytics` expone `raw.sessions`, `raw.orderItems`, `raw.payments`, dejando hueco para añadir selectores por `waiter_id`, `production_station_id`, `printer_id`, y métricas de coste cuando existan escandallos. La firma del hook acepta `groupBy?: 'waiter'|'station'|'printer'` reservado.

## Archivos a crear/editar

- `src/pages/Analytics.tsx` (nuevo, sustituye ComingSoon en la ruta)
- `src/hooks/useAnalytics.ts` (nuevo)
- `src/components/analytics/*` (KpiGrid, SalesTrendChart, ProductsBlock, CategoriesBlock, HourlySalesChart, TablesBlock, ComparisonsBlock, AnalyticsFilters, ExportBar, TopProductCard)
- `src/App.tsx` — apuntar `/analytics` a la nueva página
- `src/lib/analytics.ts` — utilidades puras (agrupaciones, formateo €, formateo duración)
