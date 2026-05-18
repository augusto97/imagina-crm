# Changelog

Todos los cambios notables de este proyecto se documentan aquí. Sigue [Keep a Changelog](https://keepachangelog.com/) y [SemVer](https://semver.org/).

## [Unreleased]

## [0.40.3] — 2026-05-17

**Roles personalizados** (Fase 10 — pulidos · **CIERRE DE FASE 10**).
Con este release el plan multi-stakeholder completo (Fases 7-10)
queda cerrado.

### Añadido

- `src/Permissions/CustomRoleService.php` — CRUD de roles custom en
  `wp_options.imcrm_custom_roles`. Slug saneado a `[a-z0-9_]`, caps
  filtradas a SOLO `imcrm_*`.
- `RoleInstaller::syncCustomRoles()` sincroniza con wp_roles tras
  cada save/delete y remueve roles obsoletos.
- Endpoints REST:
    * `GET /roles` ahora incluye `custom_roles` + `capabilities`.
    * `POST /roles` crea/actualiza un rol custom.
    * `DELETE /roles/{slug}` borra.
- UI: `CustomRolesCard.tsx` en Settings con lista + form de
  crear/editar con checkboxes de caps.
- 15 tests nuevos en `CustomRoleServiceTest`.
- Stub `wp_roles()` en `tests/bootstrap.php`.

### Plan multi-stakeholder COMPLETO

| Fase | Versiones | Estado |
|------|-----------|--------|
| 7 — Roles y permisos | 0.37.0-0.37.3 | ✅ |
| 8 — Listas públicas | 0.38.0-0.38.4 | ✅ |
| 9 — Portal cliente | 0.39.0-0.39.9 | ✅ |
| 10 — Pulidos | 0.40.0-0.40.3 | ✅ |

## [0.40.2] — 2026-05-17

**Permalinks dedicados** (Fase 10 — pulidos). Una lista pública con
`permalink_base` configurado se vuelve accesible en `/{permalink_base}/`
además del shortcode.

### Añadido

- `PublicListConfig.permalinkBase: ?string` + sanitización
  (`sanitizePermalink`).
- `src/PublicLists/PublicPermalinks.php`:
    * Registra rewrite rules en `init` por cada lista pública con
      permalink_base.
    * Auto-flush vía signature en `wp_loaded` (sin intervención manual).
    * Render en `template_redirect` priority 5 con
      `get_header()` + `do_shortcode([imcrm-list slug=...])` +
      `get_footer()`.
- UI: input "Permalink dedicado" en `PublicVisibilityPanel`.
- 7 tests nuevos en `PublicListConfigTest`.

### Restricciones

- Requiere pretty permalinks activos.
- Slug clamp a 64 chars, solo a-z0-9-.
- Rules con priority `top` → ganan a otras rules WP.

## [0.40.1] — 2026-05-17

**Magic links** (Fase 10 — pulidos). Login sin password para clientes
del portal. Sin schema bump — tokens viven en transients de WP
auto-expirables.

### Añadido

- `src/Portal/MagicLinkService.php` — generate/consume con tokens
  one-time, 256 bits de entropía, storage por sha256(token).
- `src/Portal/MagicLinkConsumer.php` — hook `template_redirect`
  priority 5 que detecta `?imcrm_token=...`, valida, autentica
  via `wp_set_auth_cookie`, redirige limpio.
- `POST /portal/lists/{slug}/records/{id}/magic-link` con cap
  `imcrm_manage_lists` y email automático opt-in.
- 15 tests unitarios en `MagicLinkServiceTest`.

### Stubs WP nuevos

- transients + wp_set_auth_cookie + wp_http_validate_url +
  add_query_arg.

## [0.40.0] — 2026-05-17

Arranque de la **Fase 10 — Pulidos** (per-field permissions). Cierra
el ciclo de `fields_hidden` que existía en el shape de ListPermissions
desde 0.37.1 pero no estaba enforced server-side ni configurable
visualmente.

### Añadido

- Enforcement server-side en `RecordsController`:
    * GET /records → strip de slugs ocultos antes de serializar.
    * GET /records/{id} → mismo strip per-record.
    * PATCH /records/{id} → 403 con lista de slugs no editables si
      el body intenta tocar campos ocultos.
- Helpers `stripHiddenFields()` y `stripHiddenFieldsFromRow()` en
  `RecordsController`.
- Sección "Campos ocultos por rol" en `PermissionsPanel` — tabla
  `campo × rol` con checkboxes, colapsable con `<details>`.
- Setter `toggleHiddenField(role, slug, hide)`.

### Comportamiento

`PermissionService::hiddenFieldSlugs(user, list)` ya existía y devuelve
la INTERSECCIÓN de slugs ocultos en todos los roles del user — si AL
MENOS UN rol revela el campo, queda visible. Admins tienen bypass total.

## [0.39.9] — 2026-05-17

Editor visual del template del portal del cliente. Reemplaza el
textarea JSON + botones "Insertar ejemplo" del PortalConfigPanel
por un editor de bloques con cards colapsables y forms específicos
por tipo.

### Añadido

- `app/admin/lists/PortalTemplateEditor.tsx`:
    * Lista de cards (BlockCard) con reorder/delete/expand.
    * Form de config por tipo de bloque (BlockConfigForm) — inputs
      específicos para los 8 tipos.
    * Botón "Agregar bloque" con dropdown.
    * Toggle "Modo avanzado (JSON)" para casos donde el form no
      cubra alguna config exótica o para copy-paste de templates.

### Cambiado

- `PortalConfigPanel` refactor:
    * State con `template: PortalTemplate` directo (no string JSON).
    * `handleSave` simplificado (no parsing).
    * Sin manejo local de jsonError (movido al editor en modo
      avanzado).

### Métricas

ListBuilderPage chunk: 16.49 KB gzip (+1.69 KB vs 0.39.8). Mejora
UX significativa por el costo.

## [0.39.8] — 2026-05-17

Dos bloques avanzados nuevos para el portal del cliente. Con esto
el portal cubre 8 de los 11 tipos del plan original.

### Añadido

- Bloque `activity_timeline` — timeline del record del cliente.
  Endpoint nuevo `GET /portal/me/activity` que reusa
  `ActivityRepository::recentForRecord` (Fase 7).
- Bloque `download_files` — lista de attachments del record.
  100% client-side, usa endpoint nativo de WP
  `/wp-json/wp/v2/media?include=N` (sin nuevo endpoint del plugin).
- `PORTAL_BLOCK_TYPES` ampliado en panel admin con los 2 nuevos
  + ejemplos en `exampleConfigFor`.

### Total tipos de bloque del portal: 8/11

- 3.D: static_text, client_data, related_records_table.
- 3.E: editable_form, external_link, kpi_widget.
- Pulidos: activity_timeline, download_files.

Restantes opcionales: related_records_kanban, chart_widget,
comments_thread.

## [0.39.7] — 2026-05-17

Tres pulidos post-Fase 9 de mejora UX/seguridad.

### Añadido

- `PortalAccessButton` en panel CRM del record (Fase 9 follow-up #1).
- `EditableCell.canEdit` prop + gating per-cell en TableView
  (Fase 7 follow-up #5).
- Inputs específicos por tipo en `editable_form` del portal:
  `PortalController::enrichTemplateBlocks` agrega `editable_fields`
  con `{slug, label, type, config}` resuelto desde FieldEntity; el
  bundle del portal usa esos types para renderizar inputs específicos
  (date, datetime, number, email, url, checkbox, select, multi_select,
  long_text).

## [0.39.6] — 2026-05-17

**Cierre de la Fase 9.** Trae el panel "Portal del cliente" al List
Builder para configurar `settings.portal` y `settings.portal_template`
desde UI visual.

### Añadido

- `app/types/portal.ts` — tipos espejo + defaults + catálogo de
  tipos de bloque con labels.
- `app/admin/lists/PortalConfigPanel.tsx` — panel completo:
    * Toggle habilitar portal.
    * Selector de owner_field filtrado a tipo Usuario.
    * Editor JSON del template + 6 botones "Insertar ejemplo" para
      cada tipo de bloque (genera ejemplos editables sin tener que
      memorizar shapes).
    * Validación client-side (JSON parseable, owner_field requerido
      si enabled, owner_field debe ser tipo user).
    * Snippet del shortcode con botón copiar.
    * Estado colapsado cuando disabled.

### Fase 9 cerrada

| Iter.  | Versión | Entrega                                              |
|--------|---------|------------------------------------------------------|
| 3.A    | 0.39.0  | PortalScopeService + 17 tests aislamiento críticos   |
| 3.B    | 0.39.1  | REST + shortcode + auth flow                         |
| 3.C    | 0.39.2  | PortalTemplate + default fallback                    |
| 3.D    | 0.39.3  | Bundle JS + 3 bloques base                           |
| 3.E    | 0.39.5  | 3 bloques avanzados + fix aggregator scope           |
| 3.G    | 0.39.4  | PortalAccountManager + endpoint Crear acceso         |
| UI     | 0.39.6  | Tab "Portal del cliente" en List Builder             |

### Piezas opcionales que quedan

- Botón "Crear acceso al portal" en panel CRM del record.
- Bloques aún más avanzados (activity_timeline, comments_thread,
  chart_widget, etc.).
- Editor visual drag-and-drop del template.

## [0.39.5] — 2026-05-17

Continuación de la **Fase 9 — Portal del cliente** (iteración 3.E:
bloques avanzados + fix limitación de aggregator). Tres tipos de
bloque nuevos al portal + cierre del TODO de Fase 7 sobre
`AggregatesController` con scope acotado.

### Añadido

- `editable_form` — cliente actualiza subset whitelisteado de
  campos. Endpoint `PATCH /portal/me` con validación estricta de
  whitelist (slug fuera → 403 explícito).
- `external_link` — CTA con link externo.
- `kpi_widget` — métrica simple sobre records relacionados.
- `RecordAggregator::aggregate` ahora acepta `$additionalWhere`
  (mismo shape que `QueryBuilder::buildSelect`).
- `GET /portal/lists/{slug}/aggregates` para el `kpi_widget`.
- `PortalTemplate::editableFieldSlugs()` — unión deduplicada de
  slugs editables de todos los bloques `editable_form`.

### Cambiado

- `AggregatesController` ya no devuelve 403 para usuarios con
  scope acotado. Inyecta el scope al aggregator y devuelve
  agregados limitados al scope del usuario. Cierre del TODO de
  Fase 7 — 1.D.

### Tests

- 4 tests nuevos en `PortalTemplateTest` (editableFieldSlugs,
  parsing de nuevos tipos).
- Test del aggregator con additionalWhere queda en backlog
  (requiere FakeWpdb con `get_row`).

### Próximos pasos opcionales

- Bloques aún más avanzados (activity_timeline, comments_thread,
  chart_widget, etc.).
- UIs admin del portal (botón Crear acceso, tab Configuración).

## [0.39.4] — 2026-05-17

Continuación de la **Fase 9 — Portal del cliente** (iteración 3.G:
PortalAccountManager + endpoint "Crear acceso"). Automatiza el flujo
de creación de cuentas WP para clientes.

### Añadido

- `src/Portal/PortalAccountManager.php`:
    * Crea o reactiva usuario WP con rol crm_client.
    * Asocia user_id al owner_field del record.
    * Envía email de bienvenida via wp_send_new_user_notifications.
    * Idempotente: reintento sin efectos colaterales.
    * Reusa WP users existentes por email.
- `POST /imagina-crm/v1/portal/lists/{slug}/records/{id}/access`
  con cap `imcrm_manage_lists`.

### UI pendiente

El botón "Crear acceso al portal" en el panel CRM del record queda
como mejora opcional. El endpoint está disponible via curl/Postman.

### Estado de Fase 9

Funcional end-to-end. Las piezas opcionales restantes son:
- 3.E — Bloques avanzados (editable_form, kpi, charts, etc.).
- UI de configuración del portal (similar al PublicVisibilityPanel
  de Fase 8).
- UI del botón "Crear acceso al portal".

## [0.39.3] — 2026-05-17

Continuación de la **Fase 9 — Portal del cliente** (iteración 3.D:
bundle JS + renderer + bloques base). El portal queda funcional
end-to-end para casos básicos.

### Añadido

- `app/portal.tsx` — entry bundle (1.89 KB gzip + 45.7 KB
  vendor-react compartido).
- `app/portal/PortalRenderer.tsx` — fetch `/portal/me` + render
  iterando `template.blocks`.
- `app/portal/blocks/` — tres bloques: `StaticTextBlock`,
  `ClientDataBlock`, `RelatedRecordsTableBlock`.
- `vite.config.ts`: `app/portal.tsx` añadido a `input`.
- `PortalAssets.php` reescrito para enqueuear el bundle via
  manifest (mismo patrón que `PublicAssets`).
- CSS extendido con estilos para los bloques.

### Limitaciones conocidas

- Sin paginación interactiva en related_records_table (queda para
  3.E).
- Sin tests del bundle JS (Vitest no configurado).

### Próximos pasos

- 3.E — Bloques avanzados (opcionales).
- 3.G — Botón "Crear acceso al portal".

## [0.39.2] — 2026-05-17

Continuación de la **Fase 9 — Portal del cliente** (iteración 3.C:
template + default fallback). Sistema de templates almacenado en
`settings.portal_template` (JSON, sin tabla nueva — decisión de
simplificar respecto al plan original).

### Añadido

- `src/Portal/PortalTemplate.php` — value object con whitelist de
  tipos válidos (`client_data`, `related_records_table`, `static_text`)
  + `defaultFor(fields)` que genera template usable sin config previa.
- `PortalController::getMe` ahora devuelve `template: {blocks: [...]}`.
  Si la lista no tiene `portal_template`, se inyecta el default.
- 9 tests nuevos en `PortalTemplateTest`.

### Decisión de diseño

El plan original proponía una tabla `wp_imcrm_templates` con columna
`kind`. Se simplifica a un JSON en `settings.portal_template` —
reusa la misma infra que `crm_panel_template` ya existente. Cero
schema bump, menos código, suficiente para los casos previstos.

### Próximas iteraciones

- 3.D — Bundle `app/portal.tsx` + renderer de bloques.
- 3.E — Bloques avanzados (opcional).
- 3.G — Botón "Crear acceso al portal".

## [0.39.1] — 2026-05-17

Continuación de la **Fase 9 — Portal del cliente** (iteración 3.B:
REST + shortcode + auth flow).

### Añadido

- `src/REST/PortalController.php` con 3 endpoints (cap
  `imcrm_access_portal`):
    * `GET /portal/me`
    * `GET /portal/lists/{slug}/records`
    * `GET /portal/lists/{slug}/records/{id}`
  Todos inyectan el scope SQL de `PortalScopeService` para garantizar
  aislamiento de datos.
- `src/Portal/PortalShortcode.php` — shortcode
  `[imcrm-client-portal]` con 4 estados de auth gate (no logged-in,
  no access, unlinked, ok).
- `src/Portal/PortalAssets.php` — enqueue lazy del CSS solo en
  páginas con el shortcode.
- `assets/portal.css` — estilos base con variables override-ables
  y dark mode automático.

### Próximas iteraciones

- 3.C — Template editor extendido (schema BD).
- 3.D-3.E — Bloques del template.
- 3.F — Bundle `app/portal.tsx`.
- 3.G — Botón "Crear acceso al portal".

## [0.39.0] — 2026-05-17

Arranque de la **Fase 9 — Portal del cliente** (iteración 3.A:
foundation + aislamiento). Sin REST controller ni UI todavía — solo
la lógica de autorización pura.

### Añadido

- `src/Portal/PortalConfig.php` — value object que parsea
  `settings.portal`. Requiere `owner_field_id` para `isPortalList()`.
- `src/Portal/ClientResolverInterface.php` + `ClientResolver` —
  resuelve `WP_User` → record-cliente. Fail-closed en cualquier
  mis-config.
- `src/Portal/PortalScopeService.php` — genera el WHERE inyectable
  al QueryBuilder. Cuatro casos cubiertos (lista portal, field user,
  field relation, fallback 1=0).

### Reglas de oro

1. Sin record-cliente → 1=0 en TODAS las listas.
2. Ambigüedad de vínculo → `user` field gana sobre `relation`.
3. Fail-closed siempre. Mis-config produce 1=0, nunca "ver todo".

### Tests (CRÍTICOS)

- 17 tests en `PortalScopeServiceTest` cubriendo todos los casos
  de aislamiento. Cualquier failure es un data leak.
- 6 tests en `PortalConfigTest`.

### Próximas iteraciones

- 3.B — REST controllers `/portal/*` + shortcode + auth flow.
- 3.C — Template editor extendido (schema BD + kind=client_portal).
- 3.D-3.E — Bloques del template (client_data, editable_form,
  related_records, kpi, charts, activity, comments).
- 3.F — Bundle `app/portal.tsx` + renderer.
- 3.G — Botón "Crear acceso al portal".

## [0.38.4] — 2026-05-17

**Cierre de la Fase 8.** Última iteración (2.E): tab "Visibilidad
pública" en el List Builder. El admin ya no necesita editar JSON via
REST PATCH para configurar listas públicas — todo se hace desde UI.

### Añadido

- `app/types/publicList.ts`: tipos espejo de `PublicListConfig.php`
  + defaults + limits (per_page [1, 100], cache_ttl [0, 3600]).
- `app/admin/lists/PublicVisibilityPanel.tsx`: panel completo de
  configuración con:
    * Toggle master + estado colapsado cuando off.
    * Tabla campo-por-campo con dos toggles (visible / ordenable).
    * Inputs clampeados para per_page y cache_ttl.
    * Toggles para search_enabled y viewer_filters_allowed.
    * Dropdown dinámico "Orden por defecto" (combinaciones
      slug:asc/desc de campos ordenables).
    * Snippet del shortcode con botón copiar al portapapeles.
    * Dirty tracking — botón guardar solo activo si hay cambios.

### Diseño de merge

El panel solo escribe `settings.public`; el resto del shape (otras
keys del settings) queda intacto. Evita race conditions con otros
paneles (Permissions, etc.).

### Limitaciones

- `fixed_filter_tree` se persiste pero no se edita visualmente en
  este panel — requiere refactor del FiltersPanel del admin para
  hacerlo embebible. Admins que lo necesiten siguen usando REST
  PATCH directo. UI visual queda como mejora futura.

### Fase 8 cerrada

| Iter. | Versión | Entrega                                          |
|-------|---------|--------------------------------------------------|
| 2.A   | 0.38.0  | PublicListConfig + Service + REST público        |
| 2.B   | 0.38.1  | Shortcode con render server-side                 |
| 2.C   | 0.38.2  | Bundle JS público (~48 KB gzip total) +
                  hidratación                                       |
| 2.D   | 0.38.3  | Bloque Gutenberg                                 |
| 2.E   | 0.38.4  | Tab "Visibilidad pública" en List Builder        |

## [0.38.3] — 2026-05-17

Continuación de la **Fase 8 — Listas públicas** (iteración 2.D: bloque
Gutenberg). Trae el bloque `imagina-crm/list` al editor de bloques sin
agregar dependencias nuevas al frontend.

### Añadido

- `src/PublicLists/Block.php` — registra el bloque server-rendered.
  Reutiliza el `Shortcode::render` (no duplica lógica).
- Atributos: `slug` (string), `perPage` (integer), `extraClass` (string).
- Soporta align `wide|full` y `customClassName`.
- Placeholder visible en el editor cuando falta el slug (solo a
  usuarios con `edit_posts`).

### Decisión técnica

Bloque server-rendered puro sin JS de editor custom — WP autogenera
el inspector desde la `attributes` schema. Cero dependencias nuevas
en `package.json`, sin inflar bundle del editor.

### Tests

- 5 tests unitarios en `BlockTest` cubriendo placeholder, anonymous
  visitor, delegación al shortcode y atributos extra.
- Override callable de `current_user_can()` en `tests/bootstrap.php`
  para tests sin `WP_User` completo.

### Próximo paso

- 2.E — Tab "Visibilidad pública" en List Builder (UI de configuración).

## [0.38.2] — 2026-05-17

Continuación de la **Fase 8 — Listas públicas** (iteración 2.C:
bundle JS público + hidratación). El shortcode pasa de ser HTML
estático a una tabla interactiva con búsqueda, sort y paginación.

### Añadido

- `app/public.tsx` — entry point del bundle público. Hidrata todos los
  `<div data-imcrm-public-list>` del DOM con React.
- `app/public/PublicList.tsx` — componente principal. Sin TanStack
  Query/shadcn/Lucide; React 18 + fetch nativo.
- `app/public/api.ts` — cliente fetch con cache en memoria por URL.
- `app/public/types.ts` — tipos compartidos.

### Cambiado

- `vite.config.ts`: `input` ahora es array (admin + público).
  `manualChunks` separa React/ReactDOM en chunk `vendor-react`
  compartido entre ambos entries. TanStack Query queda en
  `vendor-query`.
- `PublicAssets.php`: lee `dist/manifest.json` para resolver los
  chunks. Enqueue de vendor-react + public.js con `type="module"`.
- `Shortcode.php`: el `data-imcrm-config` ahora incluye `columns`
  completos (slug/label/type) — el bundle JS los necesita para
  formatear celdas en re-renders.
- `assets/public-list.css`: extendido con estilos del toolbar,
  search, sort buttons, paginación, loading y error.

### Métricas

- Bundle público: **48 KB gzip total** para el visitante
  (vendor-react 45.7 + public 2.4). Bajo el target de 50 KB.
- TTFB: si `dist/manifest.json` falta, JS no se carga pero el HTML
  server-side sigue visible (degradación graceful).

### Limitaciones conocidas

- Filtros por campo soportados a nivel API pero sin UI todavía.
- Sin tests del bundle JS (Vitest no configurado).

### Próximas iteraciones

- 2.D — Bloque Gutenberg
- 2.E — Tab "Visibilidad pública" en List Builder + UI de filtros

## [0.38.1] — 2026-05-17

Continuación de la **Fase 8 — Listas públicas** (iteración 2.B:
shortcode con render server-side).

### Añadido

- `src/PublicLists/PublicListReader.php` — interfaz que abstrae la
  lectura pública (findPublicList, configFor, metaFor, fetchRecords).
  `PublicListService` la implementa; tests pueden mockear sin extender
  la clase final.
- `src/PublicLists/Shortcode.php` — handler de `[imcrm-list slug="..."]`.
  HTML 100% server-side, indexable, sin JS. Atributos `data-imcrm-*`
  preparados para hidratación en 2.C.
- `src/PublicLists/PublicAssets.php` — enqueue perezoso del CSS solo
  en páginas que contienen el shortcode/bloque.
- `assets/public-list.css` — estilos base sin Tailwind, con variables
  CSS override-ables y modo oscuro automático.

### Tests

- 8 tests unitarios en `ShortcodeTest` cubriendo render, tipos
  especiales (email/url/checkbox), empty state, validation error.
- Stubs WP nuevos en `tests/bootstrap.php`: `esc_html`, `esc_attr`,
  `esc_url`, `esc_html__`, `esc_attr__`, `_n`, `rest_url`.

### Próximas iteraciones

- 2.C — Bundle JS público + hidratación
- 2.D — Bloque Gutenberg
- 2.E — Tab "Visibilidad pública" en List Builder

## [0.38.0] — 2026-05-17

Arranque de la **Fase 8 — Listas públicas** (iteración 2.A: backend
foundation). Sin frontend todavía — solo la API que las próximas
iteraciones consumirán.

### Añadido

- `src/PublicLists/PublicListConfig.php` — value object inmutable
  que parsea `wp_imcrm_lists.settings.public`. Default fail-closed
  (sin la clave o con `enabled=false` la lista no se expone).
  Clamps de `per_page` y `cache_ttl`.
- `src/PublicLists/PublicListService.php` — orquesta lecturas públicas.
  Aplica `fixed_filter_tree` siempre; restringe sort a whitelist;
  proyecta solo `visible_field_slugs`. Cache server-side opcional.
- `src/REST/PublicListsController.php` — endpoints anónimos:
    * `GET /imagina-crm/v1/public/lists/{slug}` (metadata)
    * `GET /imagina-crm/v1/public/lists/{slug}/records` (records)
- Rate limit por IP con `set_transient` (60 req/min × endpoint).
  Respeta X-Forwarded-For.
- Headers `Cache-Control: public, max-age=...` cuando TTL > 0 →
  CDN/Varnish puede cachear sin tocar PHP.

### Garantías de seguridad

1. Lista no marcada como pública → 404.
2. Filtros del visitante limitados a campos visibles.
3. Sort restringido a `sort_allowed_slugs`.
4. `fixed_filter_tree` aplicado siempre antes que filtros del visitante.
5. Serialización excluye campos internos (`created_by`, etc.).

### Tests

- 17 tests unitarios nuevos en `PublicListConfigTest`: parsing,
  defaults seguros, clamps, normalización, roundtrip.

### Próximas iteraciones

- 2.B — Shortcode + render server-side
- 2.C — Bundle JS público + hidratación
- 2.D — Bloque Gutenberg
- 2.E — UI de configuración en List Builder

## [0.37.3] — 2026-05-17

**Cierre de la Fase 7.** Última iteración (1.E): frontend gating +
tab "Permisos" en el List Builder. La base de permisos queda completa
y lista para las Fases 8 (listas públicas) y 9 (portal del cliente).

### Añadido

- `app/lib/permissions.ts`: constantes `CAP.*` espejo del backend +
  hooks `useCan(cap)`, `useCanAny(...caps)`, `useIsPluginAdmin()`.
  Constantes `ROLES.*` de los 5 roles del plugin.
- `app/hooks/usePermissions.ts`: `useListPermissions`,
  `useUpdateListPermissions`, `useRoles`.
- `app/types/permissions.ts`: tipos `Scope`, `RolePermissions`,
  `ListPermissionsDoc`, `PluginRole`.
- `app/admin/lists/PermissionsPanel.tsx`: matriz editable
  `rol × operación` con scope dropdowns por view/edit/delete + checkbox
  para create. Selector dinámico de "Campo de asignación" cuando se
  usa scope=Asignados.

### Cambiado

- Sidebar: items condicionados por capability.
- ListsIndexPage: botón "Nueva lista" + EmptyState gateados por
  `manage_lists`. Texto adaptativo según permisos.
- RecordsPage header: cada botón requiere su cap específica
  (Automatizaciones, Configurar lista, Importar, Exportar, Nuevo registro).

### Limitaciones conocidas

- Gating per-cell en TableView no implementado todavía — depende del
  403 del backend si un viewer intenta editar.
- `fields_hidden` (per-field ACL) reservado para Fase 10.

### Fase 7 cerrada

| Iteración | Versión | Qué entregó |
|-----------|---------|-------------|
| 1.A       | 0.37.0  | CapabilityRegistry + RoleInstaller (foundation) |
| 1.B       | 0.37.1  | PermissionService + ACL por lista + REST de permisos |
| 1.C+D     | 0.37.2  | Gating REST + scope SQL en records |
| 1.E       | 0.37.3  | Frontend gating + tab Permisos |

## [0.37.2] — 2026-05-17

Continuación de la **Fase 7 — Roles y permisos** (iteración 1.C+D
fusionada). Gating REST por endpoint + filtrado SQL de records por
scope. Las capabilities `imcrm_*` ahora se enforcean de verdad —
hasta este release todo era infraestructura sin efectos visibles.

### Añadido

- `QueryBuilder::buildSelect()` acepta `$additionalWhere` opcional
  con shape `{sql, args}`. Se compone con AND al WHERE final. Es la
  vía por la que `PermissionService::recordsScopeWhere()` (Fase 7 — 1.B)
  inyecta el filtro de scope sin tocar los filtros del usuario.
- `RecordService::list()` y `CsvExporter::export()` propagan
  `$additionalWhere` al QueryBuilder.
- `AbstractController::requireCapability(cap)` y `requireAnyCapability(...caps)`
  para construir permission_callbacks granulares.
- 4 tests nuevos en `QueryBuilderTest` cubriendo composición del scope SQL,
  caso blocking (AND 1=0), y verificación de back-compat cuando no se pasa.

### Cambiado

- Cada controller REST ahora elige el cap específico por endpoint en vez
  de heredar `checkAdminPermissions`. Mapping completo en
  `readme.txt` changelog 0.37.2.
- `RecordsController`: gating + checks per-record (404 si no visible,
  403 si visible pero no editable). Bulk filtra IDs aprobados/denegados.
- `ListsController::getCollection` filtra listas no visibles por usuario.
- `ListsController::getItem` devuelve 404 si el user no puede verla
  (data leak prevention: no se distingue "no existe" de "no autorizado").
- `CommentsController` y `ActivityController` chequean visibility per-record
  antes de devolver comments/timeline.
- `ExportController` aplica el scope SQL — el CSV ya no expone records ajenos.

### Limitaciones temporales

- `AggregatesController`: para no exponer agregados sobre records ajenos,
  usuarios con scope distinto de `all` reciben 403. Refactor del
  `RecordAggregator` con `additionalWhere` pendiente.

### Próximos pasos

- 1.E — Frontend gating (sidebar, botones, columnas) + tab "Permisos"
  en List Builder.

## [0.37.1] — 2026-05-17

Continuación de la **Fase 7 — Roles y permisos** (iteración 1.B:
`PermissionService` + ACL por lista). Sin cambios de schema — el ACL
vive en `wp_imcrm_lists.settings` (JSON existente).

### Añadido

- `src/Permissions/ListPermissions.php` — value object inmutable que
  parsea `settings.permissions`. Implementa `mergeScopes()` (combina
  scopes de múltiples roles tomando el más permisivo), `forRole()`
  (bypass automático para `crm_admin`/`administrator`, defaults legacy
  cerrados para los demás).
- `src/Permissions/PermissionService.php` — centraliza autorización.
  Métodos `userCanAccessAdmin`, `userIsPluginAdmin`, `userCanManageLists`,
  `userCanSeeList`, `userCanCreateInList`, `userCanViewRecord`,
  `userCanEditRecord`, `userCanDeleteRecord`, `recordsScopeWhere`
  (devuelve fragmento SQL inyectable al WHERE), `hiddenFieldSlugs`
  (intersección de campos ocultos entre roles del user).
- `src/REST/PermissionsController.php` — endpoints
  `GET|PATCH /lists/{id_or_slug}/permissions` y `GET /roles`. Cap
  requerida: `imcrm_manage_lists`. La validación rechaza scopes
  desconocidos (422), roles fuera del catálogo y shapes inválidos.
  El PATCH solo toca `settings.permissions` y `settings.assignment_field_id` —
  no pisa otras claves de settings.

### Decisiones de diseño

- **Bypass de admins**: `administrator` (WP) y `crm_admin` saltan TODA
  evaluación de ACL. No hace falta declararlos en `settings.permissions`.
- **Schema vs records**: las operaciones de schema (crear listas/campos/
  automatizaciones) NO se restringen por ACL por lista — solo por la
  cap global correspondiente. El ACL por lista solo afecta records.
- **Multi-rol = más permisivo**: si un user tiene `crm_agent` + `crm_viewer`
  y el viewer tiene scope `all` mientras agent tiene `own`, se aplica `all`.
- **Fail-closed**: scope `assigned` sin `assignment_field_id` configurado
  bloquea todo (no degrada a `all`). Shapes desconocidos caen a `none`.
- **Resolver inyectable**: `PermissionService` acepta `FieldRepository`
  o un `Closure(int): ?FieldEntity`. La primera firma se usa en producción,
  la segunda en tests para evitar tocar BD.

### Tests

- 44 tests unitarios nuevos:
    - `ListPermissionsTest` (16): parsing, defaults legacy, mergeScopes
      conmutativo, normalizeScope case-insensitive, fields_hidden únicos.
    - `PermissionServiceTest` (28): bypass de admins, scope=own/assigned/all/none,
      multi-rol toma el más permisivo, intersección de fields_hidden,
      recordsScopeWhere para inyectar en SQL, fail-closed cuando el
      assignment_field no existe o pertenece a otra lista.
- Stubs reutilizables nuevos en `tests/bootstrap.php`: `WP_User`,
  `user_can()`, `current_user_can()`, `rest_authorization_required_code()`.

### Próximos pasos

- 1.C — Integración granular en controllers REST (cada endpoint con su cap)
- 1.D — `QueryBuilder` con `additionalWhere` cableado a `recordsScopeWhere`
- 1.E — Frontend gating + tab "Permisos" en List Builder

## [0.37.0] — 2026-05-17

Inicio de la **Fase 7 — Roles y permisos** (iteración 1.A: foundation).

### Añadido

- `src/Permissions/CapabilityRegistry.php` — catálogo central de las 17 capabilities del plugin (`imcrm_*`) y mapeo a los 5 roles default (`crm_admin`, `crm_manager`, `crm_agent`, `crm_viewer`, `crm_client`). Incluye helper estático `currentUserCapabilitiesMap()` para serializar el estado del usuario al bootstrap del SPA.
- `src/Permissions/RoleInstaller.php` — instala/sincroniza roles y capabilities. Idempotente: reescribe el set de caps `imcrm_*` declarado en cada rol sin tocar caps con otros prefijos (no pisa permisos custom del sysadmin). Garantiza que el rol `administrator` reciba todas las caps `imcrm_*` para preservar acceso de admins existentes tras la migración.
- DB version bump 7 → 8: la primera vez que el plugin se carga tras la actualización, `maybeUpgradeSchema()` ejecuta `RoleInstaller::sync()` y persiste la nueva versión.
- Set completo de capabilities del usuario actual en el payload de bootstrap (`AdminAssets`, `StandalonePage`) y en `GET /imagina-crm/v1/me`, junto con el listado de roles del usuario. El front podrá gatear UI sin pedir checks individuales al backend.

### Cambiado

- `Plugin::ADMIN_CAPABILITY` pasa de `manage_options` a `imcrm_access_admin`. Todos los chequeos de permission (REST controllers vía `AbstractController::checkAdminPermissions`, redirect del menú wp-admin, guardia del Standalone) usan la constante, así que el cambio se aplica una sola vez con efecto global. Back-compat: la migración añade `imcrm_access_admin` al rol `administrator`.

### Desinstalación

- `uninstall.php` (cuando el usuario activa `imcrm_purge_on_uninstall`) ahora también remueve los 5 roles del plugin y las caps `imcrm_*` del rol `administrator`. Los datos siguen sin tocarse a menos que el flag esté activo (ADR-007).

### Tests

- `tests/Unit/Permissions/CapabilityRegistryTest.php` — integridad del registro: caps únicas, mapeo de roles consistente, scope de `crm_agent` restringido a `own`, `crm_client` sin caps de admin.
- `tests/Unit/Permissions/RoleInstallerTest.php` — creación de roles, asignación de caps, idempotencia, drop de caps obsoletas, no pisar caps de otros plugins, uninstall limpio.
- Stubs de `WP_Role` y la API de roles (`get_role`, `add_role`, `remove_role`) en `tests/bootstrap.php` — reutilizables por tests futuros.

### Próximos pasos (iteraciones de la Fase 7 pendientes)

- 1.B — `PermissionService` + ACL por lista (`settings.permissions`)
- 1.C — Integración REST: scope `own`/`assigned` en records, endpoints granulares
- 1.D — `QueryBuilder` con `additionalWhere`
- 1.E — Frontend gating + tab "Permisos" en List Builder

Ver `docs/multi-stakeholder-design.md` para el plan completo.

## [0.1.0] — 2026-04-25

Primer release del MVP de **Fase 1** según CLAUDE.md.

### Añadido

#### Backend
- Bootstrap del plugin con header WP, autoload Composer (PSR-4 `ImaginaCRM\`) y constantes `IMAGINA_CRM_*`.
- Container DI propio con resolución por reflection y singletons.
- Migraciones de las 7 tablas del sistema vía `SchemaManager` + `dbDelta`: `lists`, `fields`, `saved_views`, `comments`, `activity`, `relations`, `slug_history`.
- `SlugManager` con validación, generación de identificadores físicos inmutables, rename con escritura en `slug_history`, y resolución de slugs antiguos (incluyendo detección de ambigüedad → null).
- `ListService` + `FieldService` + `RecordService` orquestando los flujos de listas / campos / registros, con rollback automático de DDL si falla.
- Los 14 tipos de campo del MVP (texto, número, currency, select, multi_select, fecha, datetime, checkbox, url, email, user, relation, file).
- `QueryBuilder` con whitelist estricta de columnas físicas, operadores tipados, búsqueda en columnas text, paginación. Cap de 5 filtros por consulta.
- API REST bajo `/wp-json/imagina-crm/v1` con controllers para Lists / Fields / Records / Saved Views / Slugs / License / System.
- `LicenseManager` + `UpdaterClient` con activación / desactivación / refresh, periodo de gracia de 7 días, cron diario de revalidación e inyección al filtro nativo de updates de WordPress.
- Internacionalización completa: text-domain `imagina-crm`, .pot template generable con `bin/i18n-build.sh`, traducción base en español y al inglés (en_US).

#### Frontend
- Admin SPA en React 18 + TypeScript estricto + Tailwind CSS con prefijo `imcrm-`.
- Layout con Sidebar, Topbar y AdminShell.
- Páginas: ListsIndexPage, ListBuilderPage, RecordsPage, SettingsPage.
- Componentes shadcn primitivos: Button, Input, Label, Textarea, Card, Badge, Select, Popover, Sheet (drawer), DropdownMenu.
- `SlugEditor` con slugify automático, validación inline (formato local + remoto debounced) y advertencia clara al renombrar slugs existentes.
- `FieldBuilder` + `FieldCreateDialog` + `FieldTypeSelect` para configurar campos con todos los tipos.
- `TableView` con TanStack Table v8: edición inline (optimistic update), sort multi-columna con shift+click, headers clickeables, columna de selección.
- `EditableCell` con input apropiado por tipo: text, long_text, number, currency, email, url, date, datetime, checkbox, select, multi_select.
- `FiltersBar` + `FilterPopover`: pills clickeables con campo / operador / valor, operadores específicos por tipo.
- `Pagination` con prev / next y rango de página.
- `RecordDetailDrawer` con form completo (incluye user, file, relation).
- `BulkActionsToolbar`: barra contextual sticky con conteo + Limpiar + Eliminar.
- `ViewsTabs` switcher de vistas guardadas con dirty tracking, default star, dropdown de acciones.
- `SaveViewDialog` con resumen del config a guardar.
- `LicenseCard` en Settings: form de activación, estado, vencimiento, uso de activaciones, refresh manual, desactivar.

#### Calidad
- PHPStan nivel 8 sin errores.
- TypeScript modo estricto + `noUncheckedIndexedAccess`.
- 122 tests automatizados: 81 unit + 39 integration + 2 performance.
- Bundle JS: 145.6 KB gzip (techo de contrato: 250 KB).
- Performance verificada: p95 ≤ 80 ms con 5k filas, ≤ 200 ms con 50k filas.
- CI configurado para correr unit + integration + benchmark contra MariaDB 10.11 en cada PR.
- Documentación de usuario en español publicada en `docs/`.

### Decisiones arquitectónicas clave (ADR)
- **ADR-001**: Schema físico dinámico, no EAV.
- **ADR-002**: Tailwind con prefijo `imcrm-`.
- **ADR-003**: Vite en lugar de wp-scripts.
- **ADR-004**: REST propio bajo `imagina-crm/v1`.
- **ADR-007**: La licencia nunca bloquea datos del usuario.
- **ADR-008**: Slugs editables con identidad física inmutable.

### Próximas fases
- **Fase 2**: Automatizaciones (triggers + actions + builder visual).
- **Fase 3**: Comentarios + Activity log.
- **Fase 4**: Vistas Kanban + Calendar.
- **Fase 5**: Dashboards.

Ver [`CLAUDE.md`](../CLAUDE.md) para el roadmap completo.
