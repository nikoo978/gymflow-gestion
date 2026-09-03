# V.1.064

Variantes de ejercicios separadas por ID.

- Corrige la consolidación anterior: cada ID de la biblioteca vuelve a representar una variante independiente, aunque comparta nombre con otra.
- La biblioteca oficial queda en exactamente 1.336 ejercicios, con 1.336 IDs distintos.
- Cada variante usa exclusivamente su propio GIF de Cloudinary mediante `https://res.cloudinary.com/po0pnxfc/image/upload/ID.gif`.
- Se elimina la unicidad por nombre + músculo y se protege la unicidad del ID de biblioteca para impedir futuras consolidaciones accidentales.
- Las 47 familias que tienen nombres repetidos se identifican visualmente como `Variante · ID N` en glosario y constructor de rutinas.
- Los alias siguen asociados por ID, por lo que cada variante conserva las búsquedas que le correspondan.
- Los 11 ejercicios de ejemplo iniciales, no usados por ninguna rutina, se retiran para que el catálogo oficial coincida exactamente con las 1.336 referencias proporcionadas.

## V.1.063

Búsqueda por alias y nombres de ejercicios completamente legibles.

- Integra los alias entregados para 752 IDs de la biblioteca, separados originalmente por `;`, y los agrupa automáticamente cuando un ejercicio tiene varios códigos.
- El buscador de Profesor, Cliente, Admin y constructor de rutinas reconoce nombre, alias, músculo, categoría, equipamiento, descripción y código.
- La búsqueda normaliza mayúsculas, acentos, signos y espacios, por lo que variantes como `biceps` también encuentran `Bíceps`.
- Los nombres dejan de cortarse con una sola línea en la PWA: las tarjetas crecen lo necesario para mostrar el nombre completo.
- Al abrir un ejercicio se vuelve a mostrar el nombre completo junto con sus alias principales, descripción y GIF.
- El constructor de rutinas también muestra nombres completos y permite localizar ejercicios usando cualquiera de sus alias.

## V.1.062

GIFs demostrativos de ejercicios vinculados por ID desde Cloudinary.

- Cada ejercicio importado usa su código original para cargar `https://res.cloudinary.com/po0pnxfc/image/upload/ID.gif`.
- Los ejercicios consolidados que tienen varios códigos conservan fallback automático entre sus IDs si un GIF no está disponible.
- Los GIFs se muestran tanto en el glosario móvil de Profesor/Cliente como en la biblioteca de Admin.
- Las imágenes usan carga diferida y `object-contain` para mostrar el movimiento completo sin recortes innecesarios.
- Los ejercicios personalizados pueden seguir usando una URL de imagen/GIF manual.

## V.1.061

Biblioteca masiva de ejercicios clasificada y optimizada para móvil.

- Importa las 1.336 referencias de la biblioteca proporcionada y conserva sus identificadores originales para asociar GIFs más adelante.
- Las referencias duplicadas se consolidan en ejercicios canónicos sin perder los códigos de origen.
- Clasifica los ejercicios por Pecho, Espalda, Hombros, Bíceps, Tríceps, Antebrazos, Core, Glúteos, Cuádriceps, Isquiotibiales, Gemelos, Cadera, Cuello, Cuerpo completo, Cardio y Movilidad.
- Cada ejercicio incorpora una explicación breve de ejecución generada según el movimiento y grupo muscular.
- El buscador incluye nombre, músculo, categoría, equipamiento, descripción y código de biblioteca.
- Profesor, Cliente y Admin usan la misma biblioteca completa.
- El glosario muestra resultados de forma progresiva para evitar renderizar más de mil tarjetas simultáneamente en iOS/Android.
- El constructor de rutinas busca sobre toda la biblioteca y limita los resultados visibles para mantener una interacción fluida.
- `image_url` continúa preparado para enlazar los GIFs cuando se defina su alojamiento.

## V.1.06

Interfaces móviles completas para Profesor y Cliente + seguimiento corporal + permisos de acceso por profesor.

- Profesor elimina “Accesos” de su navegación y usa Inicio / Alumnos / Progreso / Ejercicios / Rutinas.
- El botón “Permitir acceso” aparece en Inicio sólo a profesores habilitados individualmente por el Admin Master.
- El permiso se valida también en Supabase; ocultar el botón no es la única protección.
- El acceso manual se registra en la sucursal seleccionada por el profesor y se refleja en todas las segundas pantallas.
- Profesor puede registrar y consultar su progreso corporal y el de sus alumnos.
- Cliente incorpora Inicio / Progreso / Ejercicios / Mis rutinas / Profe.
- Cliente puede registrar peso, altura, cintura, cuello, cadera opcional y notas.
- El sistema calcula IMC y, cuando hay medidas suficientes, porcentaje de grasa corporal estimado mediante fórmula Navy. Se presenta como estimación orientativa, no diagnóstico médico.
- Las mediciones se almacenan en una tabla privada, indexada y sin acceso directo desde el navegador.
- Profesor y Cliente tienen acceso al glosario completo de ejercicios para consultar técnica, músculo, equipamiento, referencias y material visual.
- Los portales usan navegación inferior, áreas seguras y objetivos táctiles adecuados para iOS y Android.

## V.1.051

Sincronización global de segunda pantalla de accesos.

- La segunda pantalla se sincroniza entre PC, celular, tablet o TV mediante Supabase Realtime.
- Todos los dispositivos muestran el mismo resultado cuando ingresa un Cliente o Profesor.
- El último evento puede recuperarse durante 30 segundos al abrir o reconectar una segunda pantalla.
- Se mantiene BroadcastChannel/localStorage como respaldo local en la PC.
- Accesos permite copiar un enlace seguro para abrir la misma segunda pantalla en otro dispositivo.

## V.1.05

Rutinas + glosario de ejercicios + registro reforzado.

- Admin Master puede eliminar definitivamente cuentas/mail PWA sin borrar la ficha del gimnasio.
- El registro solicita nombre completo, DNI, email y contraseña; el DNI queda asociado al perfil de cuenta.
- Ejercicios funciona como glosario filtrable por músculo; cada ejercicio despliega una explicación breve y material visual opcional.
- Profesor puede crear y editar rutinas, asignarlas a uno o varios clientes vinculados y revisar las rutinas enviadas por cliente.
- Una rutina enviada por Profesor permanece en el Cliente hasta que el propio Cliente la elimine; los cambios posteriores del Profesor se reflejan automáticamente.
- Cliente puede crear, editar y eliminar hasta 3 rutinas personales desde su interfaz móvil.
- Portal Cliente separa Inicio, Mis rutinas y Rutinas del profe.
