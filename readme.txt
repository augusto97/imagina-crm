=== Imagina CRM ===
Contributors: imaginawp
Tags: crm, lists, records, automation, kanban
Requires at least: 6.4
Tested up to: 6.6
Requires PHP: 8.2
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Plataforma de gestión de listas, registros y automatizaciones tipo ClickUp/Airtable nativa en WordPress.

== Description ==

Imagina CRM permite crear listas personalizadas con campos dinámicos, vistas configurables y automatizaciones, todo desde una UI moderna construida con React + shadcn/ui sobre WordPress.

== Installation ==

1. Sube el directorio del plugin a `/wp-content/plugins/imagina-crm`.
2. Ejecuta `composer install --no-dev` y `npm install && npm run build` dentro del directorio.
3. Activa el plugin desde el panel de WordPress.
4. Abre **Imagina CRM** en el menú lateral.

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

= 0.1.0 =
* Bootstrap inicial del plugin (Fase 0).
