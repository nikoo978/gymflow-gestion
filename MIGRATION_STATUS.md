# GymFlow · Estado de migraciones

## V.1.03 — Portales por rol

Nueva migración:

```text
supabase/migrations/20260831_gf_client_portal.sql
```

Si V.1.02 ya está aplicada, no vuelvas a ejecutar las migraciones anteriores.

### Resultado

- Admin/Coadmin: listado y cambio de roles desde **Usuarios**.
- Profe: dashboard propio sin información financiera.
- Cliente: portal propio enlazado por email a su ficha del gimnasio.
- El portal cliente usa una RPC restringida y no descarga `gf_gym_state` completo.
