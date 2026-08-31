# GymFlow / Infytter Fitness · V.1.03

Versión enfocada en **usuarios, roles e interfaces diferenciadas**.

## V.1.03

### Admin master

- Continúa siendo único e inalterable.
- Ve la nueva sección **Usuarios** con todas las cuentas creadas en la PWA.
- Puede cambiar cualquier cuenta no-master entre `Cliente`, `Profe` y `Coadmin`.
- Mantiene todos los permisos operativos, financieros, notificaciones y modo local de emergencia.

### Coadmin

- Puede administrar roles y operar el sistema.
- No puede eliminar datos críticos ni modificar/eliminar al Admin master.

### Profe

- Dashboard propio.
- Ve alumnos, estados de membresía, vencimientos y accesos.
- Puede operar el control de acceso.
- No recibe caja, cierres financieros ni administración de usuarios.

### Cliente

- Portal móvil propio.
- Ve su plan, estado, vencimiento, sede, método de acceso y últimos accesos.
- Para vincular la cuenta, el administrador debe cargar en la ficha del cliente exactamente el mismo email usado para registrarse en la PWA.
- Supabase expone sólo la ficha y accesos de ese cliente; no recibe el estado global del gimnasio.

## Migraciones

Si V.1.02 ya está funcionando, ejecutá **sólo**:

```text
supabase/migrations/20260831_gf_client_portal.sql
```

Si instalás desde cero, ejecutá en orden:

```text
supabase/migrations/20260830_gf_user_state_rls.sql
supabase/migrations/20260831_gf_roles_shared_state.sql
supabase/migrations/20260831_gf_client_portal.sql
```

No requiere variables nuevas en Vercel.
