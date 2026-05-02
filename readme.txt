=== Imagina CRM ===
Contributors: imaginawp
Tags: crm, lists, records, automation, kanban
Requires at least: 6.4
Tested up to: 6.6
Requires PHP: 8.2
Stable tag: 0.34.0
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

= 0.34.0 =
**Editor visual de plantilla CRM (paso 3 de 3 — el editor que pediste).**

Cierra la trilogía: schema (0.32) → composer + right rail (0.33) →
editor visual ahora. El user puede diseñar la ficha de cada lista
slot por slot, con preview en vivo.

* **Nueva ruta** `/lists/:slug/template-editor` — split de 2 columnas:
    - Izquierda: panel de slots con controles de cada zona del layout.
    - Derecha: preview en vivo con el `RecordCrmLayout` real, usando
      el primer record de la lista (o un mock si está vacía).
  Toggle "Ocultar/Mostrar preview" para ganar espacio si lo necesitás.
* **Slots configurables (5 secciones colapsables):**
    - **Encabezado**: título principal · subtítulo · badges de estado ·
      acciones rápidas. Cada uno filtra los fields elegibles por tipo
      (status solo acepta select-likes; quick actions solo email/url/
      phone-likes; etc.).
    - **Sidebar de propiedades**: agregar/quitar/reordenar grupos
      colapsables, cada uno con su nombre, icono (catálogo curado de
      12), si arranca colapsado, y los fields que contiene.
    - **Right rail**: toggle para "Resumen" + lista de relation fields
      a renderear como cards de relacionados.
* **Reorder con flechas ↑↓** en cada lista de campos (sin DnD lib —
  pragmático y accesible). Botón × para quitar. Selector "+ Agregar
  campo" filtrado a los todavía no usados.
* **"Restaurar desde…"** dropdown que clona cualquier built-in
  (Contacto / Venta / Tarea / Soporte / Auto) como punto de partida
  editable. Pide confirmación porque sobreescribe lo actual.
* **Persistencia**: `list.settings.crm_template_custom` con
  `CustomTemplateConfig` JSON. Toda referencia a fields es por
  **slug** (que el SlugManager garantiza estable vía slug_history),
  así que renombres no rompen la plantilla.
* **`getResolvedLayout(settings, fields)`** — helper unificado que
  RecordCrmLayout consume: si la lista tiene custom y está activa,
  usa `resolveCustomTemplate`; sino cae a la built-in. Mismo
  `ResolvedLayout` interface, así que la capa de render no cambia.
* Tolerancia: slugs que ya no existen en la lista (campo borrado)
  se skipean silenciosamente al resolver. La plantilla nunca se
  rompe — los fields no asignados van a "Otros" como siempre.
* **AppearancePanel**: nueva opción "Personalizada" en el picker
  con botón "Crear" (la primera vez) o "Editar" (si ya hay custom
  guardada) que linkea al editor.

= 0.33.0 =
**Phase B del panel CRM: composer multi-modo + right rail con stats y relacionados.**

* **Composer multi-modo en la timeline.** El composer ahora tiene
  4 tabs:
    - **Nota** — comportamiento default, equivale al composer original.
    - **Llamada** — campos extra: duración (min) y resultado (Hablamos /
      Buzón / No contestó / Ocupado).
    - **Email** — campos extra: destinatario y asunto.
    - **Reunión** — campos extra: asistentes y fecha/hora.
  Cada modo guarda metadata específica con el comentario, sin afectar
  comments existentes (que siguen como notas planas).
* **Render de timeline metadata-aware.** Cada fila muestra un mini
  badge con icono del kind (📞 ☎ 📧 👥), y el header de la fila resume
  los datos: "Llamada · 12 min · Hablamos", "Email → carlos@ejemplo.com
  'Propuesta v3'", "Reunión · Carlos, María · 5/2/2026 14:30".
* **Right rail (3ra columna del panel CRM).** Cada plantilla declara
  qué bloques renderear:
    - **Resumen** — días en sistema, días sin cambios, # comentarios,
      # cambios.
    - **Records relacionados** — 1 card por relation field con la lista
      de records vinculados resueltos a su título, click navega a la
      ficha del relacionado.
  Si la lista no tiene relations ni la plantilla pide rail, el grid
  colapsa a 2 columnas (sidebar + timeline) sin desperdiciar espacio.
* **DB version → 7.** Nueva columna `metadata LONGTEXT NULL` en
  `wp_imcrm_comments`. Se aplica automáticamente al cargar admin
  (dbDelta detecta el ALTER y lo corre).
* **Backend `CommentService`** acepta y valida `metadata` en
  create/update — kind whitelist (`note`/`call`/`email`/`meeting`),
  cap defensivo de 4KB JSON para evitar abuso. Frontend tipado en
  `CommentMetadata`.
* **`ResolvedLayout.rightRail`** — extensión del schema de
  plantillas que declara los bloques del rail. `LayoutBuilder.buildRightRail`
  genera el array por defecto: 1 stats + 1 related por relation field
  presente en la lista.

= 0.32.0 =
**Plantillas para el panel CRM** (paso 1 de 3 hacia el editor visual).

Cada lista en modo CRM ahora puede elegir qué plantilla aplicar
desde "Editar lista → Apariencia del registro". El sistema separa
**qué se renderea** (componentes RecordHeader, PropertiesSidebar)
de **dónde va cada campo** (la plantilla resuelve los slots).

* **Schema `CrmTemplate`** en `app/lib/crmTemplates.ts`. Cada
  plantilla expone un `resolve(fields) → ResolvedLayout` con:
    - `titleField`, `subtitleFields`, `statusFields`, `quickActions`
      (para el header).
    - `sidebarGroups[]` con id/label/icon/fields/collapsedByDefault
      (para el sidebar izquierdo).
    - `leftover[]` (campos sin asignar — caen en "Otros" colapsado).
* **5 plantillas built-in:**
    - **Automática** — heurística conservadora (default, equivale al 0.31).
    - **Contacto** — empresa/rol como subtítulo, email/teléfono al frente.
    - **Venta / Oportunidad** — etapa + prioridad en pills, monto destacado.
    - **Tarea** — fecha de vencimiento como subtítulo, programación
      al tope del sidebar.
    - **Soporte** — ticket id como subtítulo, prioridad prominente,
      cliente y SLA agrupados.
* **Picker** en `AppearancePanel`: cuando elegís "Panel CRM",
  abajo aparece la lista de plantillas con nombre + descripción +
  checkmark de la activa. Click cambia y aplica al instante (toast
  "Plantilla aplicada").
* **Refactor `RecordHeader` y `PropertiesSidebar`** para consumir
  `ResolvedLayout` en lugar de ejecutar su propia heurística. Esto
  prepara el terreno para 0.33 (Phase B: composer multi-modo, right
  rail, stats) y 0.34 (editor visual drag & drop, cuyo output será
  un template "custom" persistido — mismo `ResolvedLayout`).

= 0.31.0 =
**Layout CRM panel para registros (opt-in por lista).**

Hasta 0.30.x la página individual de un registro era un form lineal
con sidebar de Comentarios/Actividad — funcional pero genérica.
Ahora cada lista puede activar un layout estilo HubSpot/Pipedrive
desde su configuración.

* **Toggle por lista** en "Editar lista → Apariencia del registro":
  elegí entre "Lista" (default, form lineal) o "Panel CRM" (header
  con avatar + sidebar agrupado + timeline). Persiste en
  `list.settings.record_layout`.
* **Header CRM** con avatar generado de las iniciales del campo
  primary (color hash determinístico), badges de estado
  auto-detectados (campos `select`/`multi_select`/`checkbox` con
  ≤8 opciones renderean como pills), y botones de acción rápida
  según tipo de campo (`mailto:` para email, `tel:` para teléfono,
  abrir URL externa).
* **Sidebar de propiedades** con grupos colapsables auto-categorizados:
    - **Contacto**: email, url, teléfono (detectado por slug/label).
    - **Estado**: select/multi_select/checkbox con pocas opciones.
    - **Datos clave**: number, currency, date, datetime.
    - **Asignación**: user fields.
    - **Otros**: el resto (collapsed by default).
* **Timeline unificada**: comentarios + activity log mergeados
  client-side por timestamp, en orden cronológico desc. Composer
  de comentario al tope (Cmd/Ctrl+Enter para enviar). Filtros:
  Todo · Comentarios · Cambios. Cada fila con avatar, tiempo
  relativo ("hace 5 min") y acciones edit/delete cuando aplica.
* La heurística es conservadora: campos que no se clasifican claro
  caen en "Otros". El layout clásico sigue siendo default — listas
  no-CRM (inventario, proyectos) no se ven afectadas.

= 0.30.8 =
**Búsqueda instantánea para listas chicas (client-side filter).**

Para 30 registros, el cuello de botella NO era la query SQL (~2ms)
sino el round-trip completo: WordPress bootstrap (~100-150ms) +
network RTT (~50-100ms) + auth + REST routing. Cada keystroke
pagaba ~150-300ms de overhead constante, independiente del tamaño
de la lista.

* **Modo dual auto-detectado**:
    - Lista chica (total ≤ per_page): un solo fetch trae TODO sin
      search. Cualquier búsqueda subsiguiente filtra in-memory en
      <1ms — sin red, sin overhead. Instantáneo al tipear.
    - Lista grande: mantiene búsqueda server-side con índice
      invertido (si está activado) o LIKE.
* **Helper `clientSideSearch`** que tokeniza igual que el backend
  (lowercase + ASCII fold + split alfanumérico) y aplica AND-mode
  sobre los campos searchables (text, long_text, email, url).
  Soporta acentos: "carlos" matchea "Cárlos".
* **Debounce bajado** de 300ms → 200ms para listas grandes (donde
  sí hay round-trip).

= 0.30.7 =
**Search reactivo + fix grouped view + spinner inline.**

* **Search en vivo (debounced 300ms)**. Ahora podés escribir en
  el buscador y los resultados se actualizan automáticamente
  cuando dejás de tipear, sin tener que presionar Enter. El
  state visible del Input se actualiza instantáneo (responsivo);
  la query solo se dispara 300ms después del último keystroke,
  evitando una request por letra. Implementado con un nuevo hook
  `useDebouncedValue` reutilizable.
* **Fix: search en vista agrupada**. El bundle endpoint
  (`/records/grouped-bundle`) recibía `?search=` pero solo lo
  aplicaba a la meta de buckets — los registros dentro de cada
  bucket NO se filtraban. Ahora se pasa también a
  `service->list()` por bucket. Resultado: el buscador funciona
  igual en table flat, table agrupada, kanban y calendar.
* **Spinner inline**. Pequeño loader a la derecha del Input
  mientras la query está en vuelo (incluido durante el debounce).
  El user ve que el sistema está procesando, sin que aparezca
  como pantalla congelada.

**Nota sobre performance**: si tu lista tiene >10k registros y la
primera búsqueda se siente lenta, activá "Búsqueda avanzada" en
**Editar lista → Mantenimiento y rendimiento**. Reemplaza el LIKE
%q% (que escanea la tabla) por un índice invertido + BM25
(O(matches × tokens) — escala a millones). El resultado es
inmediato, no solo en cargas cacheadas.

