=== Imagina CRM ===
Contributors: imaginawp
Tags: crm, lists, records, automation, kanban
Requires at least: 6.4
Tested up to: 6.6
Requires PHP: 8.2
Stable tag: 0.12.0
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

= 0.12.0 =
* Feature: widgets del dashboard ahora son drag + resize libre
  con persistencia, basado en `react-grid-layout`. El usuario
  puede:
    · Arrastrar cualquier widget para reordenar
    · Resizear desde la esquina inferior-derecha (handle visible
      al hover)
    · El nuevo layout (x/y/w/h) se persiste automáticamente al
      soltar via PATCH /dashboards/{id}
  Grid de 12 columnas a `lg`, responsive a 8/4/2 en breakpoints
  más chicos (md/xs/xxs). rowHeight 80px + margin 16px.
* Performance: react-grid-layout (~50KB gzipped) se carga lazy
  en su propio chunk — solo paga el costo el usuario que abre
  un dashboard, no el resto.
* Persistencia inteligente: `onLayoutChange` dispara también
  en mount inicial; comparamos antes de salvar para evitar
  PATCHs redundantes al abrir un dashboard.
* Botones de editar/eliminar widget tienen `imcrm-no-drag`
  para que el click no sea capturado como drag.

= 0.11.0 =
* Feature: 4 nuevos tipos de widget para Dashboards.
  · `chart_pie` (gráfico de torta / donut): SVG vanilla con
    arcos coloreados por la paleta tone-* + leyenda lateral.
    Misma data shape que chart_bar.
  · `chart_area` (línea con fill): variant del line chart con
    gradient bajo la curva.
  · `stat_delta` (KPI con comparación vs período anterior): big
    number + chip verde/rojo con flecha + delta % + valor
    previo. Configurable: métrica, campo numérico (sum/avg),
    campo de fecha, período (7/14/30/90/180 días).
  · `table` (tabla top N): top N registros ordenados por un
    campo del usuario, con columnas configurables (multi-select
    de fields).
* Feature: campo de agrupación de chart_bar / chart_pie ahora
  acepta más tipos:
    select · multi_select · text · email · url · date · datetime · checkbox
  Antes solo aceptaba `select`. multi_select hace UNNEST en PHP
  para contar valores individuales del array. date/datetime
  agrupa por mes (YYYY-MM). text/email/url toma top 25 distintos
  por frecuencia. checkbox mapea a "Sí" / "No".
* WidgetFormDialog rediseñado:
  · Type selector con los 7 tipos
  · FieldPicker reutilizable para todos los tipos
  · Sub-forms específicos para stat_delta y table
  · Modal scrollable hasta 90vh para configs largas
* Backend ALLOWED_WIDGET_TYPES extended; validación per-tipo
  refinada en DashboardService.

= 0.10.0 =
* Feature: TableView con columnas redimensionables y ocultables
  estilo Excel.
  · Drag del borde derecho del header para resizear (handle
    cyan al hover, sólido al activar). minSize/maxSize razonables
    por tipo de campo (checkbox 90px, currency 120px, datetime
    170px, etc.).
  · Botón "Columnas" al lado de "Filtrar" abre un dropdown con
    checkboxes para mostrar/ocultar cualquier columna (incluido
    ID y Actualizado). Badge con contador de columnas ocultas.
  · Estado persistido en SavedView config:
      - `column_widths`: Record<columnId, px>
      - `hidden_columns`: string[] de columnIds ocultos
    Cada vista guarda su layout independiente.
  · `tableLayout: fixed` + `width: getCenterTotalSize()` para que
    las anchuras configuradas se respeten exactamente.

= 0.9.2 =
* Fix hover gris en botones: el variant `ghost` del Button component
  usaba `hover:bg-accent` (gris slate-95), lo que daba la sensación
  de "pastilla gris pegajosa" en hover. Ahora usa `bg-foreground/5`
  (4% black tint) — más sutil y on-brand. Mismo treatment para
  outline (hover:bg-canvas) y secondary (hover:bg-muted).
* Fix UA chrome lingering en hover/focus/active de buttons sin
  estilo explícito: nuevo reset con `:where()` para forzar
  `background-color: transparent; outline: none; box-shadow: none`
  en estos estados con specificity 0,0,0 — cualquier hover:imcrm-*
  de nuestras primitivas wins.
* Fix gap de la toolbar topbar: `gap-1` → `gap-2`, así los
  botones (search, fullscreen, notif bell, "Ver WP", settings,
  logout) respiran y no se ven pegados.
* Sidebar: nueva sección "Tus dashboards" (mismo patrón que
  "Tus listas") con bullets y active state primary/10. Aparece
  solo si tenés dashboards creados. Skeleton de loading
  unificado bajo "Cargando…".
