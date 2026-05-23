# Diseño técnico — CRM multi-stakeholder

> **Status**: Planeación · no implementar nada de este doc hasta que el usuario apruebe explícitamente cada fase.
> **Versión**: 0.1 (borrador)
> **Fases**: 7 (Permisos), 8 (Listas públicas), 9 (Portal del cliente), 10 (Pulidos opcionales)
> **Decisiones de producto cerradas**:
> - Clientes = `wp_users` con rol `crm_client` (login WP nativo)
> - Front público embebido en el tema (shortcode + bloque Gutenberg)
> - Diseño técnico antes de codear

---

## 0. Contexto y motivación

Hoy el plugin es admin-only: cualquier usuario con `manage_options` ve todo. Este documento describe la transición a un modelo multi-stakeholder donde coexisten:

- **Equipo interno** con distintos niveles (admin, manager, agent, viewer)
- **Visitantes del sitio** que ven listas públicas (catálogos, directorios, etc.)
- **Clientes finales** que entran a un portal privado con sus propios datos

Las tres piezas son interdependientes:

```
[Fase 7] Roles y permisos   ←── base
              │
              ├──→ [Fase 8] Listas públicas
              │
              └──→ [Fase 9] Portal del cliente
```

---

## 1. Fase 7 — Roles y permisos

### 1.1 Roles del plugin

Cinco roles nuevos registrados en WP vía `add_role()` durante activación. Heredan capabilities WP base (`read`) y suman las propias del plugin:

| Rol | Slug | Para quién |
|---|---|---|
| Admin del CRM | `crm_admin` | Owners / gerentes con control total |
| Manager | `crm_manager` | Líderes que gestionan records pero no schema |
| Agente | `crm_agent` | Usuarios operativos (vendedores, soporte) |
| Visualizador | `crm_viewer` | Read-only, ej. directivos que solo consultan |
| Cliente | `crm_client` | Clientes finales con acceso solo a su portal |

Los WP `administrator` siempre tienen todas las caps (no se les quita nada).

### 1.2 Capabilities

Lista plana de capabilities WP. Cada endpoint REST y cada elemento de UI checa una de éstas:

```php
// src/Permissions/CapabilityRegistry.php
final class CapabilityRegistry {
    public const CAPS = [
        // Acceso general al admin SPA
        'imcrm_access_admin',

        // Schema (listas, campos, vistas, automatizaciones, dashboards)
        'imcrm_manage_lists',
        'imcrm_manage_fields',
        'imcrm_manage_views',
        'imcrm_manage_automations',
        'imcrm_manage_dashboards',

        // Records
        'imcrm_view_records',
        'imcrm_view_own_records',
        'imcrm_create_records',
        'imcrm_edit_records',
        'imcrm_edit_own_records',
        'imcrm_delete_records',
        'imcrm_delete_own_records',

        // Imports / exports / bulk
        'imcrm_import_records',
        'imcrm_export_records',
        'imcrm_bulk_actions',

        // Portal
        'imcrm_access_portal',
    ];

    public const DEFAULTS_BY_ROLE = [
        'crm_admin'   => [/* todas */],
        'crm_manager' => [
            'imcrm_access_admin',
            'imcrm_manage_views',
            'imcrm_manage_dashboards',
            'imcrm_view_records',
            'imcrm_create_records',
            'imcrm_edit_records',
            'imcrm_delete_records',
            'imcrm_import_records',
            'imcrm_export_records',
            'imcrm_bulk_actions',
        ],
        'crm_agent' => [
            'imcrm_access_admin',
            'imcrm_view_own_records',
            'imcrm_create_records',
            'imcrm_edit_own_records',
            'imcrm_export_records',
        ],
        'crm_viewer' => [
            'imcrm_access_admin',
            'imcrm_view_records',
            'imcrm_export_records',
        ],
        'crm_client' => [
            'imcrm_access_portal',
            // sin acceso al admin
        ],
    ];
}
```

### 1.3 ACL por lista

Las capabilities arriba son globales. Por lista guardamos ajustes finos en `wp_imcrm_lists.settings.permissions`:

```json
{
  "permissions": {
    "crm_agent": {
      "view": "own",
      "create": true,
      "edit": "own",
      "delete": "none",
      "fields_hidden": []
    },
    "crm_viewer": {
      "view": "all",
      "create": false,
      "edit": "none",
      "delete": "none",
      "fields_hidden": ["notas_internas", "precio_costo"]
    }
  }
}
```

