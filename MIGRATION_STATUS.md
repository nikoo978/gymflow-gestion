# GymFlow · Estado de migraciones

## V.1.03.1 — Cuentas como fuente del vínculo

Nueva migración:

```text
supabase/migrations/20260831_gf_account_links_notifications.sql
```

Si V.1.03 ya está aplicada, no repitas las anteriores.

### Resultado

- Admin/Coadmin ven todas las cuentas PWA registradas.
- Roles y vínculos se administran desde **Usuarios**.
- Clientes/Personal dejan de pedir email PWA.
- Cada registro genera un evento persistente.
- El Admin master recibe Web Push de nuevas cuentas.
- Portal Cliente usa vínculo explícito por `person_id`, no coincidencia de emails.
