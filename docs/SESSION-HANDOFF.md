# Memoria de sesión — Plan multi-stakeholder (Fases 7-10)

> **Propósito**: este documento existe para que cualquier futura sesión (Claude u otro agente) pueda retomar el desarrollo del plugin Imagina CRM **sin pérdida de contexto** de lo que se hizo entre `v0.36.9` y `v0.40.4`.
>
> **Última actualización**: 2026-05-18.
> **Status**: las 4 fases del plan multi-stakeholder (`docs/multi-stakeholder-design.md`) están **cerradas y publicadas**.

---

## TL;DR (lo primero que necesitás saber)

| | |
|---|---|
| **Branch de desarrollo** | `claude/bootstrap-wp-plugin-qGRaH` |
| **Branch de distribución** | `release` (lo que descargan usuarios) |
| **Último commit (dev)** | `2ecd753` "fix(settings): pantalla en blanco en Ajustes" |
| **Último commit (release)** | `0ebe85e` "Release build for `2ecd753`" |
| **Versión actual** | `0.40.4` (en source) / `0.40.4+sha.2ecd753` (en release build) |
| **DB version** | `8` (sin cambios desde Fase 7 — todas las features posteriores usaron `settings` JSON existente) |
| **Tests unit** | **438 verdes** (vs 288 baseline original — **+150 en esta sesión**) |
| **PHPStan** | **22 errores = baseline** — cero regresiones a lo largo de todo el desarrollo |
| **Bundles JS** | `admin` ~178 KB · `público` ~48 KB · `portal` ~50 KB (gzip) |

**Plan completo del que partió la sesión**: `docs/multi-stakeholder-design.md` (376 líneas). Léelo primero si vas a hacer cambios estructurales.

---

## 1. Contexto del plugin

**Imagina CRM** es un plugin de WordPress tipo ClickUp/Airtable que permite crear listas dinámicas con campos personalizables, automatizaciones, dashboards, comentarios y actividad. La arquitectura usa **schema físico real** en MySQL (una tabla por lista, no EAV) y un SPA en React+TS para el admin.

**Lo que existía antes de esta sesión** (hasta `v0.36.9`):
- Listas, campos (14 tipos), records con CRUD completo.
- Vista Table con filtros/sort/paginación + saved views.
- Slugs editables con history + redirects.
- Automatizaciones (triggers + actions + Action Scheduler).
- Comentarios + activity log + menciones.
- Dashboards con KPI/chart/table widgets.
- Import/export CSV.
- Licensing + auto-updates.
- **Todo era admin-only** — `manage_options` era la única cap.

**Lo que se agregó en esta sesión** (Fases 7-10):
1. **Sistema de permisos completo** (5 roles + caps granulares + ACL por lista + scope SQL).
2. **Listas públicas** consumibles desde el frontend del tema (shortcode + bloque GB + permalinks dedicados).
3. **Portal del cliente** con bloques configurables (datos, forms editables, tablas relacionadas, KPIs, etc.).
4. **Pulidos del sistema** (per-field perms, magic links, roles personalizados).

**Documento de planeación**: el primer commit de la sesión (`dd89a69`) creó `docs/multi-stakeholder-design.md` con el diseño técnico completo de las 3 fases principales. **Ese doc + este handoff cubren todo el contexto necesario**.

---

## 2. Estado del repositorio

### Branches

| Branch | Propósito | Estado |
|---|---|---|
| `claude/bootstrap-wp-plugin-qGRaH` | Desarrollo (donde Claude commiteó toda la sesión) | HEAD = `2ecd753` |
| `release` | Distribución (ZIP que descargan usuarios — incluye `vendor/` + `dist/` compilados, sin `app/`/`tests/`/configs de dev) | HEAD = `0ebe85e` |
| `main` | Tres commits "Add files via upload" — uso histórico, no se toca | — |

### Convención de commits en `release`

Cada commit sigue el patrón `"Release build for <sha-corto-de-dev>"`. Cuando Claude releasó dos veces en esta sesión:

- `93eec3f` "Release build for `38f9adc`" — primer release (v0.40.3, tenía el bug del CustomRolesCard)
- `0ebe85e` "Release build for `2ecd753`" — fix del bug (v0.40.4) ← actual

### Cómo se construye un release

Script: `bin/build-release.sh` (sin `--zip` por default; agregalo si querés el `.zip`).

Lo que hace:
1. Limpia `build/`.
2. `composer install --no-dev --optimize-autoloader`.
3. `npm ci` (si falta) + `npm run build`.
4. Copia whitelist al árbol `build/imagina-crm/`: `imagina-crm.php`, `uninstall.php`, `readme.txt`, `src`, `vendor`, `dist`, `assets`, `languages`, `docs`.
5. Inyecta el SHA corto en `Version:` y en `IMAGINA_CRM_VERSION` (formato `X.Y.Z+sha.abc1234`).
6. Pruning de `vendor/` (borra tests, docs, examples, `.md`, `.gitignore`, etc.).
7. Borra source maps de `dist/` (no exponen TS source).

**Flow completo para hacer un release nuevo:**

```bash
# 1. Asegurar que estás en la rama de desarrollo con todo limpio
git checkout claude/bootstrap-wp-plugin-qGRaH
git status  # debe estar clean

# 2. Build
bin/build-release.sh

# 3. Switch a release
git checkout release
git pull --ff-only origin release

# 4. Limpiar tracked + copiar build
git rm -rf .
cp -R build/imagina-crm/. .

# 5. Stage SOLO los dirs del release (no build/ ni node_modules/ etc.)
git add assets/ dist/ docs/ imagina-crm.php languages/ readme.txt src/ uninstall.php vendor/

# 6. Commit con el SHA de la rama de dev
git -c user.email=release@imaginawp.com -c user.name="Imagina CRM Release Bot" \
    commit -m "Release build for $(git rev-parse --short=7 claude/bootstrap-wp-plugin-qGRaH)"

# 7. Push
git push origin release

# 8. Volver a dev y limpiar build/
git checkout claude/bootstrap-wp-plugin-qGRaH
rm -rf build/

# 9. Re-instalar dev deps (composer install --no-dev las borró)
composer install
```

**Gotcha del proceso**: tras `cp -R build/imagina-crm/. .`, los `.map` files del build inicial de Vite (que corre dentro de `npm run build` antes del prune en `build/imagina-crm/dist/`) quedan EN LA RAÍZ porque `cp` no borra archivos del destino que no están en el source. La primera vez Claude tuvo que hacer `git reset HEAD` + `rm -rf assets dist ... vendor` + `cp -R build/imagina-crm/. .` para limpio.

---

## 3. Plan completo: Fases 7-10

### Resumen ejecutivo