**Campos**:
- `view`: `'all' | 'own' | 'assigned' | 'none'`
- `create`: bool
- `edit`: `'all' | 'own' | 'none'`
- `delete`: `'all' | 'own' | 'none'`
- `fields_hidden`: array de slugs ocultos para ese rol (Fase 10 opcional, dejar la columna ya en el shape)

Si una lista no tiene `permissions` en settings: comportamiento default = solo `crm_admin` y `administrator` la ven (back-compat seguro).

### 1.4 Scope `own` y `assigned`

Cuando el scope es `own`: `WHERE created_by = current_user_id()`.

Cuando es `assigned`: requiere un campo de tipo `user` en la lista marcado como "asignación". Almacenado en `settings.assignment_field_id`. Sin ese campo, `assigned` se comporta como `none`. Query: `WHERE {assignment_col} = current_user_id()`.

### 1.5 Cambios de schema

**Sin tablas nuevas.** Todo va en `wp_imcrm_lists.settings` (que ya es JSON). Una migración menor para inicializar `settings.permissions` con valores default seguros para listas pre-existentes.

### 1.6 Service layer

```php
// src/Permissions/PermissionService.php
final class PermissionService {
    public function userCanAccessAdmin(\WP_User $user): bool;
    public function userCanManageList(\WP_User $user, ListEntity $list): bool;
    public function userCanViewList(\WP_User $user, ListEntity $list): bool;
    public function userCanCreateInList(\WP_User $user, ListEntity $list): bool;

    public function userCanViewRecord(\WP_User $user, ListEntity $list, array $record): bool;
    public function userCanEditRecord(\WP_User $user, ListEntity $list, array $record): bool;
    public function userCanDeleteRecord(\WP_User $user, ListEntity $list, array $record): bool;

    /**
     * Devuelve la cláusula WHERE adicional a inyectar en queries de records
     * cuando el scope del usuario no es 'all'. Retorna ['sql' => string, 'args' => array].
     */
    public function recordsScopeWhere(\WP_User $user, ListEntity $list): array;

    /** Devuelve slugs de fields visibles para el usuario en esta lista. */
    public function visibleFieldSlugs(\WP_User $user, ListEntity $list): array;
}
```

### 1.7 Integración en REST

Todos los controllers REST cambian su `permission_callback` de:

```php
'permission_callback' => fn() => current_user_can('manage_options'),
```

a:

```php
'permission_callback' => [$this, 'checkListPermission'],
```

Donde `checkListPermission` resuelve la lista del request y consulta `PermissionService`.

`RecordsController` inyecta la cláusula `recordsScopeWhere()` antes de pasar al `QueryBuilder`. `QueryBuilder` recibe un parámetro adicional `additionalWhere` que se hace AND con el filter tree del usuario.

### 1.8 Cambios en frontend

- **Bootstrap data** (`getBootData()`) ahora incluye `caps: string[]` con las capabilities del usuario actual.
- **Hooks**: nuevo `useCan('imcrm_create_records')` → bool. Componentes lo usan para mostrar/ocultar botones.
- **Sidebar**: items ocultos si no hay cap correspondiente (`imcrm_manage_lists`, `imcrm_manage_automations`, etc.).
- **List Builder**: nueva tab "Permisos" con un grid `rol × (view/create/edit/delete)` editable. Solo visible si el usuario tiene `imcrm_manage_lists`.
- **Records page**: filtra acciones bulk según caps. Esconde "Eliminar" si no tiene `imcrm_delete_records`.
- **TableView**: oculta columnas en `fields_hidden` para el rol del usuario.

### 1.9 Endpoints REST nuevos

```
GET   /imagina-crm/v1/me                          # ya existe, ampliar con `roles` y `caps`
GET   /imagina-crm/v1/me/permissions              # caps + lista de IDs de listas accesibles
PATCH /imagina-crm/v1/lists/{id}/permissions      # actualiza settings.permissions
GET   /imagina-crm/v1/roles                       # lista de roles disponibles + sus caps default
```

### 1.10 Migración de instalaciones existentes

Bump `IMAGINA_CRM_DB_VERSION` a `8`. El upgrader:

1. Registra los 5 roles nuevos (`add_role` idempotente).
2. Para cada `administrator`, añade todas las caps `imcrm_*`.
3. Para cada lista existente, inicializa `settings.permissions` con `crm_admin: all` y nada más (no se pierde acceso para admins de WP).