= 0.30.6 =
**UI**: editar nombre y descripción de un dashboard.

* Botón "Editar" en el header de la página del dashboard, junto a
  "Eliminar" y "Añadir widget".
* Pencil icon a la derecha del título que aparece on-hover (UX
  estilo Notion/Linear) — segundo affordance para usuarios que
  van directo al título.
* Nuevo `DashboardSettingsDialog` con campos de nombre +
  descripción. Toast de éxito al guardar.

= 0.30.5 =
**Fix dashboards atascados + reemplazo de alerts nativos del browser
por toasts/dialogs in-app.**

* **Bugfix dashboard atascado**: si borrabas una columna que un widget
  usaba como métrica/agrupación/fecha, el dashboard quedaba "atrapado"
  — react-grid-layout disparaba `onLayoutChange` al montar, el
  frontend hacía PATCH y el backend rechazaba con "El campo de
  métrica debe ser tipo number o currency...". No podías editar
  layout, agregar widgets, ni siquiera eliminar el dashboard.
* **Fix backend**: `validateWidgets` ahora tolera referencias rotas.
  Si el campo o la lista referenciada ya no existe, acepta el save
  (el widget queda persistido — el evaluator muestra placeholder al
  renderear). Solo reporta error si la ref existe pero es de tipo
  incorrecto.
* **Auto-cleanup**: hook en `imagina_crm/field_deleted` que recorre
  los dashboards activos y elimina los widgets que referenciaban el
  campo borrado (`pruneFieldReferences`). Sin esto los dashboards
  quedaban con widgets huérfanos para siempre.
* **Toast in-app**: nuevo `<ToastProvider>` con `useToast()`. API
  Sonner-like: `toast.success/error/warning/info(title, description?)`.
  Stack apilable bottom-right, auto-cierre 5s (8s para errores),
  dismiss manual. Portal a `document.body`, z-index 100000.
* **Confirm in-app**: nuevo `<ConfirmProvider>` con `useConfirm()`
  que devuelve `Promise<boolean>`. Modal centrado con icono de
  advertencia para acciones destructivas, label customizable,
  Escape cancela.
* **Reemplazo de 16 `window.alert`/`window.confirm`** en
  DashboardPage, RecordPage, SavedFiltersDropdown, DateCellEditor,
  EmailSignatureCard, AutomationsPage, CommentsPanel. La app se
  siente nativa, no como un script de browser.

= 0.30.4 =
**Hotfix**: el menú "Imagina CRM" abría una pantalla en blanco en
0.30.2-0.30.3.

* Causa: en 0.30.2 cambié el `menu_slug` a la URL standalone
  esperando que WP la usara como `href` directo. WordPress no
  funciona así — generó un link `admin.php?page=<URL%20encoded>`
  que no resuelve a ninguna página → canvas en blanco.
* Fix: vuelve al slug normal (`imagina-crm`) pero engancha el
  redirect en `load-{hookname}`. Ese hook corre ANTES de
  `admin-header.php` (es decir, antes de cualquier output del
  admin) → `wp_safe_redirect` siempre puede setear headers. Era
  el patrón que faltaba en el 0.13.x original (que enganchaba el
  redirect en el render callback, demasiado tarde).
* Fallback defensivo si los headers ya se enviaron (por ej. otro
  plugin printea en `init`): meta-refresh + `window.location.replace`
  + link manual. El user igual aterriza en el SPA en <100ms.

= 0.30.3 =
**Cleanup**: elimina el toggle de pantalla completa (Maximize2 en
la topbar). Era residual de cuando el SPA se montaba dentro de
`/wp-admin/admin.php` y necesitaba ocultar el chrome de WP. Desde
0.13.0 el SPA vive en URL standalone (`/imagina-crm/`) sin chrome
de wp-admin → el botón no tenía nada que ocultar.

* Removido `app/stores/shellStore.ts` (booleano + persistencia en
  localStorage para el toggle).
* Removido botón Maximize2/Minimize2 del Topbar y atajo Escape.
* Removidas ~50 líneas de CSS con `!important` en
  `globals.css` (`html.imcrm-fullscreen-mode #wpadminbar { ... }`,
  override de z-index para Radix portals, etc.).
* AdminShell ahora usa layout fijo full-viewport siempre.
* Bundle baja levemente (-2KB).

= 0.30.2 =
**Fix UX**: el item del menú "Imagina CRM" ahora abre la URL
standalone directamente, sin pantalla intermedia.

* `add_menu_page` recibe la URL standalone como `menu_slug` (con
  `://` — WP la usa como `href` directo). Antes el callback hacía
  un `wp_safe_redirect` pero corría tarde en el ciclo del admin
  (`headers_sent() === true`) y caía al fallback con un link
  "Abrir Imagina CRM".
* Backwards compat: `admin_init` redirige las URLs viejas a
  `admin.php?page=imagina-crm` (bookmarks) hacia la URL standalone.
  Corre antes de cualquier output del admin.

= 0.30.1 =
**UI admin para Tier 3**: panel "Mantenimiento y rendimiento" en
la página de edición de cada lista. Ya no necesitás `curl` para
gestionar el motor de búsqueda ni los composite indexes.

* **Toggle "Búsqueda avanzada"**. Switch en vivo: activar dispara
  el reindex inicial vía Action Scheduler y muestra el contador de
  documentos indexados creciendo (polling cada 5s mientras está
  activa). Botón "Re-indexar" para forzar full rebuild.