| Fase | Versiones | Iteraciones | Tests añadidos | Status |
|---|---|---|---|---|
| **7** — Roles y permisos | `0.37.0` → `0.37.3` | 1.A, 1.B, 1.C+D, 1.E | 44 | ✅ cerrada |
| **8** — Listas públicas | `0.38.0` → `0.38.4` | 2.A, 2.B, 2.C, 2.D, 2.E | 32 | ✅ cerrada |
| **9** — Portal del cliente | `0.39.0` → `0.39.6` (+ pulidos `0.39.7`-`0.39.9`) | 3.A, 3.B, 3.C, 3.D, 3.E, 3.G, UI | 39 + 4 = 43 | ✅ cerrada |
| **10** — Pulidos del sistema | `0.40.0` → `0.40.4` | per-field, magic-links, permalinks, custom-roles, +fix | 37 | ✅ cerrada |

### Fase 7 — Roles y permisos

**Lo que entrega:** sistema completo de roles + capabilities + ACL por lista con scope `all/own/assigned/none` + REST gating granular + SQL scope injection + UI admin (tab "Permisos" en List Builder).

**Archivos clave creados:**
- `src/Permissions/CapabilityRegistry.php` — 17 caps `imcrm_*` + mapeo a 5 roles (`crm_admin/manager/agent/viewer/client`) + `currentUserCapabilitiesMap()` helper.
- `src/Permissions/RoleInstaller.php` — instala/sincroniza roles WP. Idempotente. **`administrator` recibe TODAS las caps `imcrm_*`** (back-compat — admins WP existentes no pierden acceso).
- `src/Permissions/ListPermissions.php` — value object del shape `settings.permissions`. `mergeScopes()` toma el más permisivo entre roles del user.
- `src/Permissions/PermissionService.php` — autorización central. 14 métodos. **Resolver de fields inyectable como Closure** (para tests).
- `src/REST/PermissionsController.php` — endpoints `/lists/{id}/permissions` + `/roles`.

**Archivos modificados (críticos):**
- `src/Plugin.php` — `ADMIN_CAPABILITY` ahora es `imcrm_access_admin` (antes `manage_options`).
- `src/REST/AbstractController.php` — helpers `requireCapability($cap)` y `requireAnyCapability(...$caps)` que devuelven closures listos para `permission_callback`.
- **14 controllers REST** — cada endpoint con su cap específica:
  | Controller | Lectura | Mutación |
  |---|---|---|
  | Lists | `imcrm_access_admin` (colección filtrada) | `imcrm_manage_lists` |
  | Fields | `imcrm_access_admin` | `imcrm_manage_fields` \| `manage_lists` |
  | Views | `imcrm_access_admin` | `imcrm_manage_views` \| `manage_lists` |
  | Records | `view_records` \| `view_own_records` | `create/edit/delete` + ACL per-record |
  | Aggregates | `view_records` \| `view_own_records` (+ scope SQL) | — |
  | Automations | `imcrm_manage_automations` | `imcrm_manage_automations` |
  | Dashboards | `imcrm_access_admin` | `imcrm_manage_dashboards` |
  | Comments | `view_records` (+ per-record check) | idem |
  | Activity | `view_records` (+ per-record check) | — |
  | Recurrences | `view_records` \| `view_own_records` | `edit_records` \| `edit_own_records` |
  | Import | — | `imcrm_import_records` |
  | Export | — | `imcrm_export_records` (+ scope SQL) |
  | SearchAdmin | `imcrm_manage_lists` | `imcrm_manage_lists` |
  | Slugs | `imcrm_manage_lists` \| `manage_fields` | — |
  | License | `imcrm_manage_lists` | `imcrm_manage_lists` |
- `src/Records/QueryBuilder.php::buildSelect()` — nuevo parámetro `$additionalWhere = {sql, args}` que se appendea al WHERE con AND. **Es el mecanismo por el que el scope se inyecta sin tocar los filtros del usuario**.
- `src/Records/RecordService.php::list()` — propaga `$additionalWhere` al QueryBuilder.
- `src/Records/RecordAggregator.php::aggregate()` — idem (cerrado el TODO de "limitación temporal" en 0.39.5).
- `src/Exports/CsvExporter.php::export()` — idem (cliente con scope=own no exporta records ajenos).

**Reglas de evaluación (CRÍTICAS):**
1. `administrator` (WP) y `crm_admin` siempre tienen **bypass total**.
2. Schema (crear listas/campos/automations) — solo cap global, **NO** se restringe por ACL.
3. Records — cap global + ACL por lista combinados.
4. Multi-rol = **scope más permisivo gana** (`none < own < assigned < all`).
5. **Fail-closed**: scope `assigned` sin `assignment_field_id` → bloquea todo. Shapes desconocidos → `none`.
6. Data leak prevention: 404 cuando user no puede VER el recurso. 403 cuando lo ve pero no puede mutar.

**Frontend (1.E):**
- `app/lib/permissions.ts` — constantes `CAP.*` espejo del backend + hooks `useCan(cap)`, `useCanAny(...caps)`, `useIsPluginAdmin()`.
- `app/admin/layout/Sidebar.tsx` — items gateados (Dashboards, Settings).
- `app/admin/lists/ListsIndexPage.tsx` — botón "Nueva lista" gateado.
- `app/admin/records/RecordsPage.tsx` — cada botón del header con su cap.
- **`app/admin/lists/PermissionsPanel.tsx`** — matriz editable `rol × operación` con scope dropdowns + checkbox create. Selector dinámico de "Campo de asignación" cuando algún rol usa scope=Assigned.

### Fase 8 — Listas públicas

**Lo que entrega:** habilitar listas para ser consumidas anónimamente desde el frontend del tema vía shortcode, bloque Gutenberg, o permalink dedicado (`/precios/`). Sin nonce, con rate limit + cache CDN-friendly.

**Archivos clave creados:**
- `src/PublicLists/PublicListConfig.php` — value object del shape `settings.public`. Default cerrado (fail-closed). Clamps de `per_page` [1, 100] y `cache_ttl` [0, 3600]. **Field `permalinkBase` con sanitización a `[a-z0-9-]` max 64 chars** (Fase 10).
- `src/PublicLists/PublicListReader.php` — interfaz que abstrae lectura. Permite tests sin extender la clase final.
- `src/PublicLists/PublicListService.php implements PublicListReader` — orquesta lecturas. Cache server-side opcional. Aplica `fixed_filter_tree` siempre antes que filtros del visitante. Restringe sort a `sort_allowed_slugs`. Proyecta solo `visible_field_slugs`.
- `src/PublicLists/Shortcode.php` — handler de `[imcrm-list slug="..." per_page="..." class="..."]`. HTML 100% server-side, indexable, sin JS. Marcas `data-imcrm-*` para hidratación posterior.
- `src/PublicLists/PublicAssets.php` — enqueue lazy del CSS + bundle JS solo en páginas con shortcode/bloque.
- `src/PublicLists/Block.php` — bloque GB server-rendered. **Decisión**: NO usar `@wordpress/blocks` JS (cero deps nuevas). WP genera el inspector desde `attributes` schema.
- `src/PublicLists/PublicPermalinks.php` — rewrite rules + auto-flush via signature en options + render con `get_header()` + shortcode + `get_footer()`.
- `src/REST/PublicListsController.php` — endpoints `/v1/public/lists/{slug}` + `.../records`. Rate limit 60 req/min × IP via transients. Headers `Cache-Control: public, max-age=N`.

