# Slugs editables y URLs

> Esta es una de las características que más diferencia a Imagina CRM de otros plugins de gestión de listas. Vale la pena entenderla bien.

## ¿Qué es un slug?

Un **slug** es el identificador URL-friendly de una lista o un campo. Lo ves en:

- **URLs del admin**: `/wp-admin/admin.php?page=imagina-crm#/lists/clientes/records`
- **API REST**: `/wp-json/imagina-crm/v1/lists/clientes/records`
- **Filtros guardados** y **vistas guardadas** (internamente por ID, externamente reconocibles por slug).
- **Webhooks** y llamadas de integraciones de terceros.

Los slugs en Imagina CRM siguen el formato **snake_case**: minúsculas, números y guiones bajos. Ejemplos válidos: `clientes`, `tareas_2026`, `proyectos_internos`. Inválidos: `Clientes` (mayúsculas), `mi-lista` (guiones), `2025_clientes` (empieza por dígito; se prefijaría a `l_2025_clientes`).

## ¿Por qué editables?

En la mayoría de plugins, una vez que defines el slug de algo, no se puede cambiar sin migrar datos. Imagina CRM permite **renombrar slugs en cualquier momento sin perder datos ni romper filtros guardados.**

Esto es posible gracias a una arquitectura de doble identidad:

| Concepto              | Editable | Uso                                                  |
|-----------------------|----------|-------------------------------------------------------|
| **ID numérico**       | No       | Identificador interno permanente. Lo que la BD usa.  |
| **Slug**              | **Sí**   | Etiqueta humana. Para URLs, REST, referencias.       |
| **Nombre físico de tabla/columna** | No       | Lo que MySQL realmente nombra. Inmutable.            |

Cuando renombras un slug:

1. La fila correspondiente en la tabla de listas (o campos) se actualiza con el nuevo slug.
2. El nombre físico de la tabla MySQL (ej. `wp_imcrm_data_clientes`) **NO cambia**.
3. Las vistas guardadas, filtros, sort y todas las referencias internas siguen funcionando porque guardan **IDs**, no slugs.
4. Se registra una entrada en `wp_imcrm_slug_history` con el slug anterior y el nuevo.
5. Se invalidan caches.

## Mecanismo de redirects

Cuando algo (una URL, un webhook, una llamada a la API) usa el **slug viejo** después del rename, el plugin lo detecta y resuelve transparentemente al ID correcto:

- Si el slug viejo apunta a un único slug actual: la operación se completa con un header HTTP `X-Imagina-CRM-Slug-Renamed: old=clientes,new=clientes_anuales` indicando el cambio. El cliente puede actualizar su URL si quiere.
- Si el slug viejo es ambiguo (porque después se reusó para otra entidad): la API responde **HTTP 409 Conflict** con explicación.

Esto significa que tus URLs viejas guardadas, integraciones o webhooks **siguen funcionando** tras un rename.

## Renombrar el slug de una lista

1. Abre **Configurar lista**.
2. En el campo **Slug**, escribe el nuevo nombre.
3. Verás validación inline en vivo:
   - 🔵 Verificando disponibilidad…
   - ✅ Disponible
   - ❌ Reservado / inválido / no disponible
4. Pulsa **Guardar cambios**.

Si el slug actual difiere del que estás escribiendo, verás una advertencia:

> *"Cambiar el slug no afectará tus datos ni filtros guardados. Sin embargo, URLs externas, webhooks o integraciones que usen el slug actual deberán actualizarse. Imagina CRM mantendrá redirects automáticos del slug anterior."*

## Renombrar el slug de un campo

Mismo flujo desde el FieldBuilder, dentro de la configuración del campo.

⚠️ Renombrar el slug de un campo NO afecta la columna física (`column_name`). Los filtros existentes siguen apuntando al `field_id` interno y se reconcilian automáticamente.

## Slugs reservados

Algunos slugs no se pueden usar porque colisionan con rutas internas o palabras reservadas de SQL:

- **Listas**: `lists`, `fields`, `views`, `records`, `comments`, `activity`, `relations`, `automations`, `settings`, `me`, `admin`, `system`, `api`, `auth`, `licensing`, `slug-history`, `field-types`, `import`, `export`, `webhook`, `webhooks`, más todas las palabras reservadas MySQL (`select`, `where`, etc.).
- **Campos**: `id`, `created_at`, `updated_at`, `deleted_at`, `created_by` (nombres usados internamente como columnas base), más palabras reservadas MySQL.

La validación inline del editor te avisa si intentas usar uno reservado.

## Historial de slugs

Cada vez que renombras, queda un registro en el historial. Para verlo:

1. Abre la configuración de la lista o campo.
2. En el panel del SlugEditor, pulsa **Ver historial de slugs** (próximamente — actualmente disponible vía API REST: `GET /imagina-crm/v1/slugs/history?type=list&entity_id=42`).

El historial es útil para rastrear renames que rompieron alguna integración externa.

## Buenas prácticas

- **Elige bien al crear**: aunque el rename sea seguro, evita renames innecesarios. Cada uno deja huella en el historial.
- **Avisa a tus integraciones** después de un rename. Imagina CRM mantiene los redirects, pero las herramientas externas están menos informadas y sus logs pueden ser confusos.
- **Para experimentar**, crea una lista de pruebas (`pruebas`, `sandbox`) y úsala libremente.

## Lo que sigue

- [Configurar campos](./campos.md) en tu lista.
- [Trabajar con registros](./registros.md).