* **Lista de índices sugeridos**. Renderea las sugerencias de
  `CompositeIndexSuggester` con razón ("Vista X filtra/ordena por
  estas columnas"), número de vistas que lo justifican, columnas
  involucradas. Apply / Quitar con un click. Estado verde cuando
  ya está aplicado.
* Hook `useMaintenance.ts` con TanStack Query: `useSearchStatus`,
  `useEnableSearch`, `useDisableSearch`, `useReindexSearch`,
  `useIndexSuggestions`, `useApplyIndex`, `useDropIndex`,
  `useRunPurge`.

= 0.30.0 =
**Tier 3 — Big data**: tercer y último step del roadmap de
performance. Habilita uso a 1M+ filas con búsqueda por relevancia,
índices compuestos auto-sugeridos, y purga automática de tablas
append-only.

* **Motor de búsqueda con índice invertido propio + BM25**.
  `src/Search/InvertedIndexEngine` mantiene dos tablas nuevas
  (`wp_imcrm_search_tokens`, `wp_imcrm_search_documents`) — una
  fila por (token, record) con term frequency, y una fila por record
  con doc_length. El query engine tokeniza el `?search=`, hace
  lookup de tokens y rankea con BM25 (k1=1.5, b=0.75). Costo
  ~O(matched_docs * tokens_in_query) — escala linealmente con la
  cardinalidad de matches, no con el tamaño total de la lista.
  Listas pequeñas/medianas siguen usando LIKE (`MysqlSearchEngine`)
  vía un flag opt-in por lista (`settings.search_index_enabled`).
* **Indexación automática**. Push hooks en `record_created`,
  `record_updated`, `record_deleted` mantienen el índice fresco
  sin que el caller lo sepa. Cuando el toggle se activa para una
  lista existente, un job de Action Scheduler reindexa en lotes
  de 500 records (idempotente, reanudable). Re-sync periódico
  cada 6h vía cron — defensivo contra writes que evadan los hooks
  (SQL directo, restores parciales).
* **Tokenizer multi-idioma**. Lowercase + ASCII fold (sin
  acentos) + filtro de stopwords ES/EN. Tokens entre 2-64 chars.
  Suficiente para corpus latinos; iterable a alfabetos no latinos
  via `mb_*`.
* **Composite Index Suggester**. `Maintenance\CompositeIndexSuggester`
  recorre las saved views de una lista y deriva sugerencias de
  composite indexes (multi-column). Si la vista filtra por A y
  ordena por B → sugiere `INDEX(A, B)`. El admin decide qué aplicar
  vía REST (cada índice cuesta storage + writes lentas, no
  automatizamos la creación). Endpoints: `GET /lists/{id}/indexes/suggest`,
  `POST /lists/{id}/indexes/apply`, `POST /lists/{id}/indexes/drop`.
* **Purge automático**. `Maintenance\PurgeService` borra entradas
  > 1 año de tres tablas append-only: `slug_history` (redirects
  raros tras un año), `activity` (debugging útil < 1 año), y
  `automation_runs` (logs de ejecución). Cron diario via Action
  Scheduler en lotes de 5k filas. Configurable: retention y batch
  size. También expuesto como endpoint ad-hoc `POST /system/maintenance/purge`.
* **REST endpoints admin**. Nuevos: `/lists/{id}/search/{status,
  enable, disable, reindex}` para gestionar el motor invertido
  por lista.
* **DB version → 6**. Las tablas nuevas se crean en activación o
  en updates desde admin (dbDelta automático).

= 0.29.1 =
**Migración de la vista agrupada al bundle endpoint** (continuación
del Tier 2 de performance, deferida de 0.29.0).

* `GroupedTableView` ahora consume `/records/grouped-bundle` con un
  solo hook (`useRecordsGroupedBundle`). Antes hacía 1 + N + N
  requests (groups meta + records por bucket abierto + aggregates
  por bucket abierto); ahora hace 1 — el backend devuelve buckets
  meta + primera página de records de cada bucket expandido +
  aggregates por bucket en la misma respuesta. En listas con 10
  buckets visibles esto baja de ~21 round-trips a 1 (y a 2 en el
  load inicial: 1 para conocer los buckets, 1 para traer expandidos).
* Fallback automático a `useRecords` cuando el user pagina dentro de
  un bucket (`page > 1`) — el bundle solo cubre la primera página por
  bucket, así que la paginación profunda sigue funcionando sin
  recargar todo el bundle.
* Convención de keys: el frontend usa `v:<value>` / `__null__` para
  state local (`collapsedGroups`, `openLocally`) — preserva compat
  con saved views existentes — y `<value>` / `__null__` (sin prefijo)
  para hablar con el backend.
* `keepPreviousData` en el hook mantiene la UI estable mientras la
  segunda fase del fetch inicial está en vuelo.

= 0.29.0 =
**Tier 2 — Escala** (5 items): segundo paso del roadmap de
performance. Habilita uso a 50k–500k filas con UX sin degradar.

* **Keyset pagination opt-in** (`?cursor=<id>`). Cuando el cliente
  pasa el cursor del último registro visible y no hay sort custom,
  el QueryBuilder usa `WHERE id < cursor LIMIT N` — costo
  constante a cualquier profundidad. OFFSET tradicional sigue
  funcionando como fallback (page-jumps directos del UI).
  Response trae `meta.next_cursor` con el id para la siguiente
  página. `MAX_PER_PAGE` subido de 200 a 500.
* **ETag + If-None-Match**. `Records/RecordsETag` mantiene una
  versión por lista en `wp_options` que se bumpea en cada
  `record_*`/`field_*`/`import_finished` hook. `GET /records`
  calcula un hash de (versión + queryParams) y lo devuelve como
  `ETag`. Si el cliente envía `If-None-Match` con el hash y la
  versión no cambió, retornamos `304 Not Modified` sin tocar la
  DB ni serializar JSON. Beneficio real con TanStack Query
  agresivo (refetchOnFocus, navegación entre tabs).
* **Cache de widgets/aggregates** (`wp_transient` 5 min) con
  invalidación automática vía version bump. Cualquier write a
  la lista cambia la cache key → miss → recálculo. TTL como
  safety net por si algún write se saltó hooks. Para dashboards
  con SUM/AVG sobre miles de filas, repetir el render es
  prácticamente gratis.
* **Page size default 200** (de 50) + **prefetch automático de
  next page**. TanStack Virtual ya virtualiza el render, así
  que pintar 200 filas es igual de rápido que 50 — pero 200
  reduce roundtrips a 1/4. El prefetch se dispara después del
  primer fetch exitoso si `currentPage < totalPages`; React
  Query lo cachea para que el avance al scrollear sea
  instantáneo. `QueryParams::MAX_PER_PAGE` subido a 500.
* **Endpoint `/records/grouped-bundle`** — orquesta en una sola
  request: (1) buckets + counts del groupBy, (2) records de
  cada bucket expandido, (3) aggregates de cada bucket
  expandido. Antes la vista agrupada disparaba 1 + N + N
  requests; con el bundle es 1. Hook frontend
  `useRecordsGroupedBundle` disponible para migrar
  `GroupedTableView` en una release menor 0.29.1 (refactor
  cuidadoso de la coordinación de buckets, dejado para iterar
  con tests).

= 0.28.0 =
**Tier 1 — Foundation** (8 items): primer paso del roadmap de
performance para llevar al plugin de "cómodo a 5k filas" a
"cómodo a 50k+ filas".

* **Object cache layer** (`Support/Cache`). Wrapper sobre
  `wp_cache_*` con auto-detect de drop-in persistente
  (`wp_using_ext_object_cache()`). `FieldRepository::find` /
  `findBySlug` / `allForList` y `ListRepository::find` /
  `findBySlug` / `all` cachean lecturas. Invalidación
  automática enganchada a hooks `imagina_crm/list_*`,
  `field_*`, `schema_upgraded`. Settings option
  `imcrm_object_cache_enabled` (default true) para
  emergency-disable. Sin Redis: cache per-request (ya útil).
  Con Redis: persistente, gana 10-100× en sites con tráfico
  real.
* **Fix N+1 de recurrencias**. Antes cada celda de fecha
  visible en la tabla pegaba a `/lists/X/records/Y/recurrences`
  → 50 queries por página de 50 records. Ahora un solo
  endpoint batch `GET /lists/X/recurrences?ids=1,2,3,...`
  que React Query hidrata en context y las celdas leen sin
  fetch propio. Hard cap de 1000 ids por request por defensa.
* **Toggle `is_indexed` en field config**. Nuevo checkbox
  "Indexar" en FieldDialog. Cuando se activa, el plugin hace
  `ALTER TABLE ... ADD INDEX` sobre la columna del field
  (idx_<column_name>); al desactivar, `DROP INDEX`.
  Acelera filtros y sort de full-table-scan (segundos a 50k
  filas) a index seek (ms). Mutuamente exclusivo con UNIQUE
  (UNIQUE ya provee índice). Schema bumpeado a v5: nueva
  columna `is_indexed TINYINT(1) NOT NULL DEFAULT 0` en
  `wp_imcrm_fields`.
* **Bulk INSERT en chunks** (`RecordRepository::insertBatch`).
  Una sola query con N filas (`VALUES (...), (...), ...`) en
  lugar de N round-trips. ImportService usa chunks de 200.
  Para imports de 5k filas, 25s pasa a ~3s solo en network.
  Nuevo `RecordService::bulkCreate(list, valuesList, partial,
  silentHooks)` orquesta validación + insertBatch + relations
  + hooks.
* **Action Scheduler para imports**. El bulk import dispara
  `silentHooks: true` (no truena 5000 hooks individuales que
  cada uno gatillaría automations + listeners) y un solo
  evento `imagina_crm/import_finished` async via
  `as_enqueue_async_action`. Listeners (ej. el motor de
  búsqueda v0.30.0) van a re-indexar la lista en bulk.
* **Skip evaluación de `computed` cuando no está en projection**.
  Si el cliente pidió `?fields=name,email`, no perdemos tiempo
  evaluando computed fields fuera del set. Reduce hydration
  cost por record.
* **Auditoría autoload**. Verificado que TODAS las options
  del plugin usan `autoload=false`. Comentario explícito en
  el código para mantener la convención.
* **Code-splitting frontend por ruta**. ListBuilderPage,
  AutomationsPage, DashboardsIndexPage, DashboardPage y
  SettingsPage ahora son `React.lazy()`. Bundle inicial baja
  ~17 KB gzip. Más importante: si el user solo usa Records,
  no descarga ~250 KB de chunks (Automations + Dashboards).
* DB version: 4 → 5. El runtime upgrader corre dbDelta
  automáticamente al primer hit del admin tras el update.

= 0.27.5 =
* Fix: hover de fila tenía lag (200ms aprox) por
  `transition-colors duration-100` que causaba un wait perceptible
  antes de pintar el bg. Especialmente notorio en la primera fila.
  Quitada la transición — feedback instantáneo en TableView y
  GroupedTableView.
* Fix: el sticky-left de la primera columna dinámica no
  funcionaba en la vista agrupada por culpa de `overflow-hidden`
  en cada `<section>` de bucket. Ese overflow crea un containing
  block que rompe `position: sticky` (las cells se quedaban
  pegadas al section, no al outer scroll). Removido. El
  `rounded-xl` y los borders del bucket card siguen funcionando
  porque el contenido cabe naturalmente.
* Fix: las barras de scroll quedaban al fondo del contenido de
  la página. Si la lista era larga, había que scrollear hasta
  abajo para encontrar la barra horizontal. Ahora los wrappers
  de tabla (flat y grouped) tienen `max-h: calc(100vh - 220px)`
  con `overflow: auto`, así el scroll vive DENTRO del wrapper y
  las barras quedan al fondo del viewport (estilo ClickUp).
* **Bulk actions toolbar flotante** (estilo ClickUp).
  `position: fixed` centrada al fondo del viewport en lugar de
  al fondo del contenedor de records. Border + shadow más
  marcados para que se distinga del contenido.
* **Acciones bulk nuevas:**
  - **Actualizar campo**: popover con selector de campo + input
    apropiado al tipo (select dropdown, fecha, número, texto,
    checkbox, multi-select por CSV). Aplica `bulk update` con
    `{slug: value}` a todos los seleccionados.
  - **Duplicar**: lee cada registro seleccionado vía API y crea
    uno nuevo con los mismos valores. Procesa en serie para no
    bombardear el server.
  - Se mantiene **Eliminar** (soft delete) y **Limpiar
    selección**.

= 0.27.4 =
* Fix: el footer estaba en DOS filas (la de "+ Agregar tarea" con
  colSpan + la de Calcular) cuando ClickUp lo unifica en UNA sola.
  Ahora ambas funciones viven en la misma `<tr>` del `<tfoot>`:
  el "+ Agregar tarea" ocupa la celda de la primera columna
  dinámica (alineada con el campo Nombre, que típicamente no es
  numérico), y las demás celdas siguen mostrando el dropdown de
  Calcular.
* Las celdas de Calcular ahora son **invisibles por default** y
  solo aparecen on hover de la fila completa del footer
  (`group/footer` + `group-hover/footer:opacity-60`). Al hover
  individual del trigger se opaca a 100%. Cuando ya hay un kind
  seleccionado el valor sí queda siempre visible. UX idéntica a
  ClickUp en sus capturas de referencia.

= 0.27.3 =
* Fix: tras 0.27.2 la vista agrupada quedaba en pantalla blanca
  con `Minified React error #310` (more hooks rendered than
  during the previous render). El `useMemo(tableWidth)` que
  añadí en `GroupedTableView` quedó DESPUÉS de los early
  returns (`if loading`, `if error`, `if empty`) — cuando el
  estado pasa de loading a ready, el orden de hooks cambia y
  React rompe. Movido al bloque de hooks de arriba, antes de
  los returns, así siempre se ejecuta en el mismo orden. Regla
  básica de React hooks que se me coló.

= 0.27.2 =
* **Scroll horizontal único compartido entre buckets** en la
  vista agrupada (estilo ClickUp). Antes cada bucket card tenía
  su propio `overflow-x-auto` — el user veía N scrollbars y las
  columnas no quedaban alineadas verticalmente entre grupos
  cuando scrolleaba en uno (ej. ABRIL en columna 5, MARZO en
  columna 1). Ahora el outer wrapper de la lista de buckets es
  el contenedor de scroll; cada `<section>` de bucket tiene
  `min-width: tableWidth` (suma de todas las columnas visibles
  + checkbox + add-col), así todos miden lo mismo. Resultado:
  un solo scrollbar al fondo, columnas alineadas entre buckets.
  El sticky-left sigue funcionando contra el outer wrapper.

= 0.27.1 =
* Fix: la columna sticky de 0.27.0 era el checkbox de selección,
  no la columna del nombre — UX inútil. Ahora la primera columna
  dinámica visible (en el orden actual del user) es la que se
  queda fija al scrollear horizontal. El checkbox scrollea con
  el resto. UX equivalente al "row name sticky" de ClickUp.
* Cambio mayor en el footer: las agregaciones eran auto-show por
  tipo de campo, lo cual saturaba el footer y no respetaba la
  preferencia del user. Ahora el footer es **opt-in por columna**
  estilo ClickUp: cada cell muestra "Calcular ▾" como CTA
  invisible-hasta-hover, y al click despliega un menú jerárquico
  con todas las opciones agrupadas:
   - Recuento → Valores del recuento, Contar valores únicos,
     Recuento vacío
   - Porcentual → Porcentaje vacío, Porcentaje no vacío
   - Números (number/currency) → Suma, Promedio, Mínimo,
     Máximo, Intervalo
   - Fechas (date/datetime) → Intervalo, Fecha más antigua,
     Fecha más reciente
  La preferencia se persiste por column id en
  `state.footerAggregates` → `view.config.footer_aggregates` —
  la próxima visita encuentra los mismos cálculos elegidos.
  "Quitar cálculo" como item rojo al final del menú cuando ya
  hay uno seleccionado.
* Footer con bg igual al body de la tabla — sin separador visual
  entre contenido y agregaciones (estilo ClickUp).
* Backend: `RecordAggregator` ahora emite también
  `count_unique` (`COUNT(DISTINCT col)`) para todos los tipos.
  `count_empty` se calcula también para number/date (antes solo
  text/select). Los porcentajes se derivan client-side de
  `count` / `count_empty` vs `total` para no requerir queries
  adicionales.
* Componentes UI nuevos en `dropdown-menu.tsx`:
  `DropdownMenuSub`, `DropdownMenuSubTrigger`,
  `DropdownMenuSubContent`, `DropdownMenuLabel` — wrappers de
  Radix Sub/Label con los estilos del plugin.

= 0.27.0 =
* **Footer con agregados por columna** (estilo ClickUp/Airtable).
  Bajo cada tabla y bajo cada bucket en la vista agrupada,
  nueva fila con sum/avg/count/min/max según el tipo del campo:
   - number / currency → "Suma 12.500"
   - date / datetime   → "Min YYYY-MM-DD" / "Max YYYY-MM-DD"
   - checkbox          → "✓ N · ✗ M"
   - text / select / etc → "N items"
  Backend: nuevo endpoint
  `GET /imagina-crm/v1/lists/{list}/records/aggregates?fields=…&filter_tree=…&group_by=…`
  Devuelve `{totals: {slug: agg}, groups: [{value, aggregates}]}`.
  Una sola SELECT con N expresiones agregadas por field, respetando
  el `filter_tree` activo (lo que ves en la pantalla es lo que
  suma).
* **Primera columna fija** (sticky-left). Checkbox y el campo
  marcado como `is_primary` se mantienen visibles al scrollear
  horizontalmente. Aplica en TableView (flat) y GroupedTableView.
  z-index calculado para no chocar con el `<thead>` sticky-top.
* **Botón "+ Agregar columna"** al final del header. Abre el
  editor de la lista en la sección de campos. UX mucho más
  rápida que Configurar lista → Campos → Nuevo.
* **Fila "+ Agregar tarea"** al pie de cada bucket en
  GroupedTableView y al pie de la tabla flat. Abre el dialog de
  creación.
* **Sombra del header solo on scroll**. Antes la sombra era fija;
  ahora el `<thead sticky>` queda plano cuando el contenedor no
  tiene scroll vertical (estilo ClickUp), y aparece una sombra
  suave cuando se scrollea para indicar el contenido pasando por
  debajo.
* **Estado de grupos colapsados/expandidos persistido en la
  vista**. Antes cada vez que cargabas la página, todos los
  buckets arrancaban cerrados. Ahora `state.collapsedGroups` se
  guarda en `SavedView.config.collapsed_groups` (array de bucket
  keys) — la próxima visita los grupos arrancan en el mismo
  estado que dejaste. El override en sesión es local hasta que
  el user vuelva a guardar la vista.

= 0.26.8 =
* Fix: al elegir "Calculado" como tipo de campo en el builder de
  la lista, la pantalla quedaba en blanco con
  `ReferenceError: require is not defined`. `FieldConfigEditor`
  importaba `useFields` con `require('@/hooks/useFields')` dentro
  del componente (era un intento de "lazy import" que se coló en
  el commit del feature de campos calculados). `require()` no
  existe en el bundle ESM del browser; cualquier uso revienta el
  render. Ahora `useFields` se importa al top como los demás
  hooks. Sin pretexto, debería haber sido así desde 0.23.0.

= 0.26.7 =
* Fix: las celdas de fecha no respondían a click después de
  0.26.6. Causa: `DateCellTrigger` (introducido para mostrar el
  icono de recurrencia) era una function component sin
  `forwardRef`. Radix `<PopoverTrigger asChild>` inyecta `ref` y
  handlers (`onClick`, `onPointerDown`, `aria-*`) sobre su hijo
  directo; al ser una function component sin forward, esos props
  se quedaban atascados en el wrapper y nunca llegaban al
  `<button>` real, así que clicks no abrían el popover. Ahora
  `DateCellTrigger` usa `forwardRef` y spreadea `...rest` en el
  `<button>` interno, así Radix le inyecta lo que necesita.

= 0.26.6 =
* Fix: agrupar la tabla (group_by) descartaba los ajustes
  visuales del flat view (anchos, orden de columnas).
  `GroupedTableView` ahora acepta `columnSizing` y `columnOrder`
  como props y los aplica al render: cada `<th>` y `<td>` lleva
  su `width`/`maxWidth` persistido y las columnas se ordenan
  según el array de ids guardado. Las columnas no incluidas en
  `columnOrder` (típicamente nuevas) quedan al final en su
  orden default. El truncate y `overflow:hidden` también se
  aplican igual que en el flat view, así long_text/multi_select
  no desbordan en los grupos.
* Fix: las celdas de fecha con recurrencia no tenían
  indicador visual — el user no podía saber qué fechas se
  repetían sin abrir la celda. Ahora el botón de modo lectura
  muestra un icon `RefreshCw` verde a la derecha del valor
  cuando hay una recurrencia activa para ese campo en ese
  registro. La info viene del mismo query
  (`useRecurrences`) que ya usaba el editor — React Query
  dedupea por queryKey, así que no hay overhead extra de red.
* Fix: el preview de ocurrencias en el calendario solo
  marcaba 5 fechas hacia adelante. Para una recurrencia
  mensual desde julio 2025 eso cubría hasta diciembre 2025
  y al navegar a 2026 no había marcas. Ahora la ventana es
  proporcional a la frecuencia para cubrir ~10 años:
   - daily   → 3 650 ocurrencias
   - weekly  → 520
   - monthly → 120
   - yearly  → 10
  Los 3 650 puntos del peor caso (daily) no impactan el render
  — el cálculo es aritmética local de fechas en un loop.

= 0.26.5 =
* Fix import: filas con celdas vacías en columnas mapeadas a
  campos `is_required` rebotaban con "Este campo es obligatorio"
  aunque OTRAS filas SÍ tenían el valor — caso típico de
  ClickUp donde "Start Date" está casi siempre vacío y solo
  "Due Date" se llena. Ahora `ImportService` corre el
  validator en modo `partial: true` para imports bulk: las
  celdas vacías se OMITEN del payload (ni se mandan como null)
  así que la ausencia no rebota la regla de obligatoriedad. La
  fila se inserta con NULL en SQL — todas las columnas dinámicas
  son nullable a nivel schema, así que es seguro. Si la columna
  está vacía en TODAS las filas, el campo queda null en cada
  registro y el user lo rellena manualmente.
  `RecordService::create()` ahora acepta `bool $partial = false`
  como tercer argumento; el call manual desde la UI sigue
  validando con strict required (default).
* Fix tabla: celdas largas (long_text, multi_select con muchas
  chips) se desbordaban visualmente sobre las columnas
  vecinas. `<td>` ahora trae `overflow: hidden` + `width` /
  `maxWidth` explícitos, y el botón de modo lectura del
  `EditableCell` lleva `truncate` (overflow + ellipsis +
  nowrap). El user ve `...` y abre el drawer para ver el
  contenido completo.
* Tabla: handle de resize visible. Antes era 1px transparent y
  el user no podía encontrarlo; ahora es 1px con
  `bg-border/40` (visible siempre) que pasa a 2px
  `bg-primary/60` on hover y 2px `bg-primary` mientras
  arrastra.
* Tabla: drag-and-drop para reordenar columnas. Cada `<th>` de
  campo del usuario es `draggable`; al arrastrar sobre otro
  header, el target se resalta con tinte primary y al soltar
  el orden se persiste. El icono `<GripVertical>` aparece on
  hover del header para indicar que es draggable. Las columnas
  fijas (ID y Actualizado) no son re-orderables. Estado nuevo
  `state.columnOrder` (TanStack `ColumnOrderState`) que se
  guarda en `SavedView.config.column_order`.

= 0.26.4 =
* Fix: el importador rechazaba TODA fila si el CSV traía valores
  para campos `select`/`multi_select` que no existían como
  opciones. Caso típico: ClickUp persiste etiquetas humanas
  ("sin factura", "Vencido", "Activo"), no slugs — sin
  pre-poblar las opciones, el `RecordValidator` rebotaba
  100% de las filas con "Opción no válida para este campo.".
* Solución (estilo ClickUp/Airtable):
   - Antes de insertar las filas, `ImportService::expandSelectOptions`
     escanea cada columna mapeada a select/multi_select, recolecta
     valores únicos del CSV, compara contra las opciones
     existentes (case-insensitive incluido para tildes ES) y
     añade vía `FieldService::update` las que falten. Una sola
     escritura por campo.
   - Al cocer cada celda, `resolveSelectValue` mapea label → slug.
     Match case-insensitive primero por `label` exacto y luego
     por `value`, así que tanto "Activo" como "activo" o el slug
     "activo" caen al mismo `value`.
   - Soporta opciones definidas como objetos
     `{value, label}` (formato actual) o como strings sueltos
     (formato legacy).
   - `multi_select` aplica el mismo resolver a cada item después
     del split por `,`/`;`.
* La response del run incluye un nuevo campo `expanded_options`
  con map `{field_slug: [{value, label}, ...]}` listando las
  opciones auto-creadas. La UI las muestra en el paso "Listo"
  como chips agrupados por campo, así el usuario sabe qué se
  agregó (puede revisarlas/editarlas después en la config de
  la lista).
* 6 unit tests nuevos en `ImportSelectResolutionTest`.

= 0.26.3 =
* Fix: el importador rechazaba todas las fechas de ClickUp porque
  vienen en formato humano ("Thursday, May 21st 2026" /
  "Wednesday, January 21st 2026, 5:29:08 pm -05:00") que no
  matcheaba ninguna de las regex (ISO, DD/MM, MM/DD).
  `ImportService::normalizeDate` ahora cae en
  `DateTimeImmutable::__construct` como fallback — el parser
  nativo de PHP entiende nombres de día/mes en inglés y sufijos
  ordinales (1st, 2nd, 3rd, 21st, 22nd, 23rd…), que es justo lo
  que ClickUp emite. Para campos `date` se descarta la hora;
  para `datetime` se preserva en formato 'YYYY-MM-DD HH:MM:SS'.
  10 unit tests nuevos cubriendo ClickUp human con/sin hora,
  todos los sufijos ordinales, Excel ES (DD/MM), ClickUp US
  (MM/DD), año de 2 dígitos, y unparseable → original.
* UX: en el paso "Listo" del importador, nuevo botón
  "Volver al mapeo" — preserva csv + mapping + new_fields y
  vuelve al paso anterior. Útil cuando el run reportó errores
  (campos obligatorios sin mapear, fechas inválidas) y el user
  quiere ajustar y re-correr sin tener que re-subir el archivo
  ni re-mapear todas las columnas desde cero.
* UX: el paso "Mapeo" muestra un aviso amarillo cuando hay
  campos obligatorios de la lista que no están mapeados a
  ninguna columna. Lista los nombres con su tipo. Previene la
  vuelta de "todas las filas fallaron por X obligatorio".
  Backend: `ImportService::preview` ahora incluye
  `is_required` en el array de campos.

= 0.26.2 =
* Fix: el importador CSV mostraba "No se pudo leer el archivo." al
  subir cualquier export. Era un mismatch del shape de respuesta:
  `ImportController` devolvía la data plana
  (`{headers, sample, ...}`) mientras que el resto del API y el
  cliente (`app/lib/api.ts`) usan envelope `{data: {...}}`. El
  frontend extraía `payload.data` → `undefined` → TypeError al
  acceder a `.suggested_mapping` → catch genérico que mostraba
  "No se pudo leer el archivo.". Ahora ambos endpoints
  (`/import/preview` y `/import/run`) envuelven la respuesta como
  el resto.
* UX: en el dialog de import, mensajes de error más útiles. Si el
  backend responde con un error tipado (ApiError), se muestra el
  mensaje del servidor; si falla por otra razón, mostramos el
  mensaje real del Error en lugar del genérico. Loguea
  `console.error('[imcrm import] preview failed:', err)` para que
  desarrolladores vean stack en DevTools.

= 0.26.1 =
* **Crear campos nuevos en el flujo de import**. Si el CSV tiene
  más columnas que la lista (ej. ClickUp con 10 columnas → lista
  con 5 campos), el wizard ahora permite crear los campos
  faltantes sobre la marcha desde el paso de mapping. La opción
  "+ Crear campo nuevo" aparece debajo de los campos existentes
  en cada select; al elegirla se despliega un mini-form con label
  (default = header del CSV) + tipo (default = inferido por los
  datos).
* `FieldTypeDetector` (helper PHP nuevo, 13 unit tests) infiere
  el tipo apropiado desde una muestra de valores con threshold
  80%:
   - `email`     — pasan `filter_var(EMAIL)`.
   - `url`       — empiezan con http(s)://.
   - `number`    — numéricos (incluye formato ES `1.234,56`).
   - `datetime`  — fecha + ≥50% incluyen hora.
   - `date`      — solo fecha (ISO, DD/MM/YYYY, MM/DD/YYYY).
   - `checkbox`  — sí/no/true/false/1/0/x.
   - `select`    — cardinalidad ≤ 20 y al menos 50% de repetición.
   - `text`      — fallback.
* Backend: `ImportService::run` acepta un nuevo parámetro
  `new_fields[{csv_column_index, label, type}]`. Los crea vía
  `FieldService::create` (incluye ALTER TABLE para columnas
  materializables) ANTES de iterar las filas; si falla, queda
  reportado en `errors[]` con `row=0`. La response trae
  `created_fields[]` para que la UI muestre lo que se generó.
* La UI de "Listo" muestra los campos creados con un chip por
  cada uno antes del summary de filas.

= 0.26.0 =
* **Importador CSV** para registros. Botón "Importar" en la toolbar
  de la lista — acepta exports de ClickUp, Airtable, Excel
  ("Guardar como CSV"), Google Sheets. Flujo en tres pasos:
   1. Upload — subes el archivo (FileReader, in-memory, no upload
      binario).
   2. Map — el backend devuelve cabeceras + muestra de 20 filas +
      sugerencia de mapping `columna_csv → field_slug` basada en
      match difuso (`similar_text` ≥ 60%) contra label/slug de cada
      campo. El usuario ajusta o ignora columnas con un select.
   3. Run — bulk insert vía `RecordService::create` (mismas
      validaciones que la creación manual). Resumen final con
      `imported / skipped / errors[]` y detalle por fila.
  Detección automática de delimiter (`,` / `;` / tab),
  encoding (UTF-8 con fallback Windows-1252 para Excel ES) y BOM.
  Coerciones por tipo: multi_select acepta "tag1, tag2" o
  "tag1; tag2"; checkbox acepta sí/no/1/0/x; números limpian
  separadores de miles ES (1.234,56) y US (1,234.56); fechas
  aceptan ISO, DD/MM/YYYY (Excel ES) y MM/DD/YYYY (ClickUp US)
  con heurística por valor del primer grupo.
  Hard cap de 5 000 filas por run (truncated flag en la response
  para que el usuario sepa que debe re-ejecutar con el resto).
  Campos `relation` y `computed` se excluyen del importer.
* **Exportador CSV**. Botón "Exportar" en la toolbar — descarga la
  vista actual respetando los filtros activos (`filter_tree`)
  como un `<list-slug>-YYYYMMDD-HHMMSS.csv`. BOM UTF-8 al inicio
  para que Excel reconozca encoding al abrir directamente.
  multi_select se serializa como CSV separado por coma; checkbox
  como 0/1; el resto como string. Hard cap de 50 000 filas; para
  listas más grandes el usuario filtra antes.
* Endpoints REST nuevos:
   - `POST /imagina-crm/v1/lists/{list}/import/preview`
   - `POST /imagina-crm/v1/lists/{list}/import/run`
   - `GET  /imagina-crm/v1/lists/{list}/export?filter_tree=…&fields=…`
* CsvParser shared entre import + export — robusto contra celdas
  multi-línea quoted, comillas escapadas (`""`), separadores
  detectados automáticamente. 14 unit tests cubren BOM, encoding
  Latin-1 → UTF-8, multi-línea quoted, escape de comillas dobles,
  detección automática de delimiter, round-trip build → parse.

= 0.25.0 =
* Nuevo: **Período del widget** — atajo dedicado en el editor de
  widgets para limitar los datos a un rango relativo (Hoy, Esta
  semana, Este mes, Últimos 7/15/30 días, Este año, Año pasado…)
  sin pasar por el panel de filtros. UX equivalente al "Período"
  del eje X de los charts de ClickUp: dos selects compactos
  arriba del bloque de filtros (campo de fecha + rango), opt-in
  por widget.

  Persistencia: `config.period = { field_id, preset }`. El backend
  (`WidgetEvaluator::mergePeriodIntoTree`) inyecta una condición
  `between_relative` en el filter_tree antes de compilar la query
  — los datos se recalculan en cada carga, "este mes" siempre
  apunta al mes actual sin que el usuario tenga que tocar fechas.

  Disponible para todos los tipos de widget (kpi, kpi delta,
  charts, table) cuando la lista tiene al menos un campo
  date/datetime.

= 0.24.1 =
* Fix: los botones de "Rangos rápidos" (Hoy / Ayer / Este mes / etc.)
  debajo de los filtros de fecha seguían creando DOS condiciones
  con fechas fijas (gte=YYYY-MM-DD + lte=YYYY-MM-DD), aunque 0.24.0
  ya soportaba rangos relativos dinámicos. Ahora cada click crea UNA
  sola condición `between_relative` con el slug del preset
  (`this_month`, etc.) — el rango se resuelve en cada query, no se
  congela al click. Eso elimina dos bugs reportados:
   - Después de clickear "Este mes" aparecía un segundo filtro de
     fecha "abajo" sin que el usuario lo hubiera creado.
   - Aunque uno guardara el dashboard con un rango "este mes", al
     volver al día siguiente seguían las fechas fijas del momento
     en que se hizo click.
  Las condiciones de **automatizaciones** mantienen el comportamiento
  anterior (gte+lte fijo) — ahí el momento del trigger ES el momento
  de la evaluación, así que no hay diferencia entre fijo y dinámico.
* Fix: charts (line, area, pie) tenían altura fija (`h-24`, `h-40`)
  y se veían minúsculos cuando el usuario agrandaba el widget en la
  grilla del dashboard. Ahora el SVG ocupa toda la altura disponible
  vía `flex-1` + `aspect-square` (pie) / `preserveAspectRatio="none"`
  (line/area). Líneas con `vector-effect="non-scaling-stroke"` para
  que el grosor del trazo no se distorsione al estirar.

= 0.24.0 =
* **Filtros con rango relativo dinámico** (`between_relative`).
  Para campos `date` / `datetime` ahora hay un nuevo operador "en"
  cuyo valor es el slug de un preset (`this_month`, `last_30_days`,
  `last_year`, etc.). El backend (`QueryBuilder::compileFilter`) lo
  resuelve a `[from, to]` con `wp_timezone()` cada vez que se ejecuta
  la query — así un widget guardado con "Este mes" sigue cargando
  datos de este mes la semana que viene, no las fechas fijas de
  cuando se guardó. Espejo PHP del helper JS (`RelativeDateRange`),
  con 13 unit tests cubriendo today/yesterday/this_week/last_week/
  this_month/last_month/last_7d/last_15d/last_30d/this_year/last_year
  + boundary de cambio de año.
* **Granularidad temporal en charts** (`time_bucket`). Selector
  nuevo en `WidgetFormDialog` para charts con eje de fecha:
  Día / Semana (ISO) / Mes / Trimestre / Año. El backend
  (`WidgetEvaluator`) genera la expresión `DATE_FORMAT` o
  `CONCAT(YEAR, QUARTER)` apropiada en `evaluateChartBar` y
  `evaluateChartLine`. Antes era hard-coded a "mes" en ambos.
* **Toggles de presentación en widgets de chart**:
  - **Línea de promedio**: bar chart pinta una marca punteada
    vertical en cada fila + valor agregado arriba a la derecha;
    line/area chart pinta una línea horizontal punteada con el
    valor del promedio.
  - **Etiquetas de datos**: line/area chart muestra el valor
    numérico encima de cada punto.
  - **Leyenda**: pie chart hace toggle de la leyenda lateral.
* **Pie chart con leader-line labels** estilo ClickUp/Looker:
  cada sector con ≥3% del total pinta su porcentaje + label fuera
  del aro con un connector polylínea (segmentos chicos quedan en
  la leyenda lateral para no saturar). Viewbox y radius ajustados
  para dejar espacio a las etiquetas.

= 0.23.1 =
* Fix: en `WidgetFormDialog` (Paneles → Editar widget) el panel de
  filtros se mostraba vía Popover de 720px y se desbordaba del
  diálogo en pantallas angostas — el usuario veía el primer
  filtro a la derecha del modal y no podía interactuar con los
  inputs cortados. Ahora se renderiza inline dentro del form
  (modo `inline` nuevo en `FiltersPanel`), igual que ClickUp en
  el sidebar de configuración del widget. Se amplía el ancho del
  diálogo a `max-w-2xl` para que las condiciones encajen sin
  truncarse.

= 0.23.0 =
* Nuevo tipo de campo: **Calculado** (`computed`). Deriva su valor
  de otros campos del mismo registro vía operaciones pre-armadas.
  Use case clásico: facturas con campo "mes facturado" + "último
  mes pagado" + computed "meses de atraso" + computed "monto a
  cobrar" = atraso × valor mensual.
* 8 operaciones disponibles:
  · `date_diff_months` — diferencia en meses entre dos fechas.
    Calculada lineal (`year×12 + month`) para que cruzar años
    funcione correctamente: dic 2025 → ene 2026 = 1 (no -11).
    Signo positivo si B es posterior a A; negativo al revés
    (refleja saldo a favor / atraso).
  · `date_diff_days` — diferencia en días entre dos fechas.
  · `sum` — suma de N inputs numéricos.
  · `product` — producto de N inputs.
  · `subtract` — A − B.
  · `divide` — A / B (división por cero → null).
  · `concat` — concatenación de N textos con separador
    configurable.
  · `abs` — valor absoluto.
* **Encadenamiento**: un computed puede usar otro computed como
  input. El evaluator recursa con cycle guard (depth limit 8 +
  set de "visitados") — ciclos devuelven null en lugar de
  loop infinito.
* **Lazy evaluation**: el valor se calcula en cada lectura
  (`RecordService::hydrate`), NO se persiste en la columna SQL.
  El campo ni siquiera tiene columna en la tabla dinámica
  (`hasColumn() = false`, mismo patrón que `relation`).
  Performance: O(N_records × N_computed) — irrelevante para
  hasta varios miles de records.
* **UI**:
  · FieldDialog: al elegir tipo "Calculado" aparece selector
    de operación + pickers de field inputs filtrados por tipo
    compatible. Inputs variables soportan "Añadir input" hasta
    el max de la operación.
  · Para `concat`: input de separador configurable.
  · Cells de computed son read-only (no editables inline). El
    valor se actualiza solo al cambiar las dependencias.
* Tests: 16 unit tests en `ComputedFieldEvaluatorTest` cubren
  todos los operadores + edge cases (cross-year, divide-by-zero,
  missing input, ciclos, self-reference, cadenas computed →
  computed).

= 0.22.5 =
* Tweak: ancho del DateCellEditor afinado a 445px (de 460px) —
  match exacto con la preferencia del usuario tras testing visual.

= 0.22.4 =
* Fix: el popover del DateCellEditor tenía espacio en blanco al
  lado del calendario porque el panel de recurrencia inferior
  era más ancho y forzaba todo el popover a ~520px. Reducido a
  460px — el calendario+atajos ahora llenan todo el ancho sin
  hueco vacío y el panel de recurrencia se ajusta naturalmente
  al ancho menor.

= 0.22.3 =
* Fix semántico de "Días después de…" matchea ClickUp:
  · Label cambió a "[N] día(s) tras la finalización" (ClickUp
    real). Antes decía "Cada [N] días" — ambiguo.
  · Backend: cuando esta frecuencia dispara, la fecha siguiente
    se calcula desde `now()` (momento del trigger), no desde la
    fecha actual del campo. Es la diferencia entre "se mueve 5
    días desde HOY que se completó" vs "se mueve 5 días desde
    la fecha original" — ClickUp hace lo primero.
  · Al elegir esta frecuencia, el trigger se fuerza a "Cuando
    cambia el estado" — la "finalización" implica un evento de
    estado, no un cron. El usuario configura qué estado cuenta
    como "finalizado" en los selects de abajo.

= 0.22.2 =
* Fix UX: el input numérico al lado de "Frecuencia" en el panel
  de recurrencia confundía. Ahora solo aparece cuando se elige
  "Días después de…" — donde N tiene sentido obvio (ej. cada 5
  días). Para Diariamente/Semanal/Mensual/Anual se asume `1` y
  el input queda oculto, igual que en ClickUp simple.
* Cuando aparece (modo days_after) viene con label inline:
  "Cada [5] días" para que sea inequívoco qué representa.

= 0.22.1 =
* Fix UX del panel de recurrencia para matchear ClickUp:
  · Ancho del popover reducido de 640px a 520px (la columna de
    atajos también pasó de 176px a 160px). Ya no se ve estirado.
  · Campos opt-in con checkboxes en vez de selects forzados:
    · "Crear nueva tarea" — checkbox que togglea action_type
      (update default → clone cuando se marca). Antes era un
      select obligatorio "Acción al rodar" que confundía.
    · "Repetir indefinidamente" — checkbox default ON. Cuando
      se desmarca aparece input "Repetir N veces" (matchea el
      "Repetir [N] veces" de ClickUp).
    · "Actualizar estado a:" — ya era checkbox, ahora con la
      misma estética de los otros.
  · "Frecuencia" + "Cada N" en una grid `[1fr 80px]` compacta
    (antes ocupaban dos columnas iguales).
  · "Cuándo rueda" pasó a un único select sin label visible:
    "Según un cronograma" / "Cuando cambia el estado".
  · Removido "Acción al rodar" como select separado — ahora es
    el checkbox "Crear nueva tarea".
  · Removido "Repetir hasta (date input)" — sustituido por
    "Repetir N veces" que internamente computa la fecha tope
    desde la fecha base × frecuencia × N.
  · Botón "Cancelar" añadido al footer cuando aún no hay
    recurrencia guardada (antes solo había "Guardar"; ahora
    también se puede cerrar el panel sin guardar).

= 0.22.0 =
* DateCellEditor: editor de fecha estilo ClickUp con calendario
  visual + atajos rápidos + recurrencia integrada en un solo
  popover. Reemplaza el viejo `<Input type="date">` y el icono ↻
  separado:
  · Click en una celda de fecha abre el popover.
  · Columna izquierda con atajos rápidos: Hoy, Mañana, Este fin
    de semana, Próxima semana, Próximo fin de semana, 2 semanas,
    4 semanas + "Limpiar fecha" cuando hay valor.
  · Calendario completo (react-day-picker v9) a la derecha — el
    usuario ve el mes, navega con flechas, y elige el día con un
    click.
  · Para datetime: input de hora debajo del calendario.
  · Sección colapsable "Hacer recurrente" debajo: si la celda ya
    tiene una recurrencia, el toggle se abre solo y muestra un
    resumen ("Cada mes · al cambiar estado"). Si no, está cerrada
    por default.
  · Las próximas 5 ocurrencias de la recurrencia se resaltan en el
    calendario con un punto verde — el usuario ve gráficamente
    cuándo va a rodar.
* Tema custom de react-day-picker en `globals.css` para matchear
  los design tokens (primary color, foreground, accent), tipografía
  Inter, y radius consistente con el resto de la app.
* Removido el `RecurrenceButton` separado de 0.21.0 — todo el flujo
  vive ahora en el editor unificado.

= 0.21.1 =
* Fix global de overflow en popovers/dropdowns flotantes: cuando el
  contenido (panel de filtros con muchas anidadas, picker de
  recurrencia, dropdown de filtros guardados, picker de merge tags)
  era más alto que el viewport, el bottom quedaba fuera de pantalla
  sin scroll y no se podía interactuar. Aplicado en
  `<PopoverContent>` y `<DropdownMenuContent>` (los componentes
  base que TODOS los flotantes reusan):
  · `max-w-[var(--radix-popover-content-available-width)]` y
    `max-h-[var(--radix-popover-content-available-height)]`
    — Radix calcula esas variables CSS contra `collisionPadding`
    (margen al viewport), así el popover nunca excede el espacio
    real disponible.
  · `overflow-y-auto` — scroll interno automático cuando el
    contenido crece más alto que el espacio disponible.
  · `collisionPadding={16}` ahora es default — el popover se
    auto-flippea si chocaría contra los bordes del viewport.

= 0.21.0 =
* Nueva feature: recurrencias por celda (ClickUp-style) sobre
  campos `date`/`datetime`. Click en el icono ↻ que aparece junto
  a una celda de fecha abre un popover con todo el config:
  · Frecuencia: diariamente / semanal / mensual / anual / cada N
    días.
  · Patrón mensual: mismo día / mismo día de la semana (ej. "2do
    jueves") / primer día / último día. Edge cases manejados:
    31 enero → 28/29 feb según bisiesto, "5to jueves" cae al
    último disponible cuando no existe.
  · Trigger: "según un cronograma" (Action Scheduler tick horario
    detecta que la fecha pasó) o "cuando cambia el estado a un
    valor" (hook de record_updated dispara al detectar la
    transición).
  · Acción: actualizar este registro avanzando la fecha, o clonar
    creando un registro nuevo con la nueva fecha. Opcional:
    "Actualizar estado a:" — resetea otro campo de estado al
    valor target al rodar (útil para "marca como Pendiente cuando
    el ciclo se reinicia").
  · "Repetir hasta": fecha tope opcional. Vacío = indefinido.
* Schema: bumpeado a v4 con nueva tabla `wp_imcrm_recurrences`.
  El upgrade silencioso del runtime aplica `dbDelta`
  automáticamente al cargar el plugin.
* Backend: `DateRoller` puro para cálculo de la siguiente fecha
  (12 unit tests cubren casos como Feb29 → Feb28 en años
  no-bisiestos, last_day respetando 28/30/31, weekday-of-month
  con N inexistente). `RecurrenceRunner` se engancha a
  `imagina_crm/record_updated` (status_change) y
  `ScheduledRunner::HOOK_TICK` (schedule).
* REST: `GET / POST / DELETE
  /imagina-crm/v1/lists/{list}/records/{id}/recurrences`. Upsert
  por `(record_id, date_field_id)` — UNIQUE constraint a nivel BD.
* UI: icono ↻ aparece junto a cada celda con valor de fecha. En
  verde si tiene recurrencia activa; en gris suave si no. El
  popover usa Radix con collision-detection para no cortarse
  contra los bordes.

= 0.20.0 =
* Fix visual del if/else: el "tercer hilo" central que iba paralelo
  a las líneas Sí/No (visualmente daba la sensación de un tercer
  flujo) desapareció. Ahora las dos ramas convergen al siguiente
  slot/acción del padre — semántica más clara.
* Operadores en condiciones de automatización (triggers, acciones
  if/sino, condición de ejecución de acción): antes solo `=`
  ("eq"). Ahora soporta el set completo según tipo de campo:
  · Texto/email/url: contiene, no contiene, es, no es, empieza
    con, termina con, está/no está establecido.
  · Número/moneda: =, ≠, >, ≥, <, ≤, está/no está establecido.
  · Fecha/datetime: es, no es, desde, hasta, está/no está
    establecido + chips de rangos rápidos (Hoy, Esta semana,
    Mes pasado, Últimos 7/15/30 días, etc.).
  · Select/multi_select: es, no es, es alguno de, no es ninguno
    de, está/no está establecido.
  Implementado vía un componente unificado `<ConditionEditor>`
  que reusa `FilterValueInput` y `DateRangePresetButtons` de
  records — misma UX rica que ya tenía el panel de filtros
  desde 0.17.0.
* Backend `ConditionEvaluator::matches` extendido: además del
  shape legacy `{slug: value}` (eq-only) ahora acepta el shape
  rico `[{slug, op, value}, ...]` con operadores. Detecta
  automáticamente cuál es. Compat completa con automatizaciones
  guardadas en versiones anteriores.
* Operador `not_contains` añadido al `QueryBuilder` (records
  filters): emite `(col IS NULL OR col NOT LIKE ?)` para que
  records con valor NULL también matcheen "no contiene".
* Labels de operadores refinados: `is_null` → "no está
  establecido" (antes "está vacío"), `is_not_null` → "está
  establecido" — más natural en contexto general (no solo
  texto). Reordenados para mostrar primero los más comunes.
* Tests: 11 nuevos en `ConditionEvaluatorTest` cubriendo todos
  los operadores (eq, neq, contains, not_contains, gt/gte/lt/lte,
  is_null, is_not_null, in, nin, starts_with, ends_with) +
  date range via gte+lte. 1 nuevo en `QueryBuilderTest` para
  `not_contains` con null safety.

= 0.19.0 =
* Visual Builder de automatizaciones: slots de inserción "+" entre
  cada par de nodos y al final de cada rama (root, Sí, No). Click
  en un slot abre el type-picker e inserta la acción exactamente
  ahí — antes solo se podía agregar al final del flujo lineal,
  ignorando ramas. Ahora el usuario puede:
  · Insertar una acción AL INICIO del flujo (slot 0).
  · Insertar entre dos acciones existentes.
  · Insertar dentro de la rama Sí del condicional, en cualquier
    posición.
  · Insertar dentro de la rama No del condicional, en cualquier
    posición.
  · Anidar más condicionales dentro de las ramas.
* Removidos los handles draggable visibles en los nodos de
  acción/trigger — antes mostraban un puntito de "arrastra para
  conectar" que parecía interactivo pero no hacía nada (el grafo
  no soporta conexiones libres porque la estructura es un árbol
  de actions, no un DAG). Ahora son invisibles, solo sirven
  internamente como anchor de los edges. El cursor de drag ya
  no engaña al usuario.