**Bundle JS público (`app/public.tsx` + `app/public/`):**
- 1.89 KB gzip + 45.7 KB `vendor-react` compartido = **~48 KB total** para el visitante.
- Sin TanStack Query (peso), sin shadcn (peso), sin Lucide (peso). React 18 + fetch nativo + AbortController.
- Hidrata `<div data-imcrm-public-list>` reemplazando el server-side HTML con tabla interactiva (búsqueda con debounce 250ms, sort asc→desc→none, paginación prev/next).
- `createRoot` (no `hydrateRoot`) — el re-render inicial ~10-30ms libera al shortcode PHP de tener que emitir HTML byte-a-byte idéntico.

**Vite config cambios críticos** (`vite.config.ts`):
- `input` ahora es array: `['app/main.tsx', 'app/public.tsx', 'app/portal.tsx']`.
- `manualChunks`: React/ReactDOM van a `vendor-react` (compartido entre admin/público/portal). TanStack Query va a `vendor-query` (solo admin).

**UI admin (2.E):**
- `app/types/publicList.ts` — tipos espejo del PHP.
- `app/admin/lists/PublicVisibilityPanel.tsx` — toggle master + tabla campo-por-campo (visible/ordenable) + inputs clampeados (per_page, cache_ttl) + toggles search/viewer_filters + dropdown default_sort dinámico + snippet del shortcode con botón copiar + **input "Permalink dedicado"** (Fase 10).

### Fase 9 — Portal del cliente

**Lo que entrega:** clientes con cuenta WP propia (`rol crm_client`) acceden a una página WP con `[imcrm-client-portal]` y ven sus datos en formato configurable (bloques tipo "client_data", "editable_form", "related_records_table", "kpi_widget", etc.). PortalScopeService **aísla todos los datos al cliente actual** (data leak prevention crítica).

**Modelo de datos:**
- Una lista del CRM se marca como **lista de portal** con `settings.portal.enabled = true` + `settings.portal.owner_field_id = <id_de_field_tipo_user>`.
- Cada record en esa lista = un cliente. El `owner_field` guarda el `wp_users.ID` del dueño.
- Otras listas se vinculan al cliente con: (a) field `relation` a la lista de portal, o (b) field `user` directo.

**Archivos clave creados:**
- `src/Portal/PortalConfig.php` — value object de `settings.portal`. `isPortalList()` exige `owner_field_id` válido.
- `src/Portal/ClientResolverInterface.php` + `ClientResolver.php` — resuelve `WP_User → record cliente`. Devuelve null en cualquier mis-config (fail-closed).
- **`src/Portal/PortalScopeService.php`** — **PIEZA MÁS CRÍTICA DE SEGURIDAD**. Genera el WHERE SQL inyectable que aísla los datos. 4 casos:
  1. Lista de portal: `AND \`id\` = <client_record_id>`.
  2. Lista con field `user`: `AND \`<col>\` = <user_id>`.
  3. Lista con field `relation` a portal: `AND \`id\` IN (SELECT source_record_id FROM relations WHERE field_id=N AND target_record_id=<client_record_id>)`.
  4. Cualquier otro caso: `AND 1=0`.
- `src/Portal/PortalTemplate.php` — value object de `settings.portal_template`. Whitelist de tipos válidos (8 actualmente). `editableFieldSlugs()` devuelve unión deduplicada de slugs editables.
- `src/Portal/PortalShortcode.php` — handler de `[imcrm-client-portal]`. 4 estados de card visual:
  1. No logged-in → "Iniciar sesión" con `wp_login_url(currentUrl)`.
  2. Logged-in sin cap `imcrm_access_portal` → "Esta página es para clientes" + link al admin.
  3. Sin record asociado → "Tu cuenta aún no tiene portal".
  4. OK → root del portal con header (saludo + logout) + placeholder hidratado por bundle.
- `src/Portal/PortalAssets.php` — enqueue lazy del bundle portal (manifest-driven).
- `src/Portal/PortalAccountManager.php` — crea wp_user + asigna rol crm_client + persiste user_id en owner_field + envía email de bienvenida con password.
- `src/Portal/MagicLinkService.php` (Fase 10) — generate + consume tokens one-time. Token = 32 bytes random hex (256 bits). Storage por `sha256(token)` en transients (TTL 7 días).
- `src/Portal/MagicLinkConsumer.php` (Fase 10) — hook `template_redirect` priority 5 que detecta `?imcrm_token=...`, autentica via `wp_set_auth_cookie`, redirige limpio.
- `src/REST/PortalController.php` — endpoints:
  - `GET /portal/me` — record del cliente + user info + template (default si no hay configurado). **`enrichTemplateBlocks()` resuelve los slugs de `editable_form` a fields con types completos**.
  - `GET /portal/lists/{slug}/records` — records con scope SQL inyectado.
  - `GET /portal/lists/{slug}/records/{id}` — detalle.
  - `PATCH /portal/me` — cliente actualiza SUS campos. Whitelist desde `editable_form` del template. Slug fuera de whitelist → **403 explícito** (no silencioso).
  - `GET /portal/lists/{slug}/aggregates` — KPIs con scope.
  - `GET /portal/me/activity` — timeline.
  - `POST /portal/lists/{slug}/records/{id}/access` — admin crea cuenta WP del cliente.
  - `POST /portal/lists/{slug}/records/{id}/magic-link` — admin genera magic link.

**Bundle JS portal (`app/portal.tsx` + `app/portal/`):**
- 4.53 KB gzip + vendor-react 45.7 KB = **~50 KB total** para el cliente.
- Estrategia de hidratación: el shortcode emite header con saludo server-side; el bundle REEMPLAZA solo `.imcrm-portal-body` con `<PortalRenderer>`. El header con logout sobrevive sin JS.
- 8 bloques implementados:

