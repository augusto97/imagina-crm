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

Esta versión 0.1.0 corresponde a la **Fase 0 — bootstrap**. Sólo provee:

* Estructura del plugin y autoload Composer (PSR-4 bajo `ImaginaCRM\`).
* Bundle Vite + React 18 + TypeScript + Tailwind (prefijo `imcrm-`).
* Container DI propio.
* Página de admin con shell React (sidebar + topbar) montado en `admin.php?page=imagina-crm`.

La gestión real de listas, campos, registros, vistas y automatizaciones se irá añadiendo en las fases 1+.

== Installation ==

1. Sube el directorio del plugin a `/wp-content/plugins/imagina-crm`.
2. Ejecuta `composer install --no-dev` y `npm install && npm run build` dentro del directorio.
3. Activa el plugin desde el panel de WordPress.
4. Abre **Imagina CRM** en el menú lateral.

== Changelog ==

= 0.1.0 =
* Bootstrap inicial del plugin (Fase 0).