* El FAB "Añadir acción" se renombró a "Añadir al final" para
  diferenciarlo de los slots inline. Sigue funcionando igual:
  appendea al final de la chain raíz.
* Texto explicativo bajo el canvas actualizado: "Click en un slot
  '+' entre nodos para insertar una acción ahí. Las ramas Sí/No
  del condicional tienen sus propios slots."

= 0.18.2 =
* Fix: el panel de filtros se cortaba contra la sidebar en algunos
  layouts — el `position: absolute; right: 0` sobre el wrapper del
  botón ignoraba el viewport y el panel de 760px se metía bajo la
  sidebar fija. Reescrito a Radix `Popover` con
  `collision-padding: 16px` que reposiciona/auto-flippea
  automáticamente para que el panel SIEMPRE quede dentro del
  viewport visible. Width también es responsive ahora
  (`min(720px, 100vw - 2rem)`) — en pantallas angostas se reduce a
  ancho de viewport menos margen, en lugar de cortarse.

= 0.18.1 =
* Fix: el panel de filtros (introducido en 0.17.0) se veía vacío al
  abrirlo cuando no había filtros aún — solo mostraba "Filtros
  guardados" + X. La causa: en estado vacío `FilterGroupView` solo
  renderizaba un botón pequeño "Agregar filtro" con margen-left que
  podía no ser visible según el viewport, dejando el panel sin un
  CTA claro. Ahora el estado vacío muestra una card centrada con
  ícono de filtro, mensaje "Sin filtros activos" y botón
  "Agregar filtro" prominente como CTA principal.