| Block type | Archivo | Notas |
|---|---|---|
| `static_text` | `StaticTextBlock.tsx` | HTML del admin (trusted source — `dangerouslySetInnerHTML`). |
| `client_data` | `ClientDataBlock.tsx` | Definition list de los campos del cliente. |
| `related_records_table` | `RelatedRecordsTableBlock.tsx` | Tabla de records relacionados via PortalScopeService. |
| `editable_form` | `EditableFormBlock.tsx` | Form con inputs por type (date, datetime, email, number, checkbox, select, multi_select, long_text, etc.). |
| `external_link` | `ExternalLinkBlock.tsx` | CTA con `target=_blank` + `rel=noopener,noreferrer`. |
| `kpi_widget` | `KpiWidgetBlock.tsx` | Métrica simple (count/sum/avg/min/max) sobre records relacionados. |
| `activity_timeline` | `ActivityTimelineBlock.tsx` | Timeline del record del cliente. |
| `download_files` | `DownloadFilesBlock.tsx` | Lista de attachments. **100% client-side** usando el endpoint nativo de WP `/wp-json/wp/v2/media?include=N,M,O`. |

**Bloques del plan original NO implementados** (opcionales, baja prioridad):
- `related_records_kanban` — variante del tabla.
- `chart_widget` — requiere lib externa (~30 KB).
- `comments_thread` — requiere endpoint POST nuevo para que cliente comente.

**UI admin del portal:**
- `app/admin/lists/PortalConfigPanel.tsx` — toggle habilitar + selector owner_field + editor del template.
- **`app/admin/lists/PortalTemplateEditor.tsx`** — editor visual de bloques con cards reordenables + form por type. Toggle "Modo avanzado (JSON)" para power users.
- `app/admin/records/crm/PortalAccessButton.tsx` — botón "Crear acceso al portal" en el panel CRM del record (solo si la lista es portal-list).

### Fase 10 — Pulidos del sistema

#### Per-field permissions (`0.40.0`)

El shape `fields_hidden` ya existía en `ListPermissions` desde 0.37.1 pero no estaba enforced server-side ni configurable visualmente.

**Enforcement en `RecordsController`:**
- `GET /records` → `stripHiddenFields()` filtra los slugs ocultos de `record.fields` y `record.relations` antes de serializar.
- `GET /records/{id}` → idem per-record.
- `PATCH /records/{id}` → si el body toca algún slug oculto → 403 con lista de slugs no editables.

**UI:** sección "Campos ocultos por rol" en `PermissionsPanel.tsx` (en `<details>` colapsable) con tabla `campo × rol` de checkboxes.

#### Magic links (`0.40.1`)

Login sin password para clientes del portal. **Storage en transients** (auto-expirables, sin schema bump).

**Flujo:**
1. Admin: `POST /portal/lists/{slug}/records/{id}/magic-link` con `target_url` + `send_email=true`.
2. Backend: genera token 32 bytes hex (256 bits) → guarda `sha256(token)` en transient con TTL 7 días → envía email al cliente.
3. Cliente click → hook `template_redirect` priority 5 detecta `?imcrm_token=...` → `MagicLinkService::consume()` valida + `wp_set_auth_cookie` + invalida transient + redirect a URL limpia.

**Seguridad:**
- Token raw NUNCA en BD — solo `sha256`. DB leak no expone tokens utilizables.
- One-time: `delete_transient` ANTES de auth (defense contra race conditions).
- Re-validación de cap `imcrm_access_portal` al consume.
- Token revocado si el user fue borrado o perdió la cap entre generate-consume.

**Tests:** 15 unitarios cubren todos los edge cases incluyendo verificación explícita de que el token raw NO aparece en NINGÚN key ni value de los transients.

#### Permalinks dedicados (`0.40.2`)

Listas públicas accesibles en `/{permalink_base}/` además del shortcode.

- `PublicListConfig.permalinkBase: ?string` con sanitización a `[a-z0-9-]` max 64 chars.
- `PublicPermalinks` registra rewrite rules en `init`, auto-flush con signature en `wp_loaded`, render en `template_redirect` con `get_header()` + `do_shortcode()` + `get_footer()` (preserva chrome del tema).
- UI: input "Permalink dedicado" en `PublicVisibilityPanel`.

#### Roles personalizados (`0.40.3`)

Admin crea roles custom con sets de caps `imcrm_*` libres.

- `CustomRoleService` con CRUD en `wp_options.imcrm_custom_roles`. Slug saneado a `[a-z0-9_]` 3-50 chars. Caps filtradas a SOLO `imcrm_*`.
- `RoleInstaller::syncCustomRoles()` extiende el sync existente: crea/actualiza wp_roles con prefijo `crm_custom_<slug>` + remueve roles obsoletos detectándolos via iteración de `wp_roles()->roles`.
- Endpoints REST en `PermissionsController`: `GET /roles` (con `custom_roles` + `capabilities` en `data`), `POST /roles`, `DELETE /roles/{slug}`.
- UI: `CustomRolesCard` en SettingsPage con form de creación/edición (checkboxes por cap).

#### Fix v0.40.4

**Bug crítico introducido en 0.40.3**: el `CustomRolesCard` causaba pantalla en blanco en Settings.

**Causa**: el endpoint `GET /roles` devolvía `{data, custom_roles, capabilities}` (3 keys paralelas) pero el wrapper `app/lib/api.ts` solo expone `envelope.data` al cliente y descarta el resto. `custom_roles` y `capabilities` llegaban `undefined`, crash en `allCaps.map()`.

**Fix**: el backend anida todo en `data` → `{data: {roles, custom_roles, capabilities}}`. Frontend ajustado al nuevo shape con fallbacks `?? []` defensivos.

**Lección aprendida (no repetir)**: en `CustomRolesCard.tsx` original Claude hizo `res as unknown as RolesResponse` — el `as unknown as` deshabilita el type-check de TS. **Evitar `as unknown as X` salvo cuando el cast es genuinamente inevitable**.

---

## 4. Arquitectura nueva

### Namespaces nuevos