### 1.11 Tests

- Unitarios: `PermissionService` con cada combinación rol × scope × operación.
- Integration: REST endpoints con distintos usuarios autenticados, verificar que respondan 403 cuando corresponde y filtren records correctamente.
- E2E: usuario `crm_agent` ve solo sus records, no puede borrar, no ve "Eliminar lista".

### 1.12 Estimación

| Sub-tarea | Días |
|---|---|
| CapabilityRegistry + roles + activación | 1 |
| PermissionService + tests | 2 |
| Integración REST (todos los controllers) | 3 |
| QueryBuilder con `additionalWhere` | 1 |
| Tab "Permisos" en List Builder | 2 |
| Frontend gating (sidebar, botones, columnas) | 2 |
| Migración + tests E2E | 1 |
| **Total** | **~12 días hábiles (2.5 semanas)** |

---

## 2. Fase 8 — Listas públicas (read-only en el front)

### 2.1 Configuración por lista

Nueva sección en List Builder: "Visibilidad pública". Genera el siguiente JSON en `wp_imcrm_lists.settings.public`:

```json
{
  "public": {
    "enabled": true,
    "visible_field_slugs": ["nombre", "categoria", "precio"],
    "fixed_filter_tree": {
      "type": "group",
      "logic": "and",
      "children": [
        { "type": "condition", "field_id": 12, "op": "eq", "value": "publicado" }
      ]
    },
    "viewer_filters_allowed": true,
    "sort_allowed_slugs": ["nombre", "precio"],
    "default_sort": "precio:asc",
    "per_page": 20,
    "search_enabled": true,
    "cache_ttl": 60
  }
}
```

**Garantías de seguridad**:
- `fixed_filter_tree` siempre se aplica server-side (no se puede eludir desde el front).
- Solo se serializan `visible_field_slugs` en la respuesta — campos sensibles nunca salen.
- Si `enabled: false` o la lista no tiene la clave `public`, el endpoint público devuelve 404.

### 2.2 REST público

Namespace separado: `/imagina-crm/v1/public/`. Sin nonce, sin auth.

```
GET /imagina-crm/v1/public/lists/{slug}              # metadata de la lista (nombre, descripción, fields visibles)
GET /imagina-crm/v1/public/lists/{slug}/records      # records con paginación
GET /imagina-crm/v1/public/lists/{slug}/records/{id} # detalle (si se habilita)
```

**Query params** (subset del admin):
```
?page=1
&per_page=20
&sort=nombre:asc                  # restringido a sort_allowed_slugs
&filter[categoria][eq]=electronica # restringido a fields visibles si viewer_filters_allowed=true
&search=acme                       # si search_enabled
```

Rate limiting: máximo 60 req/min por IP (vía transient).

### 2.3 Cache

- **Server-side**: `wp_cache_*` (object cache) con TTL = `cache_ttl` (default 60s). Invalidación por hook `imagina_crm/record_created|updated|deleted` para esa lista.
- **HTTP**: response headers `Cache-Control: public, max-age=60` y `Vary: Cookie`.
- **CDN-friendly**: el endpoint no usa cookies, así que CDN puede cachear sin problemas.

### 2.4 Shortcode

```
[imcrm-list slug="precios" view="default" per_page="10"]
```

**Atributos**:
- `slug` (requerido) — slug de la lista
- `view` (opcional) — slug de una saved_view; aplica su config como base
- `per_page` (opcional, override)
- `search` (opcional, "true"/"false")
- `sort` (opcional)

**Render**:
1. PHP server-side renderiza un `<div data-imcrm-public-list="..." data-config="...">...</div>` con la PRIMERA página de records ya inyectada como JSON (para SEO + first-paint sin JS).
2. El bundle `public.js` (cargado solo cuando hay shortcode en la página) hidrata el div con React, habilitando filtros/sort/paginación dinámicos.

```php
// src/Public/ShortcodeHandler.php
add_shortcode('imcrm-list', [$this, 'render']);

public function render(array $atts): string {
    $list = $this->lists->findByIdOrSlug($atts['slug'] ?? '');
    if ($list === null || !$this->publicService->isPublic($list)) {
        return '';
    }
    // Server-side prefetch de la primera página
    $initialData = $this->publicService->fetchPage($list, $atts);
    return $this->view->render('public-list', [
        'list' => $list,
        'initial' => $initialData,
        'config' => $this->publicService->resolveConfig($list, $atts),
    ]);
}
```