* Refinamiento del header del panel: "Filtros" + ícono se renderean
  como un único `<h3>` con clases de color explícitas (no se podía
  ocultar por especificidad CSS heredada). Saved-filters dropdown
  + close button quedan a la derecha.
* Defensiva: `viewConfigToState` ahora valida que `config.filter_tree`
  sea un objeto con `type === 'group'` y `children` array antes de
  aceptarlo. Saved Views con filter_tree malformado caen al árbol
  vacío en vez de romper toda la página.

= 0.18.0 =
* Picker visual de variables ClickUp-style en automatizaciones. Los
  inputs de Send Email (Para, Asunto, Cuerpo, Cc, Bcc), Call Webhook
  (URL, Body) y Update Field (Valor) ahora muestran chips abajo con
  los campos de la lista — click en un chip inserta `{{slug}}` en la
  posición exacta del cursor sin que el usuario tenga que tipear
  llaves. Botón "+ N" abre un popover searchable con TODAS las
  variables agrupadas en "Campos" (de la lista) y "Sistema"
  (record.id, timestamps, date.now, date.today, user.email,
  user.display_name, signature). El cursor se preserva tras la
  inserción.
* Backend: extendido `AbstractAction::applyMergeTags()` con nuevos
  tags resolvibles:
  · `{{record.created_at}}` / `{{record.updated_at}}` / `{{record.created_by}}`.
  · `{{date.now}}` (ISO 8601 UTC) y `{{date.today}}` (YYYY-MM-DD
    en zona del sitio).
  · `{{user.id|email|display_name|login}}` — datos del autor del
    registro, fallback al usuario actual.
  · `{{signature}}` — firma de email guardada del autor.
