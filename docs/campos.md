# Campos

Cada lista tiene sus propios **campos**. Un campo se traduce internamente en una columna real de MySQL, lo que hace que filtrar y ordenar sean tan rápidos como en cualquier tabla nativa de WordPress.

## Crear un campo

1. Desde la lista, pulsa **Configurar lista** arriba a la derecha.
2. En la sección **Campos**, pulsa **Añadir campo**.
3. Completa el diálogo:
   - **Label**: lo que verás como header de columna. Ej. `Email`.
   - **Tipo**: ver tabla más abajo.
   - **Slug**: identificador URL-friendly. Se sugiere desde el label.
   - **Obligatorio**: si está marcado, no se puede crear un registro sin valor en este campo.
   - **Único**: si está marcado, no se permiten duplicados (solo disponible para tipos compatibles).
4. Pulsa **Crear campo**. La columna se añade inmediatamente a la base de datos vía `ALTER TABLE`.

## Tipos disponibles

| Tipo            | Para qué se usa                                              | Ejemplo                                      |
|-----------------|---------------------------------------------------------------|----------------------------------------------|
| **Texto**       | Strings cortos (≤ 255 caracteres)                             | Nombre, ciudad, código de proveedor          |
| **Texto largo** | Notas, descripciones                                          | Comentarios internos, biografía              |
| **Número**      | Enteros o decimales (precision configurable)                  | Cantidad, calificación 1-5                   |
| **Moneda**      | Números con 4 decimales + ISO-4217 a nivel campo              | Precio (USD), total facturado (COP)          |
| **Selección única** | Una opción de un set fijo                                  | Estado: `active` / `pending` / `archived`    |
| **Selección múltiple** | Varias opciones de un set fijo                          | Etiquetas, departamentos involucrados        |
| **Fecha**       | Fecha sin hora (`YYYY-MM-DD`)                                 | Fecha de nacimiento, deadline                |
| **Fecha y hora**| Fecha + hora, siempre en UTC                                  | Hora de creación, scheduled_at               |
| **Casilla**     | Booleano, marcado / no marcado                                | Es activo, recibe newsletter                 |
| **URL**         | Enlace web                                                    | Web del cliente, link a documento            |
| **Email**       | Dirección de email validada                                   | Email de contacto                            |
| **Usuario**     | Referencia a un usuario de WordPress                          | Asignado a, propietario                      |
| **Relación**    | Vincula registros con otros registros de otra lista           | Cliente → Tareas relacionadas                |
| **Archivo**     | Referencia a un archivo de la Biblioteca de medios            | Logo, contrato firmado                       |

### Notas por tipo

- **Selección única / múltiple**: define las opciones en el panel del campo. Cada opción tiene `value` (interno), `label` (visible) y `color` opcional.
- **Moneda**: la moneda se define a nivel de campo (no por fila). Si necesitas multi-moneda en el mismo campo, usa Número + un campo extra Selección única con las divisas.
- **Fecha y hora**: en la base de datos se guarda en UTC. La UI convierte automáticamente al timezone del usuario.
- **Usuario**: por defecto valida que el ID exista en `wp_users`. Puedes desactivar la validación en el panel de configuración avanzada del campo.
- **Relación**: requiere elegir la lista destino. La relación se guarda en una tabla separada (`wp_imcrm_relations`), no en la tabla dinámica de la lista.
- **Archivo**: usa el ID de un attachment de WordPress (`wp_posts`).

## Campos obligatorios

Si marcas un campo como **obligatorio**, los registros nuevos requieren ese valor. Si lo activas en un campo que ya tiene registros, los registros existentes no se ven afectados pero los próximos sí lo exigirán.

## Campos únicos

Si marcas un campo como **único**, MySQL impide duplicados a nivel de base de datos (UNIQUE INDEX). Tipos soportados: `text`, `email`. El resto no permite unicidad porque el tipo de dato no lo admite (multi-select usa JSON, long_text es muy largo, etc.).

⚠️ Si activas "Único" en un campo con duplicados existentes, la operación fallará con un error. Limpia los duplicados primero.

## Reordenar campos

Arrastra los campos en la lista para cambiar el orden de las columnas. El cambio se guarda automáticamente.

## Editar un campo

Pulsa el campo en el FieldBuilder para abrir su panel de configuración. Puedes:

- Cambiar el **label** (no afecta nada interno).
- Cambiar el **slug** (ver [Slugs editables](./slugs.md)).
- Cambiar la **configuración**: max_length de un texto, precision de un número, options de un select. Si cambia algo del tipo, se ejecuta un `ALTER COLUMN` automático preservando los datos.
- Activar/desactivar **obligatorio**.
- Activar/desactivar **único**.

## Eliminar un campo

Pulsa el ícono de papelera junto al campo. Por defecto la eliminación es suave (la columna sigue en la BD pero el campo deja de aparecer en la UI). Si quieres eliminar la columna físicamente, usa la opción "Borrar permanentemente" en el confirm.

⚠️ Eliminar la columna físicamente es **irreversible**. Los datos de esa columna se pierden.

## Lo que sigue

- [Cómo funcionan los slugs editables](./slugs.md) — clave para entender qué pasa cuando renombras un campo.
- [Crea registros](./registros.md) usando los campos que acabas de definir.