### 2.5 Bloque Gutenberg

`imagina-crm/list-block` registrado vía `register_block_type`. Edita lista + opciones en el editor de bloques, renderiza el mismo shortcode en frontend.

```js
// app/blocks/list-block/index.ts
registerBlockType('imagina-crm/list', {
    title: 'Lista Imagina CRM',
    icon: 'database',
    category: 'widgets',
    attributes: {
        listSlug: { type: 'string' },
        viewSlug: { type: 'string', default: '' },
        perPage: { type: 'number', default: 10 },
    },
    edit: ListBlockEdit,    // dropdown de listas públicas + preview
    save: () => null,       // server-rendered
});
```

### 2.6 Frontend bundle público

**Nuevo entry point**: `app/public.tsx`. Bundle separado, target < 50KB gzip.

Stack reducido:
- React 18 (compartido con admin si está en la misma página, sino independiente)
- TanStack Query (sin devtools)
- Sin TanStack Table — render simple con `<table>` o `<ul>` + grid CSS
- Sin Tailwind heavy — solo subset crítico inlined; tema del usuario puede tunear vía CSS variables (`--imcrm-public-*`)
- Sin shadcn/ui — componentes mínimos propios (input, button, paginación)

**Hidratación**:
```tsx
// app/public.tsx
document.querySelectorAll('[data-imcrm-public-list]').forEach((el) => {
    const config = JSON.parse(el.getAttribute('data-config') || '{}');
    const initial = JSON.parse(el.getAttribute('data-initial') || '{}');
    createRoot(el).render(<PublicList config={config} initial={initial} />);
});
```

### 2.7 Theming

El plugin define **CSS variables** que el tema puede override:

```css
:root {
    --imcrm-public-text:      #1a1a1a;
    --imcrm-public-bg:        #ffffff;
    --imcrm-public-border:    #e5e7eb;
    --imcrm-public-primary:   #4f46e5;
    --imcrm-public-font:      inherit;          /* hereda del tema */
    --imcrm-public-radius:    0.5rem;
}
```

Sin Tailwind prefix `imcrm-` en el front público — usamos clases simples `imcrm-public-table`, `imcrm-public-cell`, etc. para que el tema pueda customizar con selectores simples.

### 2.8 Endpoints REST adicionales

```
GET /imagina-crm/v1/lists?public_only=1   # admin: listar listas públicas (para el bloque GB)
PATCH /imagina-crm/v1/lists/{id}/public   # admin: actualizar settings.public
```

### 2.9 SEO

- HTML server-renderizado para la primera página → indexable.
- `<meta>` tags si el shortcode lo permite (`title`, `description` opt-in vía atributo).
- Paginación con `<link rel="next">` / `<link rel="prev">`.

### 2.10 Estimación

| Sub-tarea | Días |
|---|---|
| Sección "Visibilidad pública" en List Builder | 1 |
| `PublicListService` + REST público + rate limiting + cache | 2 |
| Shortcode + render server-side | 1 |
| Frontend bundle `public.tsx` (lista + filtros básicos) | 3 |
| Bloque Gutenberg | 1 |
| CSS theming + docs | 1 |
| Tests + SEO checks | 1 |
| **Total** | **~10 días hábiles (2 semanas)** |

---

## 3. Fase 9 — Portal del cliente

### 3.1 Modelo de datos

**Cliente = `wp_user` con rol `crm_client`**.

Una lista (típicamente llamada "Clientes") es la **lista de portal**: cada record corresponde a un cliente. Tiene un campo de tipo `user` marcado como **owner_field**. Almacenado en `settings.portal.owner_field_id`.

Las **demás listas** pueden tener un campo de tipo `relation` que apunta a la lista de portal — eso enlaza records a clientes. Ej: lista "Facturas" tiene `cliente_id` (relation a Clientes) → cada factura pertenece al cliente referenciado.

### 3.2 Templates de portal

Reusamos el **Template Editor** existente (hoy usado para Record Detail). Añadimos un nuevo tipo:

```ts
// app/types/template.ts
type TemplateKind = 'record_detail' | 'client_portal';
```

Bloques disponibles en `client_portal`:

| Bloque | Función |
|---|---|
| `client_data` | Renderiza los campos del record del cliente (read-only por default) |
| `editable_form` | Form para que el cliente actualice un subset whitelisteado de campos propios |
| `related_records_table` | Tabla de records de otra lista filtrados al cliente actual |
| `related_records_kanban` | Mismos records, vista Kanban |
| `kpi_widget` | KPI calculado sobre los records relacionados al cliente |
| `chart_widget` | Gráfico (bar/line/pie) sobre records del cliente |
| `activity_timeline` | Timeline de actividad filtrada al cliente |
| `comments_thread` | Hilo de comentarios entre admin ↔ cliente sobre el record |
| `static_text` | Bloque de texto/HTML estático (mensaje de bienvenida, instrucciones) |
| `download_files` | Lista de archivos adjuntos del record del cliente |
| `external_link` | Botón con link externo (ej. "Pagar factura") |

Cada bloque tiene config propia. Ej. `related_records_table`:

```json
{
  "type": "related_records_table",
  "config": {
    "list_id": 5,
    "relation_field_id": 23,
    "visible_field_slugs": ["fecha", "concepto", "monto", "estado"],
    "sort": "fecha:desc",
    "per_page": 10,
    "actions": ["download_pdf"]
  }
}
```

### 3.3 URL routing

Admin crea una página WP normal con shortcode:

```
[imcrm-client-portal template_id="42"]
```

URL queda donde la admin decida: `/portal/`, `/mi-cuenta/`, `/clientes/`, etc.

Rewrite rule opcional: el plugin puede registrar `/portal/` → esa página si el admin lo activa en settings (default off).

### 3.4 Auth flow

1. Cliente recibe email con credenciales (creadas por admin desde Lista Clientes con botón **"Crear acceso de portal"**).
2. Cliente va a `/portal/` (o donde esté el shortcode).
3. Si no está logueado: redirect a `wp_login_url()` con `redirect_to` apuntando de vuelta.
4. WP procesa login normal.
5. Después del login, el shortcode renderiza:
   - Si el user tiene rol `crm_client`: portal con sus datos.
   - Si tiene otro rol (admin, etc.): warning + link al panel admin.
   - Sin rol válido: 403.

### 3.5 Resolución del record del cliente

```php
// src/Portal/ClientResolver.php
final class ClientResolver {
    public function resolveClientRecord(\WP_User $user): ?array {
        // 1. Encuentra la lista marcada como "portal" (settings.portal.enabled=true)
        $portalList = $this->lists->findPortalList();
        if ($portalList === null) return null;

        // 2. Encuentra el record cuyo owner_field == $user->ID
        $ownerSlug = $this->fields->find($portalList->settings['portal']['owner_field_id'])->slug;
        return $this->records->findOneWhere($portalList, [$ownerSlug => $user->ID]);
    }
}
```

Si no encuentra record: el portal muestra "Tu cuenta aún no está asociada a un cliente. Contacta al administrador."

### 3.6 Data isolation (CRÍTICO)

Toda query del portal pasa por `PortalScopeService` que **inyecta forzosamente** la cláusula de propiedad:

```php
// src/Portal/PortalScopeService.php
final class PortalScopeService {
    /**
     * Devuelve el WHERE que se debe inyectar en queries de records cuando se
     * accede desde el portal. Sin esto, el cliente podría ver records de
     * otros clientes (data leak).
     */
    public function recordsWhereForUser(\WP_User $user, ListEntity $list): array {
        $clientRecord = $this->resolver->resolveClientRecord($user);
        if ($clientRecord === null) {
            return ['sql' => '1=0', 'args' => []]; // bloquea todo
        }
        // Lista de portal: solo su propio record
        if ($this->isPortalList($list)) {
            return ['sql' => 'AND id = %d', 'args' => [$clientRecord['id']]];
        }
        // Lista relacionada: records vinculados al cliente
        $relationFieldId = $this->findRelationFieldTo($list, $portalList->id);
        if ($relationFieldId === null) {
            return ['sql' => '1=0', 'args' => []]; // sin relación, sin acceso
        }
        // ...filtro por relación a clientRecord
    }
}
```

**Tests obligatorios**: usuario A no debe poder pedir `GET /portal/lists/facturas/records/{id_de_B}` y recibir data. Debe responder 404 (sin filtrar por mensaje de error).

### 3.7 Mutaciones permitidas

El cliente puede editar **solo campos en una whitelist** definida en el bloque `editable_form` del template:

```json
{
  "type": "editable_form",
  "config": {
    "editable_field_slugs": ["telefono", "direccion", "preferencias_email"],
    "submit_label": "Guardar cambios"
  }
}
```

REST nuevo:

```
PATCH /imagina-crm/v1/portal/me                # actualiza el record del cliente (whitelist)
POST  /imagina-crm/v1/portal/lists/{slug}/records/{id}/comment   # comentar en un record propio
```

El controller valida que cada slug enviado esté en la whitelist del template activo. Slugs fuera de whitelist → 403 con mensaje "Campo no editable".

### 3.8 Frontend del portal

**Bundle**: separado del admin y del público. Entry `app/portal.tsx`. Stack:

- React 18
- TanStack Query
- shadcn/ui mínimo (compartido con admin, pero solo los componentes necesarios)
- Tailwind con prefijo `imcrm-portal-`
- React Hook Form para los `editable_form`

Bundle target: < 150KB gzip (más grande que público porque tiene formularios y widgets, pero más chico que admin).

Renderiza el template recibido del backend, mapeando cada bloque a un componente React:

```tsx
function PortalRenderer({ template, clientId }: Props) {
    return template.blocks.map((block) => {
        switch (block.type) {
            case 'client_data':           return <ClientDataBlock {...block.config} />;
            case 'editable_form':         return <EditableFormBlock {...block.config} />;
            case 'related_records_table': return <RelatedTableBlock {...block.config} />;
            case 'kpi_widget':            return <KpiBlock {...block.config} />;
            // ...
        }
    });
}
```

### 3.9 REST del portal

Namespace `/imagina-crm/v1/portal/`. Requiere usuario autenticado con cap `imcrm_access_portal`.

```
GET   /imagina-crm/v1/portal/me                          # record del cliente actual + template asignado
GET   /imagina-crm/v1/portal/template/{id}               # config del template (admin lo asignó)
GET   /imagina-crm/v1/portal/lists/{slug}/records        # records relacionados al cliente (PortalScopeService aplicado)
GET   /imagina-crm/v1/portal/lists/{slug}/records/{id}   # detalle si está relacionado al cliente
PATCH /imagina-crm/v1/portal/me                          # actualiza campos whitelisteados del propio record
POST  /imagina-crm/v1/portal/lists/{slug}/records/{id}/comment
```

### 3.10 Cambios de schema

**Nuevas tablas**: ninguna.

**Nuevas columnas/settings**:
- `wp_imcrm_lists.settings.portal`:
  ```json
  {
    "portal": {
      "enabled": false,
      "owner_field_id": 42,
      "default_template_id": 7
    }
  }
  ```
- Templates ya tienen tabla (`wp_imcrm_templates`); añadir columna `kind ENUM('record_detail', 'client_portal')` con default 'record_detail'.

Bump `IMAGINA_CRM_DB_VERSION` a `9`. Migración añade columna `kind` con default 'record_detail'.

### 3.11 Creación del acceso desde admin

En el List Builder de la lista de portal, nuevo botón por record:

**"Crear acceso al portal"**:
1. Admin abre el record de un cliente.
2. Botón abre modal con campos: email (autodetectado del campo email del record), nombre, password generado (o "enviar magic link").
3. Al confirmar: `wp_create_user()` con rol `crm_client`, vincula al record (escribe el `user_id` en el owner_field).
4. Email automático: "Tu acceso a {nombre del sitio}: usuario X, link a /portal/".

### 3.12 Estimación

| Sub-tarea | Días |
|---|---|
| `ClientResolver` + `PortalScopeService` + tests de aislamiento | 3 |
| Template Editor: nuevo kind `client_portal` + bloques nuevos | 5 |
| Creación de acceso desde lista | 1 |
| REST `/portal/*` + permission checks | 2 |
| Frontend bundle `portal.tsx` + renderer + bloques | 6 |
| Shortcode `[imcrm-client-portal]` + auth flow | 1 |
| Tests E2E + security review | 2 |
| **Total** | **~20 días hábiles (4 semanas)** |

---

## 4. Fase 10 — Pulidos opcionales

Posponibles. Lista para futuro:

### 4.1 Per-field permissions

`fields_hidden` ya está en el shape del ACL. Implementar:
- En `RecordsController`: filtrar campos antes de devolver.
- En `RecordValidator`: rechazar updates a campos ocultos.
- En `TableView`: ocultar columnas.

Estimación: 2 días.