* Firma de email per-usuario. Editor en Settings → "Firma de email"
  (textarea HTML + vista previa en vivo). Persistido en
  `user_meta:imcrm_email_signature` con `wp_kses_post` sanitization
  (acepta links/formato/imágenes; bloquea scripts). REST endpoints
  `GET/PATCH /imagina-crm/v1/me/email-signature`.
* Botón "+ Agregar firma" en el body de los emails de automatización:
  inserta el HTML guardado en el cursor con doble salto de línea
  antes para separación visual. Si el usuario no tiene firma
  guardada, no hace nada (sin error).
* Tests: 5 nuevos en `MergeTagsTest` cubriendo metadata del registro,
  date.now/today (regex de formato), y comportamiento de signature
  cuando no hay user meta.

= 0.17.0 =
* Refactor mayor de filtros: panel inline ClickUp-style con AND/OR
  + grupos anidados + filtros guardados.
  · Reemplazado el viejo `<FiltersBar>` (chips + popover) por un
    `<FiltersPanel>` con chip toggleable arriba a la derecha. Al
    abrirse muestra cada filtro como una fila inline (Campo →
    Operador → Valor → 🗑) con conector "Y/O" entre filas. El
    conector es clickeable y togglea la lógica del grupo.
  · "Agregar filtro anidado" debajo de cada fila inserta un
    sub-grupo con su propia lógica AND/OR independiente. Permite
    expresar `(A AND B) OR (C AND D)`.
  · "Borrar todo" a la derecha del footer del panel.
  · El árbol nuevo se persiste en `SavedView.config.filter_tree`.
    Para árboles AND-planos también se escribe el espejo legacy
    `filters` para compat con builds anteriores. Para árboles con
    OR/nesting solo se escribe `filter_tree`. Carga retro-compat:
    si solo hay `filters`, se convierte automáticamente.