* Topbar search button: deshabilitado explícitamente con tooltip
  "Buscador global — próximamente" mientras construimos el
  command palette (Cmd+K). Antes era un botón sin onClick que
  parecía roto.

= 0.9.1 =
* Fix CRÍTICO del reset de botones: el reset de UA defaults para
  buttons / selects / checkboxes que se introdujo en 0.8.1 estaba
  scopeado solo a `#imcrm-root`. Pero los Radix Portals
  (Dialog.Content, PopoverContent, DropdownMenu, etc.) renderean
  fuera del root, en `<body>` directamente. Resultado: dentro de
  modals como AutomationDialog los botones seguían heredando el
  chrome UA (gray gradient + 3D border + inset shadow) — esa
  "pastilla gris horrible" que se veía en cada celda y botón
  pequeño.
  · Selector ampliado: `#imcrm-root button, [class*='imcrm-'] button`
    — cubre tanto el SPA root como cualquier descendiente de
    elementos con clases imcrm-* (incluye los Portals de Radix
    que siempre tienen imcrm-* propias).
  · Mismo treatment para selects nativos y checkboxes.
* Fix: links nativos `<a>` heredaban el `text-decoration: underline`
  del browser, lo que daba subrayados feos en links que no eran
  variant="link" (ej. "Editado 27/04/2026" en cards). Ahora los
  links sin clases explícitas se renderean sin decoración. La
  variante `link` del Button component sigue mostrando underline
  on-hover explícito.

= 0.9.0 =
* Feature: colores manuales para opciones de select / multi_select
  (ClickUp-style). En el editor de campo (FieldDialog) cada opción
  ahora tiene una columna "Color" con un ColorPicker compacto que
  abre un Popover con paleta curada de 12 swatches:
    gris · rosa · naranja · ámbar · amarillo · lima · verde · teal
    · cyan · azul · violeta · magenta
  + opción "Sin color" para volver a neutral.
  · El color se guarda como nombre estable (ej. "cyan") en
    `config.options[i].color`. Nada de hex/rgb crudos — los
    nombres se resuelven a HSL via CSS vars `--imcrm-opt-{name}`,
    así heredan dark mode y son centralmente editables.
  · Los chips renderizados en TableView (select / multi_select)
    ahora usan el color elegido: bg al 14% + border al 32% +
    text-color sólido (variante "soft" Linear/GitHub style) +
    dot del color a la izquierda.
  · KanbanView resuelve el color via `colorVar()`: el dot del
    column header y el border accent del card lo heredan
    automáticamente. Sin código duplicado.
* Polish del OptionsEditor:
  · Card style consistente (rounded-xl + shadow-sm + bg-card),
    no más bg-muted plano
  · Empty state con border dashed warning + bg warning/5
  · Headers de columnas con tracking + uppercase semibold
  · Botón "Añadir opción" pasa a outline (más afordance)

= 0.8.3 =
* Polish del Formulario de automatizaciones — partes que quedaban
  con apariencia "browser default":
  · Cards de cada acción: rounded-xl + shadow-imcrm-sm + padding
    incrementado (3.5). Antes era rounded-md plano que se mezclaba
    con el bg del modal.
  · Número de posición de cada acción: pasó de circle h-6 w-6 sutil
    a square rounded-lg h-7 w-7 con bg primary/10 + ring primary/15
    — más legible y con afordance visual real.
  · Estado vacío "Aún no hay acciones" ahora con border dashed + bg
    canvas + texto centrado (estilo dropzone).
  · TriggerConfigEditor fieldset: pasó de bg-muted/20 a bg-card +
    rounded-xl + shadow-imcrm-sm. Banner de help con border-info/20
    y padding mayor.
  · IfElseConfig branches (Si / Entonces / Si no) usan ahora el
    componente <Badge> con dot prop — pills con bg/border/text
    tonales consistentes en lugar de spans inline custom.
  · Disclosure widgets (<details> "Condición de ejecución",
    "Avanzado: tolerancia", "Avanzado: From, Cc, Bcc"):
      - Chevron lucide-react que rota 90° al abrir
      - Fondo bg-canvas cerrado, bg-card + shadow-sm cuando abierto
      - Padding mayor + tipografía text-foreground/80 (no
        muted-foreground)
      - Badge con count para condiciones aplicadas

= 0.8.2 =
* Fix layout AutomationDialog en modo Diagrama: los campos
  Nombre, Descripción y Trigger consumían ~250px verticales del
  modal — el canvas quedaba apretado abajo. Ahora en modo
  Diagrama se muestran SOLO las tabs + un header sutil
  ("Editando: <nombre>" + botón "Editar metadatos") + el canvas
  full-height + el footer. Para editar nombre/descripción el
  usuario alterna a Formulario via tabs o el botón "Editar
  metadatos".