| Namespace | Propósito |
|---|---|
| `ImaginaCRM\Permissions\` | Caps, roles, ACL, custom roles |
| `ImaginaCRM\PublicLists\` | Listas públicas (shortcode, bloque, permalinks, REST público) |
| `ImaginaCRM\Portal\` | Portal del cliente (scope, template, magic links, account manager) |

### Patrones recurrentes adoptados

**1. Value objects inmutables para parsear settings JSON.**

Cada feature que persiste en `settings.X` tiene su value object: `ListPermissions`, `PublicListConfig`, `PortalConfig`, `PortalTemplate`. Patrón:
```php
public static function fromListSettings(array $settings): self
{
    // Parse defensivo: shape inválido → defaults seguros.
}
public function toArray(): array { /* roundtrip */ }
```

**2. Interfaces para evitar mockear clases `final`.**

Varios services del codebase son `final`. Para que tests puedan mockear sin extenderlos, se introdujeron interfaces:
- `PublicListReader` ← `PublicListService implements`.
- `ClientResolverInterface` ← `ClientResolver implements`.

Patrón al usar en otros services:
```php
public function __construct(
    private readonly ClientResolverInterface $resolver, // ← interfaz
    ...
)
```

**3. Closures inyectables para resolver dependencies en tests.**

Cuando el service necesita `FieldRepository` (final) solo para 1 método (`find()` o `allForList()`), se acepta `FieldRepository|Closure(int): ...` en el ctor:
```php
public function __construct(FieldRepository|Closure $fields)
{
    if ($fields instanceof FieldRepository) {
        $this->resolveField = static fn (int $id) => $fields->find($id);
    } else {
        $this->resolveField = $fields;
    }
}
```

Implementado en: `PermissionService`, `PortalScopeService`.

**4. AdditionalWhere para inyectar SQL scope sin tocar filter trees.**

`QueryBuilder::buildSelect()` y `RecordAggregator::aggregate()` aceptan `?array $additionalWhere = ['sql' => '...', 'args' => [...]]`. Cuando se pasa, se appendea con AND al WHERE final. Es la **única manera** correcta de inyectar el scope del PermissionService o PortalScopeService sin perturbar los filtros del usuario.

**5. Auth gate vía shortcode con 4 estados de card.**

`PortalShortcode` no redirige (corre durante render — los headers ya se enviaron). En su lugar renderiza cards diferentes según el estado (no logged-in / sin cap / unlinked / OK). La auth real con `wp_set_auth_cookie` la hace `MagicLinkConsumer` en `template_redirect` priority 5.

**6. Tests de aislamiento OBLIGATORIOS para data leak prevention.**

`tests/Unit/Portal/PortalScopeServiceTest.php` tiene 17 tests que verifican TODOS los caminos de aislamiento. **No mergear cambios al scope sin pasar estos tests**. Específicamente:
- `test_portal_list_scopes_use_own_id_not_user_id` — defensa explícita contra el bug "user_id=42 coincide con record_id=42 de OTRO cliente".

### Bundles JS

Vite ahora produce 3 entries + 2 chunks compartidos:

| Bundle | Size raw | Size gzip | Carga en |
|---|---|---|---|
| `main.js` (admin SPA) | ~630 KB | ~178 KB | `/wp-admin/admin.php?page=imagina-crm` y `/imagina-crm/` (standalone) |
| `vendor-react.js` | ~143 KB | ~46 KB | Compartido entre admin + público + portal |
| `vendor-query.js` | ~40 KB | ~12 KB | Solo admin |
| `public.js` | 5.85 KB | 2.42 KB | Páginas con `[imcrm-list]` o bloque GB |
| `portal.js` | ~16 KB | ~4.5 KB | Páginas con `[imcrm-client-portal]` |

**Total para un visitante anónimo (lista pública)**: vendor-react (46 KB) + public (2.4 KB) = **~48 KB**.
**Total para un cliente logueado (portal)**: vendor-react (46 KB) + portal (4.5 KB) = **~50 KB**.

---

## 5. Decisiones de diseño clave

### ✅ Decisiones que se mantuvieron

| Decisión | Por qué |
|---|---|
| Roles custom usan prefijo `crm_custom_<slug>` | Evita choques con built-in (`crm_admin/manager/agent/viewer/client`) y con WP nativos |
| `administrator` WP recibe TODAS las caps `imcrm_*` en cada `sync()` | Back-compat — admins existentes no pierden acceso |
| `Plugin::ADMIN_CAPABILITY = 'imcrm_access_admin'` (antes `manage_options`) | Una sola constante para gatear todo el plugin |
| Scope SQL del portal/permissions se inyecta vía `additionalWhere` | Sin tocar filter trees ni reescribir QueryBuilder |
| `data` envelope en endpoints REST | El wrapper `api.ts` SOLO expone `envelope.data` — keys paralelas se pierden |
| Magic links: token raw NO en BD, solo `sha256(token)` | DB leak no expone tokens utilizables |
| Magic links: one-time, `delete_transient` ANTES de `wp_set_auth_cookie` | Race condition de doble consume imposible |
| Portal: shortcode con cards de estado en lugar de `wp_redirect` | El shortcode corre durante render; headers ya enviados |
| Portal storage: 100% en `settings.portal` + `settings.portal_template` JSON | Cero schema bumps; reusa infra de `crm_panel_template` existente |
| Listas públicas: filtros fijos siempre antes que del visitante | Garantiza que admin no puede ser bypasseado desde el client |
| Bundle público: sin TanStack Query/shadcn/Lucide | Target < 50 KB gzip total |
| Bloque GB server-rendered (sin JS de editor) | Cero deps nuevas; WP genera el inspector desde `attributes` schema |

### ⚠️ Decisiones que se cambiaron a mitad de camino

| Decisión original | Decisión final | Por qué |
|---|---|---|
| Tabla nueva `wp_imcrm_templates` con columna `kind` para templates de portal | JSON en `settings.portal_template` (igual que `crm_panel_template`) | Schema bump no aportaba valor; reutilizar infra existente fue 3x más rápido |
| Iteración 1.C (REST gating) y 1.D (scope SQL) por separado | Fusionadas en `0.37.2` | Sin scope SQL los permission_callbacks no son funcionales (un agent vería todos los records aunque el callback diga "solo own") |
| `CustomRolesCard.tsx` con shape de response paralelo a `data` | Anidado dentro de `data` (fix `0.40.4`) | `api.ts` descarta keys fuera de `envelope.data` |

### 🚫 Cosas que NO se hicieron (y por qué)

| | Por qué |
|---|---|
| Mobile app / PWA | Fuera de scope explícito en el plan |
| Pagos / facturación / WooCommerce integration | Plan dice módulo separado, fase futura |
| Chat en tiempo real | El plan menciona solo comentarios async |
| SSO con Google/Microsoft | Solo login WP nativo en MVP |
| Multi-tenancy | Un WP = una organización |
| Bloques portal `chart_widget`, `comments_thread`, `related_records_kanban` | Requieren lib de charts / endpoint POST nuevo / UI Kanban — baja prioridad si no hay user request explícito |
| Editor visual del template SUPER avanzado (drag&drop, preview live) | El editor con cards + form por type es 80% del valor al 20% del esfuerzo |
| Tests E2E del bundle JS público / portal | Vitest no está configurado en el proyecto (mencionado en CLAUDE.md pero nunca implementado) |
| Tests integration con WP real | Requieren `bin/install-wp-tests.sh` + suite separado |

---

## 6. Cómo retomar el desarrollo

### Comandos básicos

```bash
# Estado del repo
git status
git log --oneline -10
git branch -a

# Setup (después de clonar / cambiar de máquina)
composer install
npm ci
bin/install-wp-tests.sh wordpress_test root '' localhost latest  # solo si necesitas integration