* Backend: nuevo `QueryBuilder::compileTreeWhereForList()` que
  recorre el árbol recursivamente y compila a SQL anidado con
  paréntesis. Profundidad máxima 8 (defensa contra payloads
  abusivos), nodos inválidos se descartan silenciosamente. El
  endpoint `/records` y `/records/groups` aceptan el árbol como
  `filter_tree` (JSON-encoded query param) además del shortcut
  plano `filter[...]`. `WidgetEvaluator` también lo respeta.
* Filtros guardados (entidad nueva): `wp_imcrm_saved_filters`
  guarda sets nombrados de árboles reusables entre vistas. Cada
  filtro pertenece a un usuario (Personal) o es compartido con
  todo el "Entorno de trabajo" (`user_id` NULL). El panel tiene
  un dropdown "Filtros guardados" con búsqueda + dos secciones
  (Personal / Compartido) + "Guardar nuevo filtro". REST endpoints
  `GET/POST/PATCH/DELETE /lists/{list}/saved-filters[/{id}]`.
* DB version bumpeada a 3. La tabla nueva se crea automáticamente
  en activación o en el upgrade silencioso del runtime.
* Tests: 4 nuevos en `QueryBuilderTest` cubriendo group AND, group
  OR (con paréntesis), nested groups, y skip de fields desconocidos.

= 0.16.0 =
* Fix CRÍTICO del Dashboard: los widgets se reorganizaban a una sola
  columna al achicar la ventana del navegador y ESA posición se
  persistía como canónica — pérdida de la disposición real del
  usuario. Causa: `DashboardGrid` usaba `Responsive` con breakpoints
  lg/md/sm/xs/xxs (12/12/8/4/2 cols), que recompacta el layout para
  caber en cada breakpoint, y nuestro `onLayoutChange` guardaba el
  layout reorganizado. Cambio a `GridLayout` (no responsive) de 12
  columnas fijas — la UI del plugin es desktop-only (CLAUDE.md §17,
  ≥1024px). Persistencia ahora SOLO vía `onDragStop`/`onResizeStop`,
  que solo se disparan en interacciones del usuario.
* Nueva feature: rangos de fecha rápidos en filtros. El popover de
  filtro de campos `date`/`datetime` ahora muestra una fila de
  presets — Hoy, Ayer, Esta semana, Semana pasada, Este mes,
  Mes pasado, Últimos 7/15/30 días, Este año, Año pasado,
  Personalizado. Click → genera un par `gte`+`lte` automáticamente.
  Cálculo en local del navegador, así "Esta semana" abarca el lunes
  00:00 al domingo 23:59 del usuario.
* Nueva feature: filtros arbitrarios en widgets de Dashboard. El
  `WidgetFormDialog` expone una sección "Filtros" que reusa la misma
  `<FiltersBar>` de las listas — cualquier campo, cualquier operador,
  más los presets de fecha. El widget guarda los filtros en
  `config.filters` y `WidgetEvaluator` los aplica a TODAS sus queries
  internas (count, sum/avg, group-by, line, stat_delta, table) vía un
  nuevo `QueryBuilder::compileWhereForList()` que reusa el mismo
  pipeline `normalize`+`buildWhere` del endpoint `/records`.
* Tests: 3 nuevos integration tests en `WidgetEvaluatorTest`
  (kpi.count + kpi.sum + chart_bar respetando filtros) + 2 unit
  tests en `QueryBuilderTest` (compileWhereForList con filtros
  válidos y fail-open con filtros inválidos).

= 0.15.1 =
* Fix: la vista agrupada (introducida en 0.15.0) no respetaba la
  configuración de columnas ocultas — siempre mostraba todas. La
  causa era que `GroupedTableView` no recibía el state
  `columnVisibility` y construía sus columnas desde cero. Ahora
  filtra por el mismo flag que `TableView`, así el ColumnsMenu se
  comporta idéntico en modo plano y agrupado.

= 0.15.0 =
* Nueva feature: agrupación ClickUp/Airtable-style en la vista de
  tabla. Toolbar tiene un nuevo selector "Agrupar por" que lista los
  campos agrupables (select, multi_select, user, checkbox, date,
  datetime). Al elegir uno, la tabla se reorganiza por buckets (cada
  uno con su count) y los registros se cargan lazy al expandir el
  grupo — evita traer 5k filas para sólo expandir uno con 30. Cuando
  hay filtros activos los buckets reflejan SOLO esos.
* Backend: nuevo endpoint `GET /imagina-crm/v1/lists/{list}/records/groups`
  que devuelve `{value, count}` por bucket respetando filters/search.
  Implementado vía un nuevo `QueryBuilder::buildGroupQuery()` que
  para tipos escalares hace `GROUP BY` directo y para `multi_select`
  hace UNNEST con `JSON_TABLE` (MySQL 8.0+ — requisito del plugin)
  para que un record con `["a","b"]` cuente para ambos buckets.
  Bucket "(Sin valor)" siempre va al final.
* La elección de agrupación se persiste por SavedView en
  `config.group_by_field_id` (mismo campo que ya usaba kanban; el
  `view.type` discrimina contexto). Vista guardada con grouping
  recuerda la elección al volver.
* Tests: nuevos casos en `QueryBuilderTest` (4) e
  `RecordServiceTest` (3) cubriendo buckets escalares, multi_select
  unnest, ordering del null bucket, y rejection de tipos no
  agrupables.

