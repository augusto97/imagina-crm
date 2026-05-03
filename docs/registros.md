# Registros

Los **registros** son las filas de tu lista. Cada registro tiene un valor por cada campo configurado, más metadatos automáticos: `id`, `created_at`, `updated_at`, `created_by`.

## Crear un registro

1. Desde la lista, pulsa **Nuevo registro** arriba a la derecha.
2. Completa el formulario. Los campos obligatorios se marcan con un asterisco rojo (`*`).
3. Pulsa **Crear registro**.

Si la lista no tiene campos todavía, el botón aparece deshabilitado. Configúralos primero en **Configurar lista**.

## Ver registros

La pantalla principal de cada lista muestra una **tabla** con todos los registros activos. Por defecto:

- Pagina de 50 en 50.
- Ordena por `id` descendente (los más recientes primero).
- Muestra el ID, todas las columnas activas, y la fecha de última actualización.

## Editar un registro

Hay dos formas de editar:

### Edición inline (rápida)

**Doble click** sobre cualquier celda activa el modo edición. Verás un input apropiado al tipo del campo (text input, date picker, select, etc.).

- **Enter** o salir del campo (blur) → guarda.
- **Escape** → cancela el cambio.
- **Cmd/Ctrl + Enter** en textos largos → guarda (Enter solo en long_text añade una nueva línea).

Los cambios se aplican con **optimistic update**: la celda se actualiza al instante en la UI mientras el servidor procesa el guardado. Si el servidor rechaza (por validación, ej. email inválido), verás un tooltip rojo con el error y la celda revertirá.

### Panel lateral (completo)

**Click sobre la columna ID** o sobre la fila vacía abre el **panel lateral** con todos los campos del registro, incluyendo los que no se editan inline (`Usuario`, `Archivo`, `Relación`).

- Modifica los campos.
- Pulsa **Guardar cambios** (solo se envían los campos que cambiaron).
- Para cancelar, cierra el panel sin guardar.

Tipos no editables inline:

- **Usuario**: requiere ID de usuario WP. Se editará con un picker visual en próximas versiones.
- **Archivo**: requiere ID de adjunto. Picker visual en próximas versiones.
- **Relación**: por ahora se edita como CSV de IDs. Picker visual de registros vinculados en próximas versiones.

## Eliminar un registro

Desde el panel lateral, pulsa **Eliminar**. La eliminación es soft (la fila queda con `deleted_at` y deja de aparecer en la UI, pero los datos siguen).

Para borrar permanentemente, usa **Acciones en bloque** (ver guía dedicada) o llama directamente a la API REST con `?purge=true`.

## Buscar

El cuadro de **búsqueda** arriba de la tabla busca el texto en todas las columnas de tipo texto, email o URL del registro. La búsqueda es case-insensitive.

## Filtrar

Pulsa **Filtrar** (o **Añadir filtro**) para abrir el popover de filtros. Cada filtro tiene 3 partes:

1. **Campo** — qué columna filtras.
2. **Operador** — depende del tipo. Ejemplos:
   - Texto: `contiene`, `es`, `no es`, `empieza con`, `termina con`, `está vacío`, `no está vacío`.
   - Número: `=`, `≠`, `>`, `≥`, `<`, `≤`, `está vacío`.
   - Fecha: `es`, `no es`, `desde`, `hasta`, `está vacío`.
   - Selección: `es`, `no es`, `es alguno de`, `no es ninguno de`.
   - Casilla: `=` (marcado / no marcado).
3. **Valor** — el dato a comparar.

Pulsa **Aplicar** para añadir el filtro como un *pill*. Para editar, click sobre el pill. Para quitar, click en la `×`. Para limpiar todos, pulsa **Limpiar**.

⚠️ Máximo 5 filtros simultáneos por consulta. El backend rechaza más con un mensaje claro.

## Ordenar

**Click** sobre el header de cualquier columna para alternar `asc → desc → off`. Verás una flecha visible en la columna ordenada.

**Shift + click** sobre otra columna añade un sort secundario. Verás un número junto a la flecha indicando el orden de prioridad.

Ejemplo: ordenar primero por `status` ascendente, luego por `due_date` descendente:

1. Click en `Status`.
2. Shift + Click en `Due date`, click otra vez para invertir a desc.

## Paginación

La barra inferior muestra el rango actual (`1–50 de 230`) y los controles `Anterior` / `Siguiente`. Si solo hay una página, los controles se ocultan.

Las preferencias de paginación NO se guardan por vista; se reinicia a página 1 cada vez que cambias filtros, sort o de lista.

## Lo que sigue

- [Guarda combinaciones de filtros + sort + búsqueda como una vista](./vistas-guardadas.md) para volver con un click.
- [Selecciona múltiples registros y opera en bloque](./acciones-en-bloque.md).
