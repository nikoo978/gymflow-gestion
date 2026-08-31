# GymFlow Supabase V6

Código configurado para `nikoo978's Project` (`ubfqwmhxkjtqdcfnsmwe`).

- Supabase Auth: email/contraseña, sesión persistente y recuperación.
- Datos cloud: `gf_user_state`, separados por `user_id` con RLS.
- Datos locales: permanecen separados y no se sincronizan automáticamente.
- Backend Push: valida el access token contra el mismo proyecto Supabase.

La migración SQL está en `supabase/migrations/20260830_gf_user_state_rls.sql`.