= 0.14.2 =
* Fix CRÍTICO: el reset scopeado en `globals.css` con selectores
  como `#imcrm-root button` (especificidad 101) y
  `[class*='imcrm-'] button` (especificidad 11) estaba pisando
  TODAS las utilities de Tailwind (`.imcrm-bg-primary` = 10) en
  los buttons del SPA. Causa raíz: Vite/PostCSS aplana
  `@layer base` al compilar, así que la cascada queda regida
  por especificidad pura — no por orden de layers como uno
  asumiría. Síntoma: todos los buttons mostraban un "halo"
  gris/transparente en hover, los hover bg nunca se aplicaban.
* Cleanup: removido el reset scopeado entero (button/a/select
  básicos). Ahora el SPA standalone hereda el reset inline de
  `StandalonePage::inlineReset()` con selectores type-only
  (especificidad 1) que NO compiten con utilities. Lo único
  que queda en `globals.css` son tres reglas envueltas en
  `:where()` (especificidad 0): border-color default,
  appearance reset para `<select>` nativo (que mantiene chevron
  custom), y accent-color para checkboxes.
* Removido el `@apply imcrm-ring-2 imcrm-ring-offset-2` global
  en `:focus-visible` que generaba el halo despegado del borde
  en cualquier elemento enfocado. Cada primitiva (Button, Input,
  Select) define su propio focus ring.

= 0.14.1 =
* Fix: hover artifact ("halo" gris pegado al botón) que aparecía
  en TODOS los buttons al pasar el mouse. Causa raíz: el reset de
  Tailwind preflight inyectado en el shell standalone usaba
  `-webkit-appearance: button`, que en algunos navegadores
  reactiva chrome del UA (border raster, padding propio,
  outline al focus) y se mezclaba con los hover bg de Tailwind
  produciendo el efecto "pastilla". Cambio a `appearance: none` +
  `-webkit-appearance: none`, `border-radius: 0` y
  `outline: none` en focus default. El focus accesible lo maneja
  `focus-visible` del propio componente.
* Refinamiento: focus ring del `<Button>` ahora es flush (sin
  `ring-offset`). El offset positivo creaba un halo despegado
  del borde que se confundía con un estado "seleccionado pegado"
  cuando aparecía en hover+focus simultáneo.

= 0.14.0 =
* Refactor visual de buttons + cleanup de workarounds que ya no
  hacen falta ahora que el SPA vive standalone (sin chrome de WP):
  · `<Button>` rediseñado: padding generoso (px-4 default vs
    px-3.5), gap-2 entre icon+text (vs 1.5), sin sombras inset
    raras en primary/destructive (color sólido hace el trabajo),
    sin `active:scale-[0.98]` global (sentía gimmicky), hover
    states más sutiles. Todas las variantes recalibradas.
  · `globals.css`: removido el reset hacky de `:where(...:hover)
    {bg: transparent}` que servía para domar UA defaults filtrados
    desde wp-admin. Ya no aplica — la página standalone tiene
    Tailwind preflight inline propio. El reset basal de `<button>`
    se mantiene como defensa en profundidad.
* Fix: tabs Formulario / Diagrama del builder de automatizaciones
  estaban PEGADOS uno encima del otro (el inactivo no tenía bg).
  Ahora el container es bg-canvas, los tabs van dentro con gap-1
  y el activo tiene bg-card + shadow — separación visual real.
* Fix: footer Cancelar/Guardar de los dialogs estaban pegados.
  gap-2 → gap-3 + padding-top mayor. "Cancelar" pasa de variant
  ghost a outline para tener afordance visible (botón blanco
  con border + hover bg) — antes parecía solo un texto suelto.
* Fix: dropdown "Tipo de acción" del visual builder con padding
  apretado en sus items. Reescrito con padding mayor (px-2.5
  py-2), icon-tile con bg-muted en cada item, header con
  tracking uppercase consistente. min-width 260px (antes 220px).

= 0.13.2 =
* Fix CRÍTICO: 0.13.1 todavía servía 404 en `/imagina-crm/` porque
  yo registraba `StandalonePage::register()` dentro del bloque
  `if (is_admin()) { ... }` en `Plugin::register()`. Pero
  `/imagina-crm/` es una request del FRONTEND — `is_admin()`
  devuelve `false` ahí — entonces los hooks de StandalonePage
  nunca se enganchaban y WordPress hacía su 404 normal.
* Solución: mover `StandalonePage->register()` afuera del
  if(is_admin()), antes del check. Ahora se registra en cualquier
  request (admin O frontend). Los hooks internos
  (`init`/`template_redirect`) ya filtran por URL así que el
  costo en requests no-CRM es trivial (un strpos del REQUEST_URI).

= 0.13.1 =
* Fix: 0.13.0 servía 404 en `/imagina-crm/` para muchos sites.
  Causa: el rewrite rule depende de un `flush_rewrite_rules()` que
  algunos hosts (nginx mal configurado, opcache agresivo, plugins
  de cache que cachan rules) no respetan inmediatamente.
* Solución: intercept directo del REQUEST_URI en `init` priority 0
  ANTES del `parse_request` de WP. Si el path matchea
  `/imagina-crm` o un subpath, renderizamos y `exit` — sin
  depender de rewrite rules, permalink structure ni cache de
  options. Funciona desde la primera request, en cualquier server.
* El rewrite rule + query var siguen registrándose como red de
  seguridad (caso edge donde otro plugin se mete antes de
  nuestro priority 0).

= 0.13.0 =
* Feature: el SPA ahora vive en una página standalone fuera del
  chrome de wp-admin. URL pública: `/imagina-crm/` (con pretty
  permalinks) o `/?imcrm_standalone=1` (con plain permalinks).
  Razones (todas reales, no cosméticas):
  · CERO bleed de estilos de wp-admin → los bugs tipo "pastilla
    gris UA" o "underline en links" no pueden volver. La página
    incluye su propio reset CSS minimal (subset de Tailwind
    preflight) inline.
  · First paint significativamente más rápido — sin jQuery, sin
    admin bar, sin `admin_head` de plugins terceros, sin estilos
    base de wp-admin.
  · El "fullscreen mode" deja de ser un overlay z-index hack.
* El menú lateral de wp-admin SIGUE existiendo como entry point
  familiar — pero el callback ya no monta el SPA inline; redirige
  a la URL standalone. Bookmarks viejos a
  `admin.php?page=imagina-crm` también redirigen, sin sorpresas
  de estilos rotos.
* Auth sin cambios — cookies de WP + nonce REST. No autenticado
  → redirect a wp-login con `redirect_to` apuntando de vuelta.
  Sin capability → 403.
* Rewrite rules con auto-flush via versión: bumpeás
  `StandalonePage::REWRITE_VERSION` cuando cambien las rules y
  `maybeFlushRewriteRules` (en `wp_loaded`) detecta el bump y
  refresca. Cubre el caso "el usuario actualiza el plugin sin
  re-activar".

= 0.12.4 =
* Fix CRÍTICO frontend: TODOS los filtros estaban rotos a nivel
  de URL — la función `buildUrl` en `app/lib/api.ts` solo
  serializaba UN nivel de anidamiento. Para filtros (que son
  `filter[field_5][eq]=value`, dos niveles), el segundo nivel
  `{eq: 'value'}` terminaba como `String(obj)` =
  `"[object Object]"`, lo que rompía silenciosamente cualquier
  filtro: text, select, multi_select, todos.
  Por eso aunque arreglamos el SQL del backend en 0.12.3, los
  tests integration (que llaman al service directo, no via
  REST) pasaban — pero la UI no enviaba bien el query string.
  Fix: `appendParam` recursivo soporta cualquier profundidad.
* Lección anotada: cuando el backend tests pasan pero el bug
  persiste, mirar el wire format completo (URL → server). Tests
  integration de PHP son necesarios pero no suficientes; falta
  un test E2E que cubra la cadena completa.

= 0.12.3 =
* Fix CRÍTICO: el filtro multi_select de 0.12.2 todavía fallaba
  por dos bugs en mi propia implementación (no me percaté
  porque no tenía MariaDB local; ahora SÍ corro tests integration
  contra MariaDB real y los 86 pasan).
  · `JSON_OVERLAPS` para el operador `in` se le pasaba
    `JSON_QUOTE(%s)` adentro — pero `JSON_ARRAY` ya auto-quotea
    los strings PHP. Resultado: doble-quoted (`["\"x\""]`)
    que jamás matcheaba. Fix: solo `%s`, dejar que JSON_ARRAY
    quotee.
  · `neq` y `nin` no incluían los registros con columna NULL.
    En multi_select el array vacío se serializa como NULL
    (no como `'[]'`), entonces "no contiene crocoblock" no
    devolvía a Cliente D que tiene plugins=[]. Fix:
    `(col IS NULL OR NOT JSON_CONTAINS(...))` en neq/nin.
* Test: nueva integration suite cubre eq, neq, contains, in,
  is_null sobre multi_select. Corre contra MariaDB real.

= 0.12.2 =
* Fix CRÍTICO: filtros sobre campos `multi_select` no matcheaban
  ningún registro. Causa: la columna almacena JSON arrays
  (`["elementor_pro","crocoblock"]`), pero el QueryBuilder usaba
  `col = 'elementor_pro'` que nunca matchea contra el JSON
  serializado. Fix: special-case en `compileFilter` para
  multi_select:
    · eq / contains  → `JSON_CONTAINS(col, JSON_QUOTE(value))`
    · neq            → `NOT JSON_CONTAINS(...)`
    · in             → `JSON_OVERLAPS(col, JSON_ARRAY(v1, v2, ...))`
    · nin            → `NOT JSON_OVERLAPS(...)`
    · is_null        → `(col IS NULL OR col = '[]')`
    · is_not_null    → `(col IS NOT NULL AND col <> '[]')`
* Fix: las vistas guardadas NO detectaban cambios cuando el
  usuario solo modificaba `hidden_columns` o `column_widths`
  (ocultar/resizear columnas). `stripPaginationOnlyKeys` no las
  incluía → `hasChangesVsView` devolvía false y los botones
  "Guardar cambios" / "Descartar" no aparecían. Ahora estas
  keys cuentan como diff válido.
* UX: cuando el usuario está en el tab "Todos" (sin vista
  activa), el botón para crear vista ahora es labeled
  "Guardar como vista" con border primary y bg suave en lugar
  de un ícono "+" diminuto. Hace mucho más obvio el flujo:
    1. Aplica filtros / oculta columnas / ordena
    2. Click "+ Guardar como vista" → nombre → enter
    3. Aparece como tab → al recargar persiste

  En vistas ya guardadas, el "+" compacto sigue ofreciendo
  "duplicar como nueva".

= 0.12.1 =
* Cleanup: removido el botón "Buscar… ⌘K" del Topbar. Era un
  stub disabled mientras pensábamos construir un command palette
  global; el usuario decidió que no lo necesita por ahora. Si en
  el futuro hace falta, se reintroduce. Mantra: nada de
  funcionalidades de sobra que no se vayan a usar.

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
