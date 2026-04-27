=== Imagina CRM ===
Contributors: imaginawp
Tags: crm, lists, records, automation, kanban
Requires at least: 6.4
Tested up to: 6.6
Requires PHP: 8.2
Stable tag: 0.4.1
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

= 0.4.1 =
* Fix CRÍTICO fullscreen: dialogs, popovers y dropdowns no aparecían
  (o aparecían debajo) cuando el modo Pantalla completa estaba
  activo. Causa: #imcrm-root subía a z-99999 en fullscreen pero los
  Radix portals (que renderean en <body> como hermanos del root)
  seguían en z-50. Fix: CSS override en
  `html.imcrm-fullscreen-mode` que bumpea
  `.imcrm-fixed.imcrm-z-50` y `[data-radix-popper-content-wrapper]`
  a z-1000000.
* Fix layout del modal del visual builder: el canvas del Diagrama
  pasa de altura fija (640px) a `h-[min(78vh,820px)]` con flex
  interno → ajusta al alto disponible del modal sin requerir
  scroll en pantallas chicas. El panel lateral derecho ahora tiene
  scroll propio cuando el editor de la acción es largo (ej.
  if_else con muchas branches).

= 0.4.0 =
* Feature: modo "Pantalla completa" — botón maximize en la topbar del
  SPA oculta `#wpadminbar`, `#adminmenuwrap` y `#wpfooter` y monta
  el plugin como overlay full-viewport. Persiste en localStorage.
  Salir con el botón o tecla Esc.
* Feature: el modal del builder de automatizaciones se ensancha a
  ~95% del viewport cuando estás en la vista Diagrama (antes
  ahogaba el canvas en `max-w-2xl`).
* Feature: el visual builder ahora muestra ramas REALES para if_else
  — el nodo abre dos columnas paralelas (then a la izq, else a la
  der) con sus acciones nested como nodos visibles, conectadas por
  edges con labels "Sí" / "No" coloreados (verde / amarillo).
  Layout recursivo con cómputo de ancho por subtree → no hay
  solapamientos a ninguna profundidad de anidamiento.
* Refactor: selección por `path` (Array<number | 'then' | 'else'>)
  en lugar de `index` plano — soporta editar, eliminar y configurar
  acciones nested en cualquier branch del árbol. Helpers
  `getActionAt` / `setActionAt` / `removeActionAt` en
  `actionPath.ts`. Lógica de layout aislada en `visualBuilderLayout.ts`.
* Tweak: nodos rediseñados con gradient sutil + sombra en capas
  para if_else, label de paso con prefijo "Sí · N" / "No · N" en
  acciones nested (ubicación visual instantánea).
* Drag-to-reorder deshabilitado en modo Diagrama mientras evaluamos
  un mecanismo path-aware. Para reordenar usa la vista Formulario.

= 0.3.0 =
* Feature: acción `if_else` (Si / sino) con branching real, anidable.
  Cada `if_else` tiene `condition` + `then_actions` + `else_actions`.
  El engine evalúa la condición y ejecuta UNICAMENTE el branch
  correspondiente. Las acciones nested pueden ser de cualquier tipo,
  incluyendo otros `if_else` (hasta 4 niveles de anidamiento — cap
  validado en backend para evitar configs maliciosas).
  · UI Formulario: dos sub-listas anidadas (then / else) con borders
    success/warning. Cada sub-lista reusa `ActionsEditor` recursivo
    — añadir/eliminar/configurar acciones igual que en el nivel raíz.
  · UI Diagrama: el nodo `if_else` muestra contadores de cada branch
    ("Si: 3 / Si no: 1") y abre el editor completo en el panel lateral.
  · `actions_log` incluye un summary del if_else (con qué branch
    matcheó) seguido de los ActionResult de las acciones nested.
* Refactor: `AutomationEngine::executeAction()` → `executeStep()` que
  retorna `array<int, ActionResult>` para soportar control flow que
  emite múltiples resultados desde un solo step.
* Tests: 4 nuevos casos cubren then-branch, else-branch, nested
  if_else y skip por condition de nivel-acción en if_else.

= 0.2.1 =
* Fix CRÍTICO: la vista Diagrama del visual builder rompía con
  "No QueryClient set, use QueryClientProvider to set one". Causa:
  mismo patrón que el bug de React #321 — el chunk lazy de
  AutomationVisualBuilder bundleaba su propia copia de
  `@tanstack/react-query`, así que el `useQuery` interno buscaba
  el provider en su instancia local (que nunca fue inicializado)
  en lugar de la del SPA root. Fix: añadir `@tanstack/react-query`
  a `resolve.dedupe`, `optimizeDeps.include` y al `manualChunks`
  que fuerza la lib al chunk principal.

= 0.2.0 =
* Feature: visual builder REAL para automatizaciones (Diagrama).
  Layout dos columnas — diagrama React Flow a la izquierda + panel
  lateral a la derecha. Click en el trigger o en una acción la
  selecciona y abre su editor en el panel (mismo editor del modo
  Formulario, reutilizado), incluyendo type select, título, configs
  específicos por tipo (update_field / call_webhook / send_email) y
  el editor de condición. El "+" abre type picker para elegir qué
  acción agregar; arrastrar acciones reordena la cadena. Antes la
  vista Diagrama era solo preview/reorder, ahora es feature-parity
  con Formulario.
* Feature: cada acción acepta una "Condición de ejecución" opcional
  (`{slug: valor}`). Si los pares no matchean el registro disparado,
  la acción se omite con `status=skipped` (no falla el run). Mismo
  shape que `field_filters` del trigger — el operador no aprende
  dos sintaxis. UI: collapsible "Condición de ejecución" en el
  editor de cada acción, en ambos modos (Formulario y Diagrama).
* Refactor: `ConditionEvaluator` compartido entre triggers y engine
  para no duplicar la lógica de igualdad laxa.

= 0.1.4 =
* Fix CRÍTICO: "Añadir filtro" del trigger y "Añadir valor" de la
  acción update_field no hacían nada visualmente. Causa: las filas
  con slug vacío se descartaban inmediatamente al serializar al
  config (formato `{slug: value}` no permite keys vacías). Refactor:
  state local en TriggerConfigEditor + UpdateFieldConfig que mantiene
  filas vacías durante la edición y solo sincroniza al config las
  entradas válidas.
* (Roadmap próximo commit) Visual builder real con panel lateral
  para configurar nodos desde el diagrama + type picker en "+" +
  ramas if/else. La vista Diagrama actual sigue siendo solo
  preview/reorder mientras tanto.

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
