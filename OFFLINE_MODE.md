# GymFlow V.1.02 · Modo local de emergencia

El modo local sigue siendo un mecanismo de contingencia y no una segunda base de datos.

## Restricciones

- Sólo aparece en PC de escritorio.
- Sólo puede usarlo el **Admin master**.
- Requiere una sesión cloud previa en esa PC.
- Requiere PIN maestro.
- Sólo se habilita cuando la aplicación confirma que no hay Internet.
- Coadmin, Profe y Cliente nunca pueden activarlo.

## Persistencia

- Última copia cloud válida: IndexedDB.
- Operaciones pendientes: IndexedDB `pending_ops`.
- WAL de emergencia: `localStorage`, utilizado únicamente para proteger el intervalo previo al commit de IndexedDB.
- Cada operación tiene UUID propio y es idempotente por ID de registro.

## Al volver Internet

1. Recupera cualquier operación que hubiera quedado en WAL.
2. Envía la cola por lotes.
3. Supabase ejecuta `gf_apply_operations(...)` dentro de una transacción y bloquea el estado compartido mientras integra el lote.
4. Las operaciones se aplican sobre el estado cloud más reciente, no reemplazando todo el documento con una copia offline antigua.
5. Sólo se quitan de la cola local después de una respuesta satisfactoria.
6. Cuando la cola llega a cero, GymFlow vuelve automáticamente a Cloud.

Esto permite conservar movimientos generados por otros administradores mientras el Admin master estuvo trabajando sin conexión.
