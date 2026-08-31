# GymFlow V10 · Emergencia offline segura

Implementado sobre la V8 de notificaciones:

- Modo local sólo en PC.
- PIN maestro `110725`.
- Modo cloud bloqueado para escritura durante un corte: obliga a entrar al modo de emergencia.
- Última copia cloud persistente en IndexedDB por usuario.
- Cola de operaciones offline persistente en IndexedDB.
- WAL sincrónico adicional para cubrir cierre/crash antes de terminar una escritura IndexedDB.
- Operaciones con UUID e idempotencia.
- Parches por registro: la reconexión no reemplaza colecciones completas con una copia antigua.
- Reconciliación optimista usando `gf_user_state.updated_at`, con relectura y reintento si Cloud cambió.
- Sincronización automática al evento `online` y reintentos periódicos mientras siga en modo local.
- Salida automática del modo local sólo cuando la cola pendiente llega a cero.
- Service Worker V10 con app-shell y assets Vite cacheados para poder reabrir la app sin conexión tras una visita online previa.
- Sistema Web Push V8 conservado.

No hay migración SQL adicional. Se mantiene como requisito `20260830_gf_user_state_rls.sql`.
