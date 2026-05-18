# Preguntas frecuentes

## Instalación y activación

### Tras activar veo "Imagina CRM no encontró el autoload de Composer"

Falta correr `composer install` en el directorio del plugin:

```bash
cd wp-content/plugins/imagina-crm
composer install --no-dev
```

### Veo "el bundle del admin no está construido"

Falta compilar el frontend:

```bash
cd wp-content/plugins/imagina-crm
npm install
npm run build
```

### El menú "Imagina CRM" no aparece

Verifica que tu usuario tiene capability `manage_options` (los administradores la tienen por defecto). Si tienes un rol custom, asegúrate de añadirla.

### Requisito mínimo PHP 8.2 — tengo PHP 7.4

El plugin requiere PHP 8.2 por uso de readonly properties, enums, named arguments, intersection types y otras features modernas. Actualizar PHP no debería ser opcional en 2026 — habla con tu hosting.

## Listas y campos

### ¿Puedo importar datos desde un CSV?

En Fase 1 no hay UI de importación. Tienes dos opciones:

1. **API REST**: escribe un script que itere tu CSV y haga `POST /lists/{x}/records` por cada fila.
2. **SQL directo**: si conoces el `table_suffix` de tu lista (visible en *Configurar lista → Configuración avanzada*), puedes hacer `INSERT INTO wp_imcrm_data_<suffix>` desde phpMyAdmin o tu cliente SQL favorito. Pero respeta los nombres de columnas — esos sí están establecidos.

Una UI dedicada de import/export está en el roadmap.

### ¿Puedo exportar mis datos?

Sí, varias formas:

1. **API REST**: `GET /lists/{slug}/records?per_page=200&page=N` y paginas hasta agotar.
2. **SQL directo**: `SELECT * FROM wp_imcrm_data_<suffix>` desde phpMyAdmin o `wp db export`.

Una UI de export a CSV/JSON está en el roadmap.

### Modifiqué `config` de un campo y mis datos se perdieron

Esto NO debería pasar. El plugin ejecuta `ALTER COLUMN` que preserva datos. Si experimentas pérdida de datos al cambiar la configuración de un campo (`max_length`, `precision`), por favor abre un issue con detalles. Las pruebas de integración cubren este caso.

## Slugs y URLs

### Renombré un slug y mis URLs externas dejaron de funcionar

Imagina CRM mantiene **redirects automáticos** de slugs históricos. Si la URL externa (webhook, integración) recibe un 404 tras un rename, verifica:

1. Que el slug viejo no se haya reusado para otra entidad. Si pasó, el sistema responde 409 Conflict porque la resolución es ambigua.
2. Que no estés cacheando la respuesta antigua en algún CDN o proxy intermedio.

Ver [Slugs editables](./slugs.md) para detalles del mecanismo.

### ¿Puedo desactivar los redirects históricos?

Sí, vaciando la tabla `wp_imcrm_slug_history`. Pero no es recomendable — pierdes la capacidad de auditoría.

## Performance y escalabilidad

### ¿Cuántos registros aguanta una lista?

Hemos benchmarcado con **50.000 registros** y los listings con 2 filtros responden en p95 ≤ 70 ms (el contrato de CLAUDE.md §11 es ≤ 200 ms). Para listas mayores (500k+), considera:

- Añadir índices manualmente a las columnas más filtradas (en una próxima versión esto será automático para tipos `select` y `date`).
- Aumentar `innodb_buffer_pool_size` en MySQL.

### Mi tabla en la UI carga lento

Posibles causas:

1. **El servidor MySQL está lento** (otros plugins compitiendo, hosting compartido sobrecargado).
2. **Filtros sobre columnas no indexadas** en una lista muy grande.
3. **Bundle no minificado**: asegúrate de haber corrido `npm run build`, no `npm run dev`.

Mide con la pestaña Network del navegador: cuánto tarda `/wp-json/imagina-crm/v1/lists/{x}/records?…` realmente. Si es < 100 ms y la UI sigue lenta, el cuello está en el render del browser; revisa la consola por errores.

## Licencia y updates

### Mi licencia caducó pero quiero seguir usando el plugin

Sin problema: tus datos siguen disponibles 100%. Solo dejas de recibir updates automáticos y soporte oficial. Puedes:

- Renovar en imaginawp.com cuando quieras y volver a activar.
- Seguir usando la versión actual indefinidamente (es GPLv2).

### ¿La validación de licencia hace tracking?

No. Solo enviamos al servidor de licencias: la **clave**, la **URL del sitio** y el **acción** (`activate`, `validate`, `deactivate`). Sin info de uso, sin contador de registros, sin telemetría. Política transparente.

### El check de licencia falla por proxy/firewall corporativo

El servidor de licencias responde en `licenses.imaginawp.com` (HTTPS, puerto 443). Si tu firewall lo bloquea:

1. Pide al equipo de redes que añada la URL al whitelist.
2. Mientras tanto, el período de gracia (7 días) cubre desconexiones temporales.

## Desinstalación

### ¿Cómo elimino completamente el plugin y todos sus datos?

1. Activa la opción "Borrar todos los datos al desinstalar" en *Ajustes → Avanzado*.
2. Desinstala desde *Plugins → Plugins instalados → Imagina CRM → Eliminar*.

Sin la opción activa, los datos persisten incluso tras desinstalar (esto es deliberado para evitar pérdidas accidentales; ADR-007).

## Bugs y soporte

### Encontré un bug

Por favor abre un issue en <https://github.com/augusto97/imagina-crm/issues> con:

- Versión del plugin (visible en *Ajustes → Entorno*).
- Versión de WordPress y PHP.
- Pasos para reproducir.
- Lo que esperabas vs. lo que pasó.
- Si hay un error en consola o en `wp-content/debug.log`, adjúntalo.

### ¿Hay foro / Discord / Slack?

Por ahora solo issues en GitHub. La comunidad crecerá con el tiempo.
