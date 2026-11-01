# Mesapp — auditoría de permisos de superadmin (sin despliegue)

## Evidencia
- Captura del backend: `user_roles` tiene RLS habilitado.
- Política `Admins can manage roles`: `USING has_role(auth.uid(), 'admin'::user_role)`.
- Cuenta del operador: `platform_admin`; por tanto, esta política no autoriza por sí sola las escrituras del superadmin.
- `GlobalUserEditDialog.tsx` actualizaba `profiles`, borraba todos los roles y los reinsertaba. La eliminación ignoraba errores y podía dejar el usuario sin roles.

## Cambio preparado
La rama `fix/superadmin-user-roles-audit` modifica solo `GlobalUserEditDialog.tsx` para añadir roles nuevos y quitar roles retirados, comprobando errores. **No es una operación atómica**: si se necesita consistencia estricta, reemplazar por una RPC transaccional del backend con autorización explícita.

## Migración propuesta — NO EJECUTAR SIN REVISAR
Confirmar primero el esquema, funciones `has_role`, permisos y políticas existentes. No sustituir ni eliminar las políticas de lectura. La siguiente es una propuesta que requiere revisión en la base real:

```sql
CREATE POLICY "Platform admins can manage global roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::public.user_role))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::public.user_role));
```

**Precaución:** verificar que `has_role` no produce recursión RLS, que es `SECURITY DEFINER` correctamente restringida si corresponde, y que el enum `public.user_role` incluye `platform_admin`. Una alternativa más segura es una RPC administrativa transaccional con comprobación de privilegios en servidor.

## Pendiente
1. Confirmar la vinculación real Lovable↔GitHub (coincidencia de archivo no prueba sincronización).
2. Inspeccionar políticas de `profiles` y `restaurant_users` y permisos de administración de Auth.
3. Probar con usuario de ensayo, no con Qori en producción.
4. Validar build, pruebas, revisión de seguridad y autorización antes de fusionar o desplegar.