### 4.2 Magic links (login sin password)

- Genera token único por cliente, válido 7 días.
- Link: `/portal/?token=...`.
- El plugin valida el token, hace `wp_set_auth_cookie()` y redirige.

Estimación: 3 días.

### 4.3 Permalink dedicado para listas públicas

En vez de shortcode, una lista con `public.enabled=true` puede tener `public.permalink_base = "precios"` → registrar rewrite rule `/precios/` y `/precios/{record_slug}/`.

Estimación: 3 días.

### 4.4 Roles personalizados

Admin define sus propios roles más allá de los 5 default, con su propio capability set.

Estimación: 5 días.

---

## 5. Resumen de cambios cross-cutting

### 5.1 Versionado

- Fase 7 → 0.37.0
- Fase 8 → 0.38.0
- Fase 9 → 0.39.0
- Fase 10 → 0.40.x

### 5.2 DB version bumps

| Versión | DB | Cambio |
|---|---|---|
| Actual | 7 | — |
| 0.37.0 | 8 | `settings.permissions` default en listas existentes; roles + caps creados |
| 0.39.0 | 9 | `wp_imcrm_templates.kind` columna |

### 5.3 REST namespaces

| Namespace | Auth | Para |
|---|---|---|
| `/imagina-crm/v1/...` | Cookie WP + nonce | Admin SPA (cambia: caps en vez de manage_options) |
| `/imagina-crm/v1/public/...` | Ninguna | Listas públicas |
| `/imagina-crm/v1/portal/...` | Cookie WP + nonce + cap `imcrm_access_portal` | Portal del cliente |

### 5.4 Frontend bundles

| Bundle | Target gzip | Carga en |
|---|---|---|
| `admin.js` (actual) | ~180KB | `/wp-admin/admin.php?page=imagina-crm` |
| `public.js` (nuevo) | < 50KB | Páginas con shortcode `[imcrm-list]` o bloque |
| `portal.js` (nuevo) | < 150KB | Páginas con shortcode `[imcrm-client-portal]` |

Vite multi-entry: `vite.config.ts` actualiza para producir los 3 bundles independientes.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Data leak en portal (cliente A ve datos de B) | Tests de aislamiento OBLIGATORIOS antes de merge. Code review específico de `PortalScopeService`. |
| Listas públicas indexadas por Google con datos sensibles | UI clara en List Builder: confirmación "esto es público en internet" + lista de campos visibles. Default = nada visible. |
| Rendimiento del front público bajo tráfico | Cache server-side (object cache + HTTP) por default. CDN-friendly. Rate limit por IP. |
| Bundle inicial del front público pesa demasiado | Target < 50KB enforced en CI con `vite-bundle-visualizer`. |
| Cambios de capability rompen instalaciones existentes | Migración asigna todas las caps al rol `administrator` → compatibilidad total con la UX previa. |
| Tema del cliente conflicta con CSS del front | Prefijo `imcrm-public-` + CSS variables override-ables. Tests visuales en 3 temas populares (Twenty Twenty-Four, Astra, GeneratePress). |

---

## 7. Open questions (para iterar en discovery durante implementación)

1. ¿El bloque Gutenberg debe permitir customizar el template visual (qué columnas mostrar, cómo) o solo elegir la lista?
2. ¿En el portal, los comentarios entre admin y cliente son visibles a otros admins del CRM o privados (1:1)?
3. ¿Soporte para archivos: el cliente sube docs (DNI, comprobantes) desde el portal? Si sí, validación de tipos + tamaños.
4. ¿Pagos: integrar con WooCommerce u otro gateway, o queda fuera del scope?
5. ¿Multiidioma: si el cliente prefiere inglés y el admin español, ¿el portal respeta locale del wp_user?
6. ¿Notificaciones: cuando admin actualiza un record, ¿se notifica al cliente por email? ¿Configurable por bloque del template?

---

## 8. Lo que NO se hace en estas fases

Para mantener scope:
- ❌ No mobile app nativa (PWA queda como fase 11+).
- ❌ No facturación / pagos en el portal (queda para módulo separado).
- ❌ No chat en tiempo real (solo comentarios async).
- ❌ No SSO con Google / Facebook / Microsoft (solo login WP nativo en MVP).
- ❌ No multi-tenancy (un WordPress = una organización).

---

**Próximo paso**: revisar este doc, ajustar lo que haga falta, y aprobar para empezar Fase 7.