* Polish ViewSwitcher (tabs Formulario / Diagrama):
  · rounded-lg (no rounded-md) + shadow-imcrm-sm en el container
  · Active tab con shadow propia (efecto pill elevado)
  · Padding mayor (px-3 py-1.5) — antes era px-2.5 py-1
  · Hover state explícito text-foreground en tabs inactivas
* Polish EmptyPanel del side-panel del visual builder: antes era
  un texto centrado pequeño con mucho espacio vacío. Ahora tiene:
  · Card con border dashed + bg canvas + icon-tile primary
  · Título + descripción explicativa
  · Bullet list con tips de uso (cómo añadir acciones, cómo
    funcionan if_else branches, cómo reordenar)

= 0.8.1 =
* Fix CRÍTICO visual: TODOS los `<button>` no estilados explícitamente
  se veían como "pastillas grises horribles" (las celdas de la
  TableView, los íconos de acción, etc.). Causa raíz: nuestro
  `tailwind.config.ts` tiene `corePlugins.preflight: false`
  (necesario para no romper estilos de wp-admin), entonces los
  defaults del navegador para `<button>` (gray bg + 3D shadow)
  se aplicaban a cualquier botón sin clases imcrm-bg-* /
  imcrm-border-*.
  Fix: reset targeted en `globals.css` para `#imcrm-root button`
  → `background: transparent; border: 0; padding: 0; etc.` Las
  primitivas estilizadas (Button, Input, Select) sobreescriben
  con sus propias clases.
* Fix: `<select>` nativos también tenían el chrome UA pesado
  (gris-3D en Safari/Chrome). Reset con `appearance: none` +
  ícono SVG inline de chevron a la derecha. El componente Select
  de shadcn ya tenía bg-card encima — esto da el remate consistente.
* Fix: checkboxes ahora usan `accent-color: primary` para que
  el tick herede el cyan de la marca, no el azul-Windows default.

= 0.8.0 =
* Visual: identidad alineada con la app de admin de Imagina La Web
  (audit.imagina.cloud). Tu feedback "no se ve profesional como
  esa otra app" fue concreto: la identidad visual del producto
  debe ser cyan, no violet, y tiene patrones específicos
  (StatTiles, sidebar collapsable, topbar simple).
  · Primary cyan (`186 95% 42%`) reemplaza el violet `243 75% 59%`
    de 0.7.0. Ring, sidebar-active y todos los acentos heredan.
  · Nueva primitiva `<StatTile>` — KPI tile estilo audit:
    icon-square tonal (cyan/mint/rose/blue/violet/amber/slate),
    label small-caps gris, número 28px tabular-nums,
    hint opcional. Variante `active` con border primary +
    ring shadow.
  · 7 tones nuevos en tailwind config (`tone-cyan`, `tone-mint`,
    etc.) para usar libremente con `bg-tone-X/10` `text-tone-X`.
  · Background del canvas ahora es `canvas` (slate-50ish, no
    pure white) — las cards en blanco tienen contraste real.
* Sidebar rediseñada (igual a la app de audit):
  · Logo circular con gradient cyan radial (igual que el de
    "IMAGINA LA WEB" en la app)
  · Secciones con label uppercase tracking ancho
  · Ícono cyan en items activos + bg primary/10 sutil
  · Botón "Colapsar" al pie con animación de width
  · En modo collapsed muestra solo iconos centrados
* Topbar rediseñada:
  · Workspace name a la izquierda (no breadcrumb)
  · Buscador con kbd ⌘K
  · Botón "Ver WP" con border + icon (link al wp-admin)
  · Settings + Logout iconos a la derecha (matching audit app)
  · Sin avatar pill — el username está al lado izquierdo
* ListsIndexPage con barra de StatTiles arriba (Total / Últimos
  7 días / Documentadas / Slug ocupados). Match estilo audit.

