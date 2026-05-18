## Gestión de usuarios por restaurante

Añadir CRUD de usuarios por restaurante en el panel de administración, con relación N:M usuario↔restaurante, roles y estado por relación, y una edge function para crear usuarios de forma segura.

### 1. Base de datos

Nueva tabla `restaurant_users` (relación N:M):
- `user_id uuid` → `auth.users(id) ON DELETE CASCADE`
- `restaurant_id uuid` → `restaurants(id) ON DELETE CASCADE`
- `role` enum nuevo `restaurant_role` ('restaurant_admin', 'manager', 'waiter')
- `status` enum nuevo `restaurant_user_status` ('active', 'inactive') default 'active'
- `created_at`, `updated_at` timestamptz
- PRIMARY KEY (`user_id`, `restaurant_id`)
- Trigger `touch_updated_at`

Funciones SECURITY DEFINER:
- `is_restaurant_member(_user, _restaurant)` → bool (status='active')
- `has_restaurant_role(_user, _restaurant, _role)` → bool
- `get_user_restaurants(_user)` → tabla de restaurantes activos

RLS en `restaurant_users`:
- SELECT: `platform_admin` OR el propio usuario OR `restaurant_admin` del mismo restaurante.
- ALL: `platform_admin` OR `restaurant_admin` del mismo restaurante (manager/waiter denegado).

Backfill: insertar filas en `restaurant_users` para cada perfil existente con `restaurant_id` no nulo, mapeando el rol global de `user_roles` (admin→restaurant_admin, manager→manager, waiter→waiter), status='active'.

Nota: se mantiene `profiles.restaurant_id` como "restaurante activo por defecto" (compatibilidad con el código actual y `get_user_restaurant_id`). Se rellenará automáticamente al cambiar de restaurante en el selector.

### 2. Edge function `admin-create-user`

Necesaria porque crear usuarios requiere `SUPABASE_SERVICE_ROLE_KEY`.

- Verifica JWT del llamador.
- Comprueba que sea `platform_admin` o `restaurant_admin` del `restaurant_id` recibido.
- `restaurant_admin` no puede crear `restaurant_admin` para otro restaurante.
- Valida input con zod: `name`, `email`, `password` (min 8), `role`, `restaurant_id`, `status`.
- `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } })`.
- Si ya existe, reutiliza el usuario y solo inserta la relación.
- Inserta/actualiza `profiles` (name) y `restaurant_users`.

Edge function `admin-reset-password`:
- Mismas comprobaciones de permisos.
- `supabase.auth.admin.updateUserById(userId, { password })`.

### 3. UI — listado de restaurantes

Editar `src/pages/admin/Restaurants.tsx`:
- Añadir acción "Usuarios" en cada fila → navega a `/admin/restaurants/:restaurantId/users`.

### 4. Página de usuarios del restaurante

Nueva ruta `/admin/restaurants/:restaurantId/users` → `src/pages/admin/RestaurantUsers.tsx`:
- Cabecera con nombre del restaurante y botón "Crear usuario".
- Tabla: Nombre, Email, Rol, Estado, Acciones (Editar rol, Activar/Desactivar, Restablecer contraseña).
- Diálogo `RestaurantUserFormDialog` para crear/editar.
- Diálogo simple de reset password (campo nueva contraseña).
- Acceso restringido: `platform_admin` o `restaurant_admin` del mismo restaurante; en caso contrario mostrar "No tienes permisos para gestionar usuarios".

### 5. Selector de restaurante al iniciar sesión

- `TenantContext` (o `AuthContext`) carga `get_user_restaurants(user.id)` tras login.
- 0 restaurantes → mensaje "Tu cuenta no está asociada a ningún restaurante".
- 1 restaurante → fija `profiles.restaurant_id` y entra al dashboard.
- ≥2 restaurantes → ruta `/select-restaurant` con tarjetas; al elegir actualiza `profiles.restaurant_id` y navega a `/dashboard`.

### 6. Etiquetas en español

Todas las cadenas nuevas en es-ES (Usuarios, Crear usuario, Rol, Estado, Activo, Inactivo, Restaurante, "No tienes permisos para gestionar usuarios", etc.).

### 7. Archivos

Crear:
- migración `*_restaurant_users.sql`
- `supabase/functions/admin-create-user/index.ts`
- `supabase/functions/admin-reset-password/index.ts`
- `src/pages/admin/RestaurantUsers.tsx`
- `src/components/admin/RestaurantUserFormDialog.tsx`
- `src/pages/SelectRestaurant.tsx`
- `src/hooks/useUserRestaurants.ts`

Editar:
- `src/App.tsx` (rutas nuevas)
- `src/pages/admin/Restaurants.tsx` (acción Usuarios)
- `src/contexts/AuthContext.tsx` o `TenantContext.tsx` (carga de restaurantes del usuario + redirección)

### Notas técnicas

- `restaurant_admin` es el nuevo nombre por-relación; el rol global `admin` en `user_roles` se mantiene por compatibilidad pero ya no es la fuente de verdad para permisos por restaurante.
- Mantener `get_user_restaurant_id` apuntando al `profiles.restaurant_id` activo evita migrar todas las RLS existentes; el selector se encarga de cambiarlo.
- No se usa `service_role` desde el frontend; toda creación/reset pasa por edge function.
