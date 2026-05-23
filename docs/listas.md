# Listas

Una **lista** es la unidad fundamental del producto: un contenedor de registros con campos personalizados y vistas guardadas. Piensa en una lista como una tabla de Airtable, una tabla en Notion, o un *board* de ClickUp.

Ejemplos de listas que puedes crear:

- **Clientes** (Nombre, Email, Estado, Teléfono, Notas)
- **Tareas** (Título, Asignado a, Fecha límite, Prioridad, Etiquetas)
- **Inventario** (Producto, SKU, Stock, Proveedor, Precio)
- **Solicitudes de soporte** (Cliente, Asunto, Estado, Prioridad, Fecha de cierre)

Cada lista tiene su propia tabla MySQL real (no es EAV), por lo que las consultas son tan rápidas como cualquier tabla nativa de WordPress.

## Crear una lista

1. Abre **Imagina CRM** desde el menú lateral.
2. Pulsa **Nueva lista**.
3. Completa el diálogo:
   - **Nombre**: lo que verás en la UI. Ej. `Clientes`.
   - **Slug**: identificador URL-friendly. Se sugiere automáticamente (`clientes`) pero puedes cambiarlo. Snake_case obligatorio: minúsculas, números y guiones bajos. Ver [Slugs editables](./slugs.md).
   - **Descripción** (opcional): para tu propia referencia.
4. Pulsa **Crear lista**. Te llevará automáticamente a la pantalla de configuración para que añadas campos.

## Configurar una lista

Desde la página de registros, pulsa **Configurar lista** arriba a la derecha. Verás dos secciones:

### General

- **Nombre**: editable en cualquier momento.
- **Slug**: editable. Cambiar el slug NO afecta tus datos (ver [Slugs editables](./slugs.md) para entender el mecanismo de redirects).
- **Descripción**: texto libre.

### Campos

Aquí defines la estructura. Cada campo se traduce en una columna real en la base de datos. Detalles en [Campos](./campos.md).

### Configuración avanzada (sección colapsada)

Para usuarios técnicos. Muestra el `table_suffix` real de la tabla MySQL:

- `wp_imcrm_data_clientes` para una lista con suffix `clientes`.
- Útil si quieres exportar datos via SQL directo o conectar herramientas externas (ej. Looker, Metabase) a la base de datos.

⚠️ El `table_suffix` es **inmutable**. Una vez creada la lista, no cambia, aunque renombres el slug.

## Eliminar una lista

Desde la pantalla de configuración, pulsa **Eliminar**. Se te pedirá confirmación.

**Por defecto la eliminación es suave** (`soft delete`):

- La lista deja de aparecer en la UI.
- Los datos siguen en la base de datos (tabla `wp_imcrm_data_*` intacta).
- Si te arrepientes, contacta soporte para reactivarla.

Para borrar **definitivamente** los datos, usa el endpoint REST con `?purge=true` o desinstala el plugin con la opción de purga activa (ver [Instalación](./instalacion.md)).

## Navegación rápida entre listas

El sidebar lista todas tus listas activas como sub-items. Un click te lleva a sus registros.

💡 Si tienes muchas listas, usa el atajo de teclado `⌘K` (próximamente) para abrir un command palette y saltar a cualquiera escribiendo su nombre.

## Lo que sigue

- [Configura los campos](./campos.md) de tu nueva lista.
- [Crea registros](./registros.md) y empieza a trabajar.
- [Aprende cómo funcionan los slugs editables](./slugs.md), una de las características más potentes del producto.