= 0.7.0 =
* Visual: refundición del design system (Linear / Vercel /
  Cloudflare style). Mismo stack — Tailwind CSS 3 + shadcn/ui
  + Radix primitives + cva — pero con tokens y composiciones
  más refinados.
  · Palette: foreground `224 71% 4%` (navy profundo, no negro
    puro). Border `220 14% 93%` hairline (no `91%` gris pesado).
    Primary `243 75% 59%` violet refinado. Sidebar bg off-white
    `220 17% 98%`.
  · `<Button>`: variantes con sombra inset interna (top white
    highlight) + sombra exterior tonal. `active:scale-[0.98]`
    feedback global. `outline` ahora es card+border+shadow-sm
    (botón "default" estilo Linear). Heights y radius
    consistentes (h-9 + rounded-lg).
  · `<Input>` y `<Select>`: focus ring de 4px del primary/15
    (no offset), border primary en focus, shadow-inset interno,
    rounded-lg. Hover suave del border cuando no enfocado.
  · `<Badge>`: variantes "soft" — bg al 10% + border al 20-25%
    + text al color sólido (estilo Linear/GitHub). Variante
    `solid` opcional para fills llamativos. Soporta `dot` prop.
  · Shadows en capas (sm/md/lg/xl + inset) inspiradas en Linear:
    edge nítido + blur amplio = depth sin halo gris. Animation
    `imcrm-scale-in` + easing `imcrm-out` (cubic-bezier).
  · Sidebar redesign: secciones con labels en small-caps gris
    `tracking-[0.08em]`, items con icon coloreado en hover,
    item activo con bg primary/10 + text primary, bullets en
    sub-listas. Brand con gradient en el logo cuadrado.
  · Topbar: bg con backdrop-blur, breadcrumb refinado,
    avatar en círculo con ring + gradient fallback, divider
    vertical entre toolbar y user, search button "minimum
    width" para anchor consistente.
  · ListsIndexPage rediseñada como proof: header con
    border-bottom, cards con icon-tile coloreado + arrow
    affordance + footer con slug code chip + fecha.

= 0.6.0 =
* Visual: pass de polish en superficies clave.
  · Kanban cards rediseñadas — antes mostraban `slug: value` raw
    estilo `var_dump`. Ahora cada campo se renderiza tipo-aware
    via renderCellValue (chips para select/multi_select, dates
    formateadas, currency con miles, etc.) con label uppercase
    + tracking en lugar del slug. Border accent izquierdo
    coloreado según la columna del kanban. Hover con
    translate-y y sombra incrementada.
  · Kanban columnas con header divider, count chip flotante,
    drop zone de columna vacía mostrando "Arrastra una card
    aquí" con border dashed.
  · TableView con header sticky + gradient + tracking-wider,
    rows con padding vertical mayor, transición de hover más
    rápida (100ms). Empty state ahora usa el componente
    compartido con ilustración + descripción.
  · Dashboard widget cards: gradient sutil de card-to-card/95,
    hover con translate-y + border primary/20 + sombra md,
    rounded-xl + min-h 200px. KpiWidget rediseñado con número
    4xl bold y label de métrica debajo del valor (no en footer
    separado).
* Componente compartido `<EmptyState>` (icon + title + description
  + CTA opcional). Aplicado en ListsIndexPage, DashboardsIndexPage,
  AutomationsPage, TableView. Reemplaza 4 implementaciones
  inline-and-similar con una versión polished que tiene icon
  con halo blur + gradient card.
* Tokens de diseño:
  · Sombras en capas (sm/md/lg/xl) estilo Linear/Vercel — un
    edge nítido cerca + blur amplio = depth sin halo gris.
  · Nueva animación `imcrm-scale-in` (cubic-bezier easing) para
    futuros mounts de modal/popover.
  · Easing `imcrm-out` exposed.

= 0.5.1 =
* Fix: en value pickers de filtros / conditions, los campos
  `multi_select` mostraban "Sin coincidencias" porque el endpoint
  de autocomplete los blocklistea (los valores se almacenan como
  JSON arrays, no como strings escalares). Ahora `FieldValueInput`
  trata `multi_select` igual que `select`: dropdown con las options
  configuradas en el campo.
* Fix UX: el popover de autocomplete ahora distingue 3 estados —
  cargando, error, sin coincidencias. Antes un fallo HTTP se
  confundía con "no hay datos". Cuando el endpoint falla muestra
  el mensaje de error en rojo.
* Tests: 3 nuevos casos integration cubren `distinctValues`
  (frecuencia desc, search por substring, blocklist de tipos).

= 0.5.0 =
* Feature: autocomplete inteligente en value pickers — al editar
  un filtro de records o una condición de automatización, el
  campo de valor abre un dropdown con los valores que YA EXISTEN
  en esa columna, ordenados por frecuencia descendente y con
  conteo. Filtra server-side por LIKE mientras tipeas. Navegable
  por teclado (↑↓ Enter Esc).
  · Backend: nuevo `GET /lists/{list}/fields/{field}/values?search=&limit=`
    consulta `SELECT DISTINCT col, COUNT(*) FROM data_table` con
    el column_name resuelto desde el field. Tipos sin sentido
    (select, multi_select, checkbox, date, file, relation, user)
    devuelven `[]`.
  · Frontend: nuevo `<AutocompleteInput>` (Popover-based combobox)
    montado en `FieldValueInput` (automations) y `FilterValueInput`
    (records).
  · `listId` se inyecta vía un Context interno
    (`AutomationEditorListContext`) — los componentes profundos
    no necesitan prop-drilling.
* Refactor: `RecordRepository::getDistinctValues` reusable;
  `FieldService::distinctValues` orquesta list+field+repo.

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