# Tests
vendor/bin/phpunit --testsuite Unit              # 438 tests, ~1.5s
vendor/bin/phpunit --testsuite Unit --filter X   # filtrado
vendor/bin/phpstan analyse --memory-limit=2G     # 22 errors baseline
npm run build                                     # Vite build (debe ser limpio)

# Crear release
bin/build-release.sh           # genera build/imagina-crm/
bin/build-release.sh --zip     # + zip
# (ver §2 de este doc para el flow completo)
```

### Lecturas obligatorias antes de tocar el plugin

1. **`CLAUDE.md`** (root del repo, 800+ líneas) — visión completa del plugin, ADRs, stack, contratos de rendimiento, etc.
2. **`docs/multi-stakeholder-design.md`** — plan técnico de Fases 7-10 (~750 líneas). Si vas a tocar cualquier feature de permisos / listas públicas / portal, este doc tiene el "por qué".
3. **Este archivo** (`docs/SESSION-HANDOFF.md`) — qué se hizo realmente, decisiones, gotchas.

### Si querés agregar una feature nueva al portal

1. Define el tipo de bloque en `PortalTemplate::VALID_BLOCK_TYPES` (`src/Portal/PortalTemplate.php`).
2. Si necesita endpoint REST: agrégalo a `PortalController` con cap `imcrm_access_portal` y aplica `recordsScopeWhere` para cualquier query sobre records.
3. Frontend: nuevo componente en `app/portal/blocks/<TipoBlock>.tsx` + caso en el switch del `PortalRenderer.tsx`.
4. UI admin: agrega al `PORTAL_BLOCK_TYPES` en `app/types/portal.ts` (label legible) + al switch de `defaultConfigFor()` en `app/admin/lists/PortalTemplateEditor.tsx`.
5. Tests: extiende `PortalTemplateTest.php` con un test que verifique que el nuevo type pasa el parser.

### Si querés agregar una capability nueva

1. Constante en `src/Permissions/CapabilityRegistry.php::CAP_*`.
2. Agrégala al `allCapabilities()` array.
3. Asígnala a los roles default en `defaultCapabilitiesByRole()`.
4. Espejo en `app/lib/permissions.ts::CAP.*`.
5. En el controller que la use: `'permission_callback' => $this->requireCapability(CapabilityRegistry::CAP_NEW)`.
6. Test: el `CapabilityRegistryTest::test_all_capabilities_consistency` debería pasar automáticamente.

### Si encontrás un bug en producción

1. Reproducir en local (clonar release, instalar en WP local).
2. Si el error es de runtime JS: chequear si es el patrón "endpoint devuelve shape distinto a lo que api.ts expone" (igual que el bug 0.40.4 — siempre anidar dentro de `data`).
3. Fix en la rama `claude/bootstrap-wp-plugin-qGRaH` (o nueva feature branch si el desarrollo activo está en otra).
4. Bump versión patch (`X.Y.Z+1`).
5. Tests + PHPStan + build.
6. Commit + push.
7. **SI hay que rebuildear release**: seguir el flow de §2 con el SHA nuevo.

### Suite de tests al día de hoy

```
tests/Unit/
├── Activity/       (preexistente; 7 errors preexistentes en CommentEntity, no de esta sesión)
├── Automations/    (preexistente)
├── Comments/       (preexistente; algunos errors preexistentes)
├── Dashboards/     (preexistente)
├── Fields/         (preexistente)
├── Imports/        (preexistente)
├── Licensing/      (preexistente)
├── Lists/          (preexistente)
├── Permissions/    ← Fase 7 + Fase 10 (CapabilityRegistry, RoleInstaller, ListPermissions, PermissionService, CustomRoleService — 76 tests)
├── Portal/         ← Fase 9 (PortalConfig, PortalScopeService [17 tests CRÍTICOS], PortalTemplate, MagicLinkService — 47 tests)
├── PublicLists/    ← Fase 8 (PublicListConfig, Shortcode, Block — 32 tests)
├── Records/        (preexistente + tests del additionalWhere en QueryBuilder)
├── Recurrences/    (preexistente)
└── Stubs/          (FakeWpdb, StubSlugManager)
```

**Stubs WP en `tests/bootstrap.php`** (todos reutilizables):
- `WP_User`, `WP_Role`, `user_can()`, `current_user_can()` (acepta callable override via `$GLOBALS['imcrm_test_current_user_can']`)
- `get_role()`, `add_role()`, `remove_role()`, `wp_roles()`
- `get_option`, `update_option`, `delete_option`
- `set_transient`, `get_transient`, `delete_transient` (con flag de expirados)
- `wp_set_auth_cookie`, `wp_set_current_user`, `is_ssl`
- `wp_http_validate_url`, `add_query_arg`
- `esc_html`, `esc_attr`, `esc_url`, `esc_html__`, `esc_attr__`, `_n`
- `rest_url`, `rest_authorization_required_code`
- `wp_mail`, `is_email`, `wp_kses_post`, `remove_accents`
- Action Scheduler: `as_enqueue_async_action`, `as_schedule_single_action`

### Comandos que NO debe hacer una sesión nueva sin permiso

- Push a `release` (es lo que descargan usuarios — afecta producción).
- `git reset --hard` o `git push --force` sobre cualquier branch.
- Borrar branches (`git branch -D`, `git push --delete`).
- Modificar `composer.json` o `package.json` agregando dependencies pesadas (todo nuevo en esta sesión usó libs ya instaladas).
- Schema bumps de BD (las 4 fases NO tocaron schema — todo en `settings` JSON o `wp_options`).

---

## 7. Gotchas y trampas conocidas

### 🪤 `api.ts` solo expone `envelope.data`

`app/lib/api.ts` envuelve las respuestas y SOLO retorna `envelope.data`. Si tu endpoint devuelve `{data, foo, bar}` (3 keys paralelas), `foo` y `bar` se PIERDEN en el cliente.

**Solución**: anidá todo dentro de `data` en el backend → `{data: {data, foo, bar}}`. Esto fue el bug `0.40.4`.

### 🪤 `as unknown as X` deshabilita type-check

Si necesitás castear, hacelo con `as X` (TypeScript valida). El `as unknown as X` es un escape hatch para casos donde el shape es genuinamente irrepresentable — usalo solo en último recurso.

### 🪤 PHPStan 22 errors baseline = pre-existentes

22 errores en `src/Search/MysqlSearchEngine.php`, `src/Records/RecordRepository.php`, etc. son **pre-existentes desde antes de la sesión**. No los toques (no son de las features nuevas).

### 🪤 PHPUnit 7 errors baseline = `CommentEntity` desactualizado

7 errores `ArgumentCountError: CommentEntity::__construct(): Argument #7 ($metadata) not passed` son pre-existentes desde un commit anterior a la sesión (Phase B 0.33.0 cambió la firma de `CommentEntity` pero olvidó actualizar los tests). No son culpa de esta sesión; si querés arreglarlos es un cleanup separado.

