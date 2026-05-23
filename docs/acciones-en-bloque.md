# Acciones en bloque

Cuando quieres operar sobre muchos registros a la vez (eliminar varios, cambiar el status de un grupo), usa la selección múltiple.

## Seleccionar registros

Cada fila tiene un **checkbox** al inicio:

- Click → selecciona/deselecciona ese registro.
- Click en el checkbox del **header** → selecciona/deselecciona todos los registros visibles en la página actual.
- Si tienes selección parcial (algunas filas marcadas), el checkbox del header muestra estado **indeterminate** (línea horizontal). Click vuelve a seleccionar todo.

La selección **persiste entre páginas**: si seleccionas 30 registros en la página 1 y vas a la página 2, los 30 siguen contando. Esto te permite acumular selección a través de la paginación.

## Barra de acciones contextual

Cuando hay al menos un registro seleccionado, aparece una **barra contextual sticky** en el bottom de la pantalla:

- **N seleccionado(s)** — conteo total.
- **Limpiar selección** — deselecciona todo.
- **Eliminar** — elimina los registros seleccionados.

## Eliminar en bloque

1. Selecciona los registros.
2. Pulsa **Eliminar** en la barra contextual.
3. Confirma el diálogo.

Por defecto la eliminación es **soft**: los registros se marcan con `deleted_at` y desaparecen de la UI, pero los datos siguen en la base de datos.

Si algún registro falla al eliminar (por ejemplo, una restricción de integridad), verás un detalle:

- *"Se eliminaron 47 registros."*
- *"Fallaron 3:"*
- *"#12: La operación violó una constraint."*

Los registros que no fallaron sí se eliminaron; solo los problemáticos se quedan. Investiga uno por uno para entender la causa.

## Actualización en bloque (próximamente en UI)

La API REST ya soporta actualización en bloque (`POST /lists/{x}/records/bulk` con `{action: "update", ids: [...], values: {...}}`), pero la UI todavía no expone botones de "Cambiar status" o "Asignar a". Vienen en próximas versiones.

Por ahora, si quieres masivamente actualizar valores, puedes:

1. Filtrar la tabla para ver solo los que quieres cambiar.
2. Editar inline cada uno con doble click (es rápido cuando son pocos).
3. O usar la API REST directamente desde un script.

## Atajos

- En las próximas versiones añadiremos atajos de teclado:
  - `j` / `k` para navegar entre filas.
  - `x` para seleccionar la fila enfocada.
  - `Shift + Click` para selección de rango.
  - `Cmd/Ctrl + A` para seleccionar todo.

## Lo que sigue

- [Configura tu licencia](./licencia.md) para soporte y updates.
- [Resuelve problemas comunes](./faq.md).
