# GymFlow V10 · Modo local de emergencia

## Funcionamiento

- Disponible exclusivamente en navegador de PC (pantalla >= 900 px, puntero fino y sin UA móvil/tablet).
- Sólo se habilita cuando el navegador detecta que la PC está sin Internet.
- Requiere una sesión cloud iniciada previamente en esa PC y una copia cloud cacheada.
- PIN maestro: `110725` (se compara mediante SHA-256 en el cliente; el PIN no se guarda en texto plano en el código).
- En modo cloud sin Internet la interfaz operativa queda bloqueada. Para registrar movimientos hay que activar explícitamente el modo local con PIN.
- El modo local usa la última copia cloud de esa cuenta; no crea una base paralela independiente.

## Persistencia sin pérdida

Cada modificación genera operaciones con UUID propio. Antes de reflejar el cambio en pantalla se escribe un WAL sincrónico de emergencia en `localStorage`; inmediatamente después se persiste la misma operación en IndexedDB (`pending_ops`). Si el navegador o la PC se cierran durante ese intervalo, el WAL se recupera al próximo arranque.

La copia de trabajo completa también se mantiene en IndexedDB por `user.id`.

## Reconciliación con Cloud

Al volver Internet:

1. Se recupera cualquier WAL pendiente hacia IndexedDB.
2. Se obtiene el estado cloud actual junto con `updated_at`.
3. Las operaciones locales se aplican sobre ese estado actual, nunca sobre una copia cloud antigua completa.
4. La escritura usa control optimista (`user_id + updated_at`). Si otro dispositivo actualizó el estado mientras tanto, se vuelve a leer Cloud, se reaplican las operaciones y se reintenta.
5. Sólo después de una escritura cloud confirmada se eliminan las operaciones de IndexedDB.
6. Las operaciones son idempotentes: altas usan UUID estable, parches se reaplican sin duplicar, y borrados son repetibles.
7. Con cero pendientes, GymFlow sale automáticamente del modo local y vuelve a Cloud.

Esto evita el patrón peligroso de reemplazar todo `gf_user_state` con una copia offline vieja y conserva movimientos cloud que hayan aparecido durante el corte.

## Base de datos

No requiere una migración nueva respecto de V8. Debe seguir aplicada:

`supabase/migrations/20260830_gf_user_state_rls.sql`

La columna `updated_at` y su trigger se usan para el control de concurrencia.
