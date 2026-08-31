# GymFlow · estado de migración

## V.1.02 — Usuarios, roles y dashboard interactivo

Requiere aplicar:

`supabase/migrations/20260831_gf_roles_shared_state.sql`

### Datos existentes

La migración toma el estado V10 del usuario más antiguo de Supabase (Admin master) y lo copia a `gf_gym_state` sólo si el estado compartido todavía no existe. No elimina `gf_user_state`.

### Seguridad

- 1 único Admin master.
- Registro público → rol Cliente.
- Roles modificables por Admin/Coadmin.
- Coadmin sin borrados.
- Profe sin datos financieros y con escritura limitada a accesos.
- Estado cloud compartido escrito exclusivamente mediante RPC transaccional.

### Offline

El modo local V10 se conserva, pero queda restringido adicionalmente al rol `admin` con `is_master=true`, PC y PIN maestro.