### 🪤 `git rm -rf .` en `release` no toca `build/`

Cuando hacés switch a `release` para rebuilder, `build/` queda intacto (es untracked en la rama feature, y al cambiar de branch los untracked sobreviven). PERO `dist/` en la raíz (generado por `npm run build` que el script corre antes del cp) PUEDE quedar con `.map` files que el target ya no tiene. Solución: `rm -rf assets dist docs ... vendor` ANTES del `cp -R build/imagina-crm/. .` para garantizar limpio.

### 🪤 `composer install --no-dev` borra `vendor/bin/phpunit`

`bin/build-release.sh` corre `composer install --no-dev`. Después del build, si querés correr tests en la rama feature, hace falta `composer install` (con dev deps) para reinstalar phpunit + phpstan.

### 🪤 Vendor de `release` tiene SHA inyectada distinta a la del source

Cada release build tiene `Version: 0.40.4+sha.<hash>` inyectado en `imagina-crm.php`. El source NO. Si comparás versiones, no confundir.

### 🪤 `PermissionsPanel` y `PublicVisibilityPanel` y `PortalConfigPanel` escriben en `settings`

Los 3 panels modifican `wp_imcrm_lists.settings`. Cada uno SOLO toca su sub-key (`permissions`, `public`, `portal`+`portal_template`). El merge respeta las otras keys. **Si agregás un 4to panel, seguí el patrón**:

```ts
function mergeIntoSettings(current, mySection) {
    return { ...current, mySection: mySection };  // No reemplaza otras keys
}
```

### 🪤 Magic link consumer corre en TODA request del frontend

`MagicLinkConsumer` hookea `template_redirect` global. **No es admin-only.** Es no-op cuando `?imcrm_token=...` no está, pero igual hace un `isset()` check por cada request — ten en cuenta si optimizás TTFB del sitio público.

### 🪤 PHPStan extension: `phpstan-wordpress` puede tener stubs viejos

PHPStan reporta errores en `RoleInstaller::syncCustomRoles` sobre `wp_roles()->roles` siendo no-nullable (correcto pero confuso). El stub viejo de `phpstan-wordpress` lo tipaba como `array<array>`. Si actualizás el package, revisar los reports.

---

## 8. Lista exhaustiva de archivos creados/modificados

### Archivos nuevos en `src/` (PHP)

```
src/Permissions/CapabilityRegistry.php          (Fase 7 — 1.A)
src/Permissions/RoleInstaller.php               (Fase 7 — 1.A)
src/Permissions/ListPermissions.php             (Fase 7 — 1.B)
src/Permissions/PermissionService.php           (Fase 7 — 1.B)
src/Permissions/CustomRoleService.php           (Fase 10)

src/PublicLists/PublicListConfig.php            (Fase 8 — 2.A)
src/PublicLists/PublicListService.php           (Fase 8 — 2.A)
src/PublicLists/PublicListReader.php            (Fase 8 — 2.B, interfaz)
src/PublicLists/Shortcode.php                   (Fase 8 — 2.B)
src/PublicLists/PublicAssets.php                (Fase 8 — 2.B)
src/PublicLists/Block.php                       (Fase 8 — 2.D)
src/PublicLists/PublicPermalinks.php            (Fase 10)

src/Portal/PortalConfig.php                     (Fase 9 — 3.A)
src/Portal/ClientResolver.php                   (Fase 9 — 3.A)
src/Portal/ClientResolverInterface.php          (Fase 9 — 3.A)
src/Portal/PortalScopeService.php               (Fase 9 — 3.A)
src/Portal/PortalShortcode.php                  (Fase 9 — 3.B)
src/Portal/PortalAssets.php                     (Fase 9 — 3.B/3.D)
src/Portal/PortalTemplate.php                   (Fase 9 — 3.C)
src/Portal/PortalAccountManager.php             (Fase 9 — 3.G)
src/Portal/MagicLinkService.php                 (Fase 10)
src/Portal/MagicLinkConsumer.php                (Fase 10)

src/REST/PermissionsController.php              (Fase 7 — 1.B; extendido en 10)
src/REST/PublicListsController.php              (Fase 8 — 2.A)
src/REST/PortalController.php                   (Fase 9 — 3.B; extendido en 3.E/3.G/10)
```

### Archivos nuevos en `app/` (TypeScript)

```
app/public.tsx                                  (Fase 8 — 2.C, entry bundle público)
app/public/api.ts                               (Fase 8 — 2.C)
app/public/types.ts                             (Fase 8 — 2.C)
app/public/PublicList.tsx                       (Fase 8 — 2.C)

app/portal.tsx                                  (Fase 9 — 3.D, entry bundle portal)
app/portal/api.ts                               (Fase 9 — 3.D)
app/portal/types.ts                             (Fase 9 — 3.D)
app/portal/PortalRenderer.tsx                   (Fase 9 — 3.D)
app/portal/blocks/StaticTextBlock.tsx           (Fase 9 — 3.D)
app/portal/blocks/ClientDataBlock.tsx           (Fase 9 — 3.D)
app/portal/blocks/RelatedRecordsTableBlock.tsx  (Fase 9 — 3.D)
app/portal/blocks/EditableFormBlock.tsx         (Fase 9 — 3.E; refactored en pulidos)
app/portal/blocks/ExternalLinkBlock.tsx         (Fase 9 — 3.E)
app/portal/blocks/KpiWidgetBlock.tsx            (Fase 9 — 3.E)
app/portal/blocks/ActivityTimelineBlock.tsx    (Fase 9 — pulidos)
app/portal/blocks/DownloadFilesBlock.tsx        (Fase 9 — pulidos)

app/lib/permissions.ts                          (Fase 7 — 1.E)
app/hooks/usePermissions.ts                     (Fase 7 — 1.B)
app/types/permissions.ts                        (Fase 7 — 1.E)
app/types/publicList.ts                         (Fase 8 — 2.E)
app/types/portal.ts                             (Fase 9 — UI)

app/admin/lists/PermissionsPanel.tsx            (Fase 7 — 1.E; extendido en 10 con fields_hidden)
app/admin/lists/PublicVisibilityPanel.tsx       (Fase 8 — 2.E; extendido en 10 con permalink_base)
app/admin/lists/PortalConfigPanel.tsx           (Fase 9 — UI)
app/admin/lists/PortalTemplateEditor.tsx        (Fase 9 — pulidos)

app/admin/records/crm/PortalAccessButton.tsx   (Fase 9 — pulidos)
app/admin/settings/CustomRolesCard.tsx          (Fase 10)
```

### Archivos nuevos en `tests/`

