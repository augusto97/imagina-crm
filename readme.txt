=== Imagina CRM ===
Contributors: imaginawp
Tags: crm, lists, records, automation, kanban
Requires at least: 6.4
Tested up to: 6.6
Requires PHP: 8.2
Stable tag: 0.1.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Plataforma de gestión de listas, registros y automatizaciones tipo ClickUp/Airtable nativa en WordPress.

== Description ==

Imagina CRM permite crear listas personalizadas con campos dinámicos, vistas configurables y automatizaciones, todo desde una UI moderna construida con React + shadcn/ui sobre WordPress.

**Documentación de usuario**: ver [`docs/README.md`](docs/README.md) en el directorio del plugin (también publicada en https://imaginawp.com/imagina-crm/docs).

== Installation ==

**Para administradores de WordPress (instalación normal):**

1. Descarga el ZIP del plugin desde la rama `release` del repositorio
   en GitHub (Code → Switch branches → `release` → Code → Download ZIP)
   o desde la pestaña Releases para una versión etiquetada.
2. En el WP admin: **Plugins → Añadir nuevo → Subir plugin** y
   selecciona el ZIP descargado.
3. Activa el plugin desde la lista de Plugins.
4. Abre **Imagina CRM** en el menú lateral.

El ZIP de la rama `release` ya incluye `vendor/` (dependencias de
Composer) y `dist/` (bundle JS compilado), así que no requiere
herramientas adicionales en el servidor.

**Para developers (instalación desde código fuente):**

1. Clona el repo en `/wp-content/plugins/imagina-crm`.
2. Ejecuta `composer install --no-dev` y `npm ci && npm run build`
   dentro del directorio (o usa `bin/build-release.sh` para una build
   completa equivalente al ZIP de release).
3. Activa el plugin desde el panel de WordPress.

Más detalles en `README.md` en la raíz del repo.

== Internationalization ==

* Text domain: `imagina-crm`.
* Idioma fuente: español (es_ES).
* Traducciones incluidas: en_US.
* Se aceptan PRs con nuevas traducciones en `languages/imagina-crm-<locale>.po`.
* Para regenerar el `.pot` y compilar `.mo` / `.json`: `bin/i18n-build.sh` (requiere wp-cli y `gettext`).
* El frontend usa `@wordpress/i18n` cargado vía `wp_set_script_translations`,
  por lo que las traducciones JS se sirven automáticamente desde
  `languages/imagina-crm-<locale>-imagina-crm-admin.json`.

== Changelog ==

= 0.1.3 =
* Fix: la vista "Diagrama" de automatizaciones tiraba React error #321
  ("Invalid hook call"). Causa: deps transitivas de @xyflow/react
  bundleaban su propia copia de React en el chunk lazy → hooks de
  React Flow corrían contra un React distinto del Provider del SPA.
  Fix: vite.config con `resolve.dedupe: ['react', 'react-dom']` +
  manualChunks que fuerza React/React-DOM al chunk compartido.

= 0.1.2 =
* Fix: el form de FieldDialog/AutomationDialog/WidgetFormDialog se
  reseteaba en cada keystroke por hooks de TanStack Query inestables
  en `useEffect` deps.
* Fix: CI fallaba en lint y en 2 integration tests (faltaban globals
  de browser en eslint config y stubs de Action Scheduler +
  DAY_IN_SECONDS/HOUR_IN_SECONDS en wp-stubs.php).
* Fix: el "Diagrama" de automatizaciones podía dejar el dialog en
  blanco si React Flow fallaba en runtime — añadido ErrorBoundary
  con fallback al form view.
* Feature: en la acción `update_field` el value picker ahora es
  contextual al tipo de campo:
  · select → dropdown con las options del campo
  · checkbox → toggle marcado/desmarcado
  · date / datetime → input nativo del browser
  · number / currency → input numérico
  · resto → input de texto con merge tags
  Mismo treatment para los `field_filters` del trigger.
* Feature: editor de `due_date_reached` con presets entendibles
  ("Cuando llega la fecha", "1 día antes", "1 semana antes",
  "1 día después", etc.) en lugar de pedir offset_minutes raw.
  Tolerancia movida a `<details>` avanzado y default subido a
  1 día (más útil para casos tipo "vencido hoy").

= 0.1.1 =
* Fix: dialogs/sheets/popovers de Radix se renderizaban transparentes.
  Variables CSS movidas de `#imcrm-root` a `:root` para que el
  contenido portaleado (fuera del SPA root) las vea.
* Fix: el form de creación/edición se reseteaba en cada keystroke
  (FieldDialog, AutomationDialog, WidgetFormDialog) — useEffect deps
  incluían hooks de TanStack Query referencialmente inestables.
* Fix: bundle JS no cargaba con `type="module"` — añadido filtro
  `script_loader_tag` en AdminAssets.
* Fix: `important: '#imcrm-root'` rompía Radix Portals — quitado del
  tailwind.config.
* Feature: editor de configuración por tipo de campo en FieldDialog
  (opciones para select/multi_select, precision para number/currency,
  max_length para text, target list para relation, default para
  checkbox).
* Feature: edición de campos existentes via icono Pencil en
  FieldBuilder.
* Feature: banner contextual en cada trigger de automatización
  explicando cómo funciona y cómo configurarlo.
* Build: pipeline de release vía rama `release` + workflow de CI
  + script local `bin/build-release.sh`.
* Build: bumped DB_VERSION a 2 + runtime upgrader que re-corre
  installSystemTables en updates desde el WP admin.
* Build: uninstall.php ahora purga las tablas automations,
  automation_runs y dashboards (faltaban).

= 0.1.0 =
* Bootstrap inicial del plugin (Fase 0).
