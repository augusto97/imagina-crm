# Vistas guardadas

Una **vista guardada** captura una combinación de filtros, sort y búsqueda con un nombre. Cuando vuelves a la lista, en lugar de reconfigurar todo desde cero, eliges una vista del switcher y la tabla se reordena al instante.

Casos típicos:

- **"Vencidos esta semana"** → filtro `due_date < today AND status != closed`.
- **"Sin asignar"** → filtro `assigned_to is_null`.
- **"Mi backlog"** → filtro `assigned_to = <yo> AND status = active`, sort por `priority desc`.

## Crear una vista

1. Configura los filtros, sort y búsqueda que quieras capturar.
2. Pulsa el botón **+** al final del switcher de vistas (arriba de la tabla).
3. Completa el diálogo:
   - **Nombre**: lo que verás en la pestaña. Ej. `Vencidos esta semana`.
   - **Establecer como vista por defecto** (opcional): la siguiente vez que abras la lista, esta vista se aplicará automáticamente.
4. Pulsa **Guardar vista**. Aparecerá una nueva pestaña activa.

## Cambiar entre vistas

El switcher arriba de la tabla muestra una pestaña por cada vista, más una pestaña virtual **Todos** (sin filtros).

- Click en una pestaña → carga sus filtros y sort.
- La estrella ⭐ indica la vista marcada como default.

## Modificar una vista

Cuando estás en una vista activa y cambias filtros, sort o búsqueda, el switcher detecta que tu estado **difiere** del guardado y muestra:

- *"Cambios sin guardar"*
- **Descartar** → revierte al estado guardado de la vista.
- **Guardar** → actualiza la vista con tu estado actual (PATCH al servidor).

Si estás en la pestaña **Todos** y haces cambios, el switcher ofrece **Guardar como vista…** para crear una nueva con esos cambios.

## Marcar como default

Click en el `⋯` (tres puntos) de la pestaña activa → **Establecer por defecto**.

La vista default se aplica automáticamente la primera vez que abres la lista en una sesión. Si vas explícitamente a **Todos** o a otra vista, ahí te quedas hasta cerrar y volver a abrir.

## Eliminar una vista

Click en el `⋯` de la pestaña activa → **Eliminar vista**. Se te pedirá confirmación.

⚠️ Eliminar una vista NO afecta los registros. Solo se elimina la "configuración guardada".

## Vistas por usuario vs compartidas

Por defecto, las vistas que creas son **personales**: solo tú las ves. En próximas versiones se podrá compartir vistas con otros usuarios o el equipo entero.

## Cómo se guardan

Las vistas se almacenan en `wp_imcrm_saved_views.config` con referencias internas por **field_id** (no por slug). Esto significa que:

- Si renombras un slug, la vista sigue funcionando sin necesidad de actualizarla. Ver [Slugs editables](./slugs.md).
- Si eliminas un campo, la vista pierde silenciosamente esa parte del filtro/sort y sigue mostrando lo demás.

## Lo que sigue

- [Aprende sobre acciones en bloque](./acciones-en-bloque.md) para operar sobre múltiples registros.
- [Configura tu licencia](./licencia.md) para recibir actualizaciones.