```
tests/Unit/Permissions/CapabilityRegistryTest.php
tests/Unit/Permissions/RoleInstallerTest.php
tests/Unit/Permissions/ListPermissionsTest.php
tests/Unit/Permissions/PermissionServiceTest.php
tests/Unit/Permissions/CustomRoleServiceTest.php

tests/Unit/PublicLists/PublicListConfigTest.php
tests/Unit/PublicLists/ShortcodeTest.php
tests/Unit/PublicLists/BlockTest.php

tests/Unit/Portal/PortalConfigTest.php
tests/Unit/Portal/PortalScopeServiceTest.php    ← CRÍTICO PARA SEGURIDAD
tests/Unit/Portal/PortalTemplateTest.php
tests/Unit/Portal/MagicLinkServiceTest.php
```

### Archivos modificados (los críticos)

```
src/Plugin.php                                  (bindings + register hooks de todo lo nuevo)
src/Activation/Installer.php                    (llama RoleInstaller::sync en activación)
src/REST/AbstractController.php                 (requireCapability + requireAnyCapability)
src/REST/RestBootstrap.php                     (registra PermissionsController, PublicListsController, PortalController)
src/Records/QueryBuilder.php                    (additionalWhere en buildSelect)
src/Records/RecordService.php                   (propaga additionalWhere)
src/Records/RecordAggregator.php                (additionalWhere en aggregate)
src/Exports/CsvExporter.php                     (additionalWhere)
src/REST/RecordsController.php                 (gating granular + stripHiddenFields)
src/REST/ListsController.php                    (gating + filtrado de colección)
src/REST/FieldsController.php                   (gating)
src/REST/ViewsController.php                    (gating)
src/REST/AutomationsController.php              (gating)
src/REST/DashboardsController.php               (gating)
src/REST/CommentsController.php                 (gating + per-record check)
src/REST/ActivityController.php                 (gating + per-record check)
src/REST/AggregatesController.php               (gating + scope SQL via aggregator additionalWhere)
src/REST/ImportController.php                   (gating)
src/REST/ExportController.php                   (gating + scope SQL via CsvExporter additionalWhere)
src/REST/SearchAdminController.php              (gating)
src/REST/SlugsController.php                    (gating)
src/REST/RecurrencesController.php              (gating)
src/REST/LicenseController.php                  (gating)
src/REST/SystemController.php                   (currentUserCapabilitiesMap en /me)
src/Admin/AdminAssets.php                       (caps en bootstrap)
src/Standalone/StandalonePage.php               (caps en bootstrap)
src/Permissions/RoleInstaller.php               (extendido con syncCustomRoles en Fase 10)

app/admin/layout/Sidebar.tsx                    (gating)
app/admin/lists/ListBuilderPage.tsx             (5 panels nuevos cableados)
app/admin/lists/ListsIndexPage.tsx              (gating)
app/admin/records/RecordsPage.tsx               (gating)
app/admin/records/EditableCell.tsx              (prop canEdit)
app/admin/records/views/TableView.tsx           (pasa canEdit a EditableCell)
app/admin/records/crm/RecordCrmLayout.tsx       (PortalAccessButton)
app/admin/settings/SettingsPage.tsx             (CustomRolesCard)

app/lib/boot.ts                                 (expose roles + caps)

vite.config.ts                                  (input array + manualChunks split)

imagina-crm.php                                 (DB_VERSION 7 → 8; version bump)
readme.txt                                      (changelog detallado)
docs/changelog.md                               (idem)
uninstall.php                                   (limpia roles plugin)

tests/bootstrap.php                             (12+ stubs WP nuevos)
```

---

## 9. Estado del backlog (qué quedaría si la sesión continúa)

### Mejoras técnicas opcionales (no críticas)

- **`chart_widget` para portal** — requiere lib de charts (Chart.js ~30 KB). Plan original lo pedía pero el `kpi_widget` cubre el 80% del caso de uso.
- **`comments_thread` para portal** — requiere endpoint POST nuevo + integración con `CommentService` de Fase 3.
- **`related_records_kanban`** — variante del tabla, baja prioridad.
- **UI para `fixed_filter_tree` en `PublicVisibilityPanel`** — hoy se setea via REST PATCH directo. El `FiltersPanel` del admin existe pero requiere refactor para ser embebible.
- **Tests E2E con Vitest** — CLAUDE.md menciona Vitest pero el proyecto no lo configuró. Test runner separado al de PHPUnit.
- **Tests integration con WP real** — `bin/install-wp-tests.sh` ya existe. Hace falta una suite que use BD real para validar shapes de response (hubiera atrapado el bug 0.40.4).
- **PHPStan 2.x upgrade** — actualmente PHPStan 1.12. Reportaría mejoras de tipos.
- **PHPCS WordPress sniffs** — actualmente bloqueado por sniffs sin registrar (`WordPress-Extra` no resuelve). Cleanup separado.

### Mejoras de UX

- **Magic link UI en panel CRM** — botón "Enviar magic link" al lado del "Crear acceso al portal" en `PortalAccessButton`. El endpoint existe; falta solo el JSX.
- **Inputs por tipo en `editable_form` para `user`/`file`/`relation`** — hoy esos tipos caen al text fallback. Pickers específicos son trabajo significativo.
- **Filtros UI en bundle público** — backend soporta `filter[slug][op]=value`, el frontend solo expone search + sort.
- **Mensaje de error específico cuando WP no tiene pretty permalinks** — `PublicPermalinks` registra rules pero no funcionan. UI debería detectar y avisar.

### Limpieza técnica del codebase preexistente (no introducido en esta sesión)

- 7 errores PHPUnit por `CommentEntity::__construct` argument count (preexistentes desde 0.33.0).
- 22 errores PHPStan en `Search/MysqlSearchEngine`, `Records/RecordRepository`, etc. (preexistentes).
- PHPCS bloqueado por sniffs WP no registrados.

---

## 10. Contacto y referencia

| | |
|---|---|
| Plugin URL | `https://imaginawp.com/imagina-crm` |
| Repo | `augusto97/imagina-crm` |
| Branch dev (esta sesión) | `claude/bootstrap-wp-plugin-qGRaH` |
| Branch release | `release` |
| Doc del plan | `docs/multi-stakeholder-design.md` |
| Este doc | `docs/SESSION-HANDOFF.md` |
| Changelog usuario | `readme.txt` ("Changelog" section) |
| Changelog dev | `docs/changelog.md` |
| User email (de las instrucciones del session) | `augusto97@gmail.com` |

---

**Fin de la memoria.** Si vas a continuar el desarrollo, leé `CLAUDE.md` + `docs/multi-stakeholder-design.md` + este archivo, en ese orden. Después podés hacer `git log --oneline` para ver los commits y `git show <sha>` para detalles de cualquier release.
