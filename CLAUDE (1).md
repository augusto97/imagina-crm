# Imagina CRM — Plugin de WordPress

> Plataforma de gestión de listas, registros y automatizaciones tipo **ClickUp/Airtable** nativa en WordPress. Permite al usuario final crear listas personalizadas con campos dinámicos, vistas configurables y automatizaciones, todo desde una UI moderna construida con React + shadcn/ui.
>
> El nombre del plugin es **Imagina CRM** porque, aunque la Fase 1 se enfoca en listas tipo CRM, la arquitectura está pensada para escalar a cualquier dominio (gestión de proyectos, inventario, soporte, recursos humanos, etc.) — el "CRM" funciona como caso de uso ancla, no como límite del producto.

---

## 1. Resumen del Proyecto

**Nombre del plugin:** Imagina CRM
**Text domain:** `imagina-crm`
**Prefijo PHP / SQL / JS:** `imcrm_` (tablas), `ImaginaCRM\` (namespace), `imcrm` (JS globals)
**Slug del plugin (carpeta):** `imagina-crm`
**Constante root:** `IMAGINA_CRM`
**Autor:** IMAGINA LA WEB S.A.S. — Imagina WP
**Licencia:** GPLv2+ (con licenciamiento comercial propio para soporte y updates)
**Requisitos mínimos:**
- WordPress 6.4+
- PHP 8.2+
- MySQL 8.0+ / MariaDB 10.6+
- Rol `manage_options` para administración del plugin

---

## 2. Contexto y Mercado

El plugin se construye **comercializable desde el día 1**. No debe contener hardcoding del caso de uso de Imagina WP; todo debe ser configurable por el usuario final, **incluyendo los slugs de listas y campos**.

**Competencia de referencia:**
- **ClickUp, Airtable, Notion Databases, Monday** — UX objetivo
- **FluentCRM, Groundhogg, WooFunnels** — plugins WP que tocan CRM pero NO resuelven listas/campos totalmente personalizables
- **Jet Engine, Pods, Metabox, ACF** — manejan custom fields pero no tienen vistas tipo Table/Kanban ni automatizaciones integradas

**Diferenciador:**
Ningún plugin WP hoy combina **listas dinámicas con schema real en MySQL** (no EAV), **vistas tipo Table/Kanban** pulidas y **motor de automatizaciones** en un solo producto con UX moderna.

**Integración con facturación:**
En esta fase NO se integra con Perfex CRM ni otros sistemas externos. En una fase futura se construirá un módulo propio de facturación dentro del mismo ecosistema Imagina CRM.

---

## 3. Stack Tecnológico

### Backend
- **PHP 8.2+** con `declare(strict_types=1)` en todos los archivos
- **Composer** con autoload PSR-4 bajo `ImaginaCRM\`
- **WordPress REST API** con namespace propio `imagina-crm/v1`
- **Action Scheduler** (vía Composer) para cron y jobs asíncronos
- **Patrón Repository + Service Layer**, nunca lógica de negocio en controllers REST ni en hooks
- **DI Container ligero** propio, inyección por constructor
- **wpdb con prepared statements** siempre; queries complejas vía `QueryBuilder` propio

### Frontend (admin)
- **React 18 + TypeScript** en modo estricto (`strict: true`)
- **Vite 5** con `@kucrut/vite-for-wp` para build e integración con WP
- **TanStack Table v8** para vista Table (headless, virtualización, filtros, sort)
- **TanStack Query v5** para data fetching (cache, mutations, optimistic updates)
- **Zustand** para estado global del admin
- **React Hook Form + Zod** para formularios y validación
- **React Router v6** (HashRouter para WP compatibility)

### UI / Visual
- **shadcn/ui** copiado a `app/components/ui/` (componentes propios basados en Radix)
- **Tailwind CSS v3** con prefijo `imcrm-` para no contaminar wp-admin
- **Lucide React** para iconografía
- **Framer Motion** para micro-animaciones
- **Inter** como tipografía principal, cargada localmente
- **Tokens de diseño** en `tailwind.config.ts`: paleta, radios, sombras, espaciados estilo Linear/Vercel

### Tooling
- **ESLint + Prettier + TypeScript strict** — CI bloquea merge si hay errores
- **PHPStan nivel 8** + **PHP_CodeSniffer con WordPress-Extra**
- **Vitest** para tests del frontend, **PHPUnit** para backend
- **GitHub Actions** para lint + tests + build en cada PR

---

## 4. Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                     Admin React SPA                      │
│  (shadcn/ui + TanStack Table + TanStack Query + Zustand)│
└───────────────────────────┬─────────────────────────────┘
                            │ fetch con X-WP-Nonce
┌───────────────────────────▼─────────────────────────────┐
│            WordPress REST API /imagina-crm/v1           │
│                 (Controllers delgados)                   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    Service Layer                         │
│  ListService · RecordService · ViewService · SchemaMgr  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                   Repository Layer                       │
│     (wpdb prepared statements, QueryBuilder propio)     │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                       MySQL                              │
│  Tablas del sistema + tablas dinámicas por lista        │
└─────────────────────────────────────────────────────────┘
```

**Principios:**
1. **Separación estricta:** REST Controllers no hablan con `wpdb`. Siempre Service → Repository.
2. **Schema físico, no EAV:** cada lista creada por el usuario = una tabla MySQL real con columnas tipadas.
3. **Identidad por ID, no por slug:** todas las relaciones internas (tablas, código, REST, frontend) usan IDs numéricos como llave primaria. Los slugs son solo identificadores **humanos editables** (ver sección 7).
4. **Todo tipado:** TypeScript estricto en front, PHPStan nivel 8 en back.
5. **API-first:** el plugin es una SPA consumiendo REST.

---

## 5. Estructura de Directorios

```
imagina-crm/
├── imagina-crm.php                   # Plugin bootstrap
├── uninstall.php
├── composer.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── phpstan.neon
├── phpcs.xml.dist
├── readme.txt
│
├── src/                              # PHP (namespace ImaginaCRM\)
│   ├── Plugin.php
│   ├── Container.php
│   ├── Activation/
│   │   ├── Installer.php
│   │   ├── Upgrader.php
│   │   └── Deactivator.php
│   ├── Lists/
│   │   ├── ListEntity.php
│   │   ├── ListRepository.php
│   │   ├── ListService.php
│   │   ├── SchemaManager.php         # CREATE/ALTER TABLE dinámico
│   │   └── SlugManager.php           # validación, generación, rename de slugs
│   ├── Fields/
│   │   ├── FieldEntity.php
│   │   ├── FieldRepository.php
│   │   ├── FieldService.php
│   │   ├── FieldTypeRegistry.php
│   │   └── Types/
│   │       ├── AbstractFieldType.php
│   │       ├── TextField.php
│   │       ├── LongTextField.php
│   │       ├── NumberField.php
│   │       ├── CurrencyField.php
│   │       ├── SelectField.php
│   │       ├── MultiSelectField.php
│   │       ├── DateField.php
│   │       ├── DateTimeField.php
│   │       ├── CheckboxField.php
│   │       ├── UrlField.php
│   │       ├── EmailField.php
│   │       ├── UserField.php
│   │       ├── RelationField.php
│   │       └── FileField.php
│   ├── Records/
│   │   ├── RecordRepository.php
│   │   ├── RecordService.php
│   │   ├── QueryBuilder.php
│   │   └── RecordValidator.php
│   ├── Views/
│   │   ├── SavedViewEntity.php
│   │   ├── SavedViewRepository.php
│   │   └── SavedViewService.php
│   ├── Comments/
│   │   ├── CommentRepository.php
│   │   └── CommentService.php
│   ├── Activity/
│   │   ├── ActivityRepository.php
│   │   └── ActivityLogger.php
│   ├── REST/
│   │   ├── RestBootstrap.php
│   │   ├── AbstractController.php
│   │   ├── ListsController.php
│   │   ├── FieldsController.php
│   │   ├── RecordsController.php
│   │   ├── ViewsController.php
│   │   ├── CommentsController.php
│   │   └── ActivityController.php
│   ├── Admin/
│   │   ├── AdminMenu.php
│   │   └── AdminAssets.php
│   ├── Licensing/
│   │   ├── LicenseManager.php
│   │   └── UpdaterClient.php
│   ├── Support/
│   │   ├── Cache.php
│   │   ├── Logger.php
│   │   ├── Nonce.php
│   │   └── Capability.php
│   └── Contracts/
│       ├── RepositoryInterface.php
│       └── FieldTypeInterface.php
│
├── app/                              # Frontend React (TS)
│   ├── main.tsx
│   ├── App.tsx
│   ├── admin/
│   │   ├── layout/
│   │   │   ├── AdminShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── CommandPalette.tsx
│   │   ├── lists/
│   │   │   ├── ListsIndexPage.tsx
│   │   │   ├── ListBuilderPage.tsx
│   │   │   ├── FieldBuilder.tsx
│   │   │   ├── FieldTypeSelect.tsx
│   │   │   ├── SlugEditor.tsx        # editor compartido con preview y advertencias
│   │   │   └── components/
│   │   ├── records/
│   │   │   ├── RecordsPage.tsx
│   │   │   ├── views/
│   │   │   │   └── TableView.tsx
│   │   │   ├── RecordDetailDrawer.tsx
│   │   │   ├── RecordForm.tsx
│   │   │   ├── Filters.tsx
│   │   │   ├── Sort.tsx
│   │   │   └── components/
│   │   └── settings/
│   │       └── LicensePage.tsx
│   ├── components/
│   │   └── ui/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── query-client.ts
│   │   ├── schemas.ts
│   │   ├── slug.ts                   # helpers de slugify y validación
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useLists.ts
│   │   ├── useRecords.ts
│   │   └── useFields.ts
│   ├── stores/
│   │   └── uiStore.ts
│   ├── types/
│   │   ├── list.ts
│   │   ├── field.ts
│   │   └── record.ts
│   └── styles/
│       └── globals.css
│
├── languages/                        # .pot, .po, .mo (es_ES, es_CO, en_US)
├── assets/
├── dist/
├── tests/
│   ├── Unit/
│   └── Integration/
└── .github/
    └── workflows/
        ├── ci.yml
        └── release.yml
```

---

## 6. Esquema de Base de Datos

### 6.1 Tablas del sistema (fijas)

Todas con prefijo `{$wpdb->prefix}imcrm_`:

```sql
-- Listas creadas por el usuario
CREATE TABLE wp_imcrm_lists (
    id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    slug          VARCHAR(64)      NOT NULL,           -- editable; usado para URL y referencia humana
    table_suffix  VARCHAR(64)      NOT NULL,           -- inmutable; usado para nombre de tabla dinámica
    name          VARCHAR(191)     NOT NULL,
    description   TEXT             NULL,
    icon          VARCHAR(64)      NULL,
    color         VARCHAR(16)      NULL,
    settings      JSON             NOT NULL,
    position      INT              NOT NULL DEFAULT 0,
    created_by    BIGINT UNSIGNED  NOT NULL,
    created_at    DATETIME         NOT NULL,
    updated_at    DATETIME         NOT NULL,
    deleted_at    DATETIME         NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_slug (slug),
    UNIQUE KEY uq_table_suffix (table_suffix),
    KEY idx_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Campos de cada lista
CREATE TABLE wp_imcrm_fields (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    list_id         BIGINT UNSIGNED NOT NULL,
    slug            VARCHAR(64)     NOT NULL,         -- editable; referencia humana en filtros/REST
    column_name     VARCHAR(64)     NOT NULL,         -- inmutable; nombre real de columna en tabla dinámica
    label           VARCHAR(191)    NOT NULL,
    type            VARCHAR(32)     NOT NULL,
    config          JSON            NOT NULL,
    is_required     TINYINT(1)      NOT NULL DEFAULT 0,
    is_unique       TINYINT(1)      NOT NULL DEFAULT 0,
    is_primary      TINYINT(1)      NOT NULL DEFAULT 0,
    position        INT             NOT NULL DEFAULT 0,
    created_at      DATETIME        NOT NULL,
    updated_at      DATETIME        NOT NULL,
    deleted_at      DATETIME        NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_list_slug (list_id, slug),
    UNIQUE KEY uq_list_column (list_id, column_name),
    KEY idx_list (list_id),
    KEY idx_deleted (deleted_at),
    CONSTRAINT fk_fields_list FOREIGN KEY (list_id) REFERENCES wp_imcrm_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vistas guardadas por lista
CREATE TABLE wp_imcrm_saved_views (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    list_id         BIGINT UNSIGNED NOT NULL,
    user_id         BIGINT UNSIGNED NULL,
    name            VARCHAR(191)    NOT NULL,
    type            VARCHAR(32)     NOT NULL,         -- 'table' (MVP), futuras
    config          JSON            NOT NULL,         -- referencias internas por field_id
    is_default      TINYINT(1)      NOT NULL DEFAULT 0,
    position        INT             NOT NULL DEFAULT 0,
    created_at      DATETIME        NOT NULL,
    updated_at      DATETIME        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_list (list_id),
    KEY idx_user (user_id),
    CONSTRAINT fk_views_list FOREIGN KEY (list_id) REFERENCES wp_imcrm_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comentarios polimórficos (Fase 3)
CREATE TABLE wp_imcrm_comments (
    id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    list_id       BIGINT UNSIGNED  NOT NULL,
    record_id     BIGINT UNSIGNED  NOT NULL,
    user_id       BIGINT UNSIGNED  NOT NULL,
    parent_id     BIGINT UNSIGNED  NULL,
    content       LONGTEXT         NOT NULL,
    created_at    DATETIME         NOT NULL,
    updated_at    DATETIME         NOT NULL,
    deleted_at    DATETIME         NULL,
    PRIMARY KEY (id),
    KEY idx_list_record (list_id, record_id),
    KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity log polimórfico
CREATE TABLE wp_imcrm_activity (
    id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    list_id       BIGINT UNSIGNED  NOT NULL,
    record_id     BIGINT UNSIGNED  NULL,
    user_id       BIGINT UNSIGNED  NULL,
    action        VARCHAR(64)      NOT NULL,
    changes       JSON             NULL,
    created_at    DATETIME         NOT NULL,
    PRIMARY KEY (id),
    KEY idx_list_record (list_id, record_id),
    KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relaciones entre registros de distintas listas
CREATE TABLE wp_imcrm_relations (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    field_id            BIGINT UNSIGNED NOT NULL,
    source_list_id      BIGINT UNSIGNED NOT NULL,
    source_record_id    BIGINT UNSIGNED NOT NULL,
    target_list_id      BIGINT UNSIGNED NOT NULL,
    target_record_id    BIGINT UNSIGNED NOT NULL,
    created_at          DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_relation (field_id, source_record_id, target_record_id),
    KEY idx_source (source_list_id, source_record_id),
    KEY idx_target (target_list_id, target_record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial de cambios de slug (auditoría y soporte de redirects)
CREATE TABLE wp_imcrm_slug_history (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_type     VARCHAR(16)     NOT NULL,         -- 'list' | 'field'
    entity_id       BIGINT UNSIGNED NOT NULL,
    old_slug        VARCHAR(64)     NOT NULL,
    new_slug        VARCHAR(64)     NOT NULL,
    changed_by      BIGINT UNSIGNED NOT NULL,
    changed_at      DATETIME        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_entity (entity_type, entity_id),
    KEY idx_old_slug (entity_type, old_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.2 Tablas dinámicas (una por lista creada)

Nombre físico: `wp_imcrm_data_{table_suffix}`. **Nunca** se usa el `slug` para nombrar la tabla, porque el slug es editable y MySQL no maneja bien renames frecuentes a tablas con datos en producción. Ver sección 7.

```sql
CREATE TABLE wp_imcrm_data_{table_suffix} (
    id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    -- columnas dinámicas según los campos configurados en wp_imcrm_fields
    -- el nombre de cada columna corresponde al `column_name` (inmutable) del campo
    created_by    BIGINT UNSIGNED  NOT NULL,
    created_at    DATETIME         NOT NULL,
    updated_at    DATETIME         NOT NULL,
    deleted_at    DATETIME         NULL,
    PRIMARY KEY (id),
    KEY idx_deleted (deleted_at),
    KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 7. Manejo de Slugs (CRÍTICO)

Este es uno de los puntos más delicados de la arquitectura. El usuario puede editar slugs de listas y de campos en cualquier momento, pero el sistema debe garantizar **rendimiento, integridad referencial y cero pérdida de datos**.

### 7.1 Doble identidad: slug editable vs. identificador físico inmutable

Cada lista y cada campo tienen **dos identificadores**:

| Concepto             | Listas                          | Campos                          | Editable | Uso                                            |
|----------------------|---------------------------------|---------------------------------|----------|------------------------------------------------|
| ID numérico          | `wp_imcrm_lists.id`             | `wp_imcrm_fields.id`            | No       | Llave primaria, FKs, referencias internas      |
| Slug                 | `wp_imcrm_lists.slug`           | `wp_imcrm_fields.slug`          | **Sí**   | URL amigable, filtros, referencias humanas     |
| Identificador físico | `wp_imcrm_lists.table_suffix`   | `wp_imcrm_fields.column_name`   | **No**   | Nombre real de tabla / columna en MySQL        |

**Razón:** renombrar tablas y columnas en MySQL es operacionalmente caro (lock, posible downtime, riesgo en replicación, hooks/queries cacheados rotos). Los nombres físicos se generan **una sola vez** al crear la entidad y nunca cambian. El usuario puede renombrar el slug todas las veces que quiera sin tocar el schema físico.

### 7.2 Generación del identificador físico

Al crear una **lista**:
1. Se genera `table_suffix` desde el slug inicial: slugify, lowercase, máx 48 chars.
2. Si colisiona con un `table_suffix` existente, se sufija con `_2`, `_3`, etc.
3. Se valida contra lista de palabras reservadas MySQL y nombres de tablas WP nativas.
4. `CREATE TABLE wp_imcrm_data_{table_suffix}`.
5. **Inmutable de aquí en adelante.**

Al crear un **campo**:
1. Se genera `column_name` desde el slug inicial: slugify, lowercase, máx 48 chars.
2. Si colisiona con otro `column_name` en la misma lista, se sufija con `_2`, `_3`, etc.
3. Se valida contra reservados MySQL y contra columnas base (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`).
4. `ALTER TABLE ... ADD COLUMN`.
5. **Inmutable de aquí en adelante.**

### 7.3 Edición de slug

Cuando el usuario cambia un slug:
1. Se valida formato: `^[a-z][a-z0-9_]{0,62}$` (snake_case obligatorio para consistencia API).
2. Se valida unicidad: a nivel global para listas, a nivel de lista para campos.
3. Se valida que no colisione con palabras reservadas del sistema (ver 7.5).
4. Se actualiza `slug` en la tabla del sistema. **No se toca la tabla dinámica.**
5. Se inserta registro en `wp_imcrm_slug_history`.
6. Se invalida cache de `ListRegistry` y `FieldRegistry`.
7. Se devuelve éxito con advertencia si hay automatizaciones, vistas guardadas o webhooks que usaban el slug anterior (ver 7.6).

### 7.4 ¿Por qué no exponer `column_name` al usuario?

Para mantener simplicidad mental: el usuario solo conoce y edita "slugs". Internamente el sistema mantiene la separación. Esto evita confusión del tipo "renombré el campo pero algo se rompió".

Sin embargo, para usuarios técnicos avanzados, en una sección de **settings avanzados de la lista** se puede exponer (read-only) el `table_suffix` y los `column_name` para que sean visibles si necesitan hacer queries SQL directas o exportar el schema.

### 7.5 Reglas de validación de slugs

**Formato:**
- Regex: `^[a-z][a-z0-9_]{0,62}$`
- Mínimo 1 char, máximo 63 chars (compatibilidad MySQL).
- Snake_case. Sin guiones, sin espacios, sin acentos, sin mayúsculas.
- Slugify automático en frontend desde el `label` con preview en vivo.

**Reservados (bloqueados):**
- Slugs reservados de listas: `lists`, `fields`, `views`, `records`, `comments`, `activity`, `relations`, `automations`, `settings`, `me`, `admin`, `system`, `api`, `auth`, `licensing`, `slug-history`, `field-types`, `import`, `export`, `webhook`, `webhooks`.
- Slugs reservados de campos: `id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, más palabras reservadas MySQL (`select`, `insert`, `update`, `delete`, `from`, `where`, `order`, `group`, `index`, `key`, `primary`, etc. — lista completa en `SlugManager::MYSQL_RESERVED`).

**Unicidad:**
- Slug de lista: único globalmente (todas las listas de la instancia).
- Slug de campo: único dentro de la misma lista.
- La unicidad se verifica con `UNIQUE INDEX` en MySQL **además** de validación a nivel app.

### 7.6 Impacto del rename en otras entidades

Cuando un slug cambia, las siguientes entidades **se actualizan automáticamente** sin acción del usuario, porque referencian internamente por `id`:

- `wp_imcrm_saved_views.config` → guarda IDs, no slugs
- `wp_imcrm_fields` (relaciones entre campos vía `config`) → guarda IDs
- Filtros, sort y campos visibles → guardados por ID
- Automatizaciones (Fase 2) → guardadas por ID

Las siguientes referencias **pueden quedar obsoletas** y el sistema debe avisar al usuario al renombrar:

- **URLs externas** que apunten a la lista/campo (ej. `/wp-admin/admin.php?page=imagina-crm#/records/clientes`).
- **Webhooks externos** que reciban payloads con el slug antiguo.
- **Llamadas API externas** desde sistemas de terceros usando el slug.
- **Documentación interna del usuario** que mencione el slug antiguo.

**Mitigación: redirects automáticos por slug histórico.**

Cuando el frontend o REST recibe una request con un slug antiguo, el `SlugManager` consulta `wp_imcrm_slug_history`:

- Si el slug viejo se redirige a uno nuevo único: el sistema responde con HTTP 301 (en URLs) o resuelve transparentemente al ID correcto (en REST), e incluye un header `X-Imagina-CRM-Slug-Renamed: old=clientes,new=clientes_anuales`.
- Si hay ambigüedad (el slug viejo se reusó después): se responde 409 Conflict con explicación.

Los redirects de historial pueden purgarse desde settings.

### 7.7 SlugManager — responsabilidades

```php
final class SlugManager {
    public function validateFormat(string $slug): ValidationResult;
    public function isReserved(string $slug, SlugContext $context): bool;
    public function generateUnique(string $base, SlugContext $context, ?int $listId = null): string;
    public function rename(SlugContext $context, int $entityId, string $newSlug): RenameResult;
    public function resolveCurrentSlug(SlugContext $context, string $maybeOldSlug, ?int $listId = null): ?string;
    public function getHistory(SlugContext $context, int $entityId): array;
}
```

### 7.8 UI de edición de slug

Componente `<SlugEditor>` reutilizable en List Builder y Field Builder:

- Input con prefijo visual indicativo (ej. `clientes/` para lista, `field:` para campo).
- Slugify automático en vivo desde el `label` mientras el campo no se haya editado manualmente.
- Validación inline:
  - Formato (regex)
  - Reservados
  - Unicidad (debounced API call a `GET /imagina-crm/v1/slugs/check?type=list&slug=foo`)
- Si el usuario edita un slug **existente** (no creación), se muestra advertencia clara:
  > *"Cambiar este slug no afectará tus datos ni tus filtros guardados. Sin embargo, URLs externas, webhooks o integraciones que usen el slug actual deberán actualizarse. Imagina CRM mantendrá redirects automáticos del slug anterior."*
- Botón secundario "Ver historial de slugs" que muestra modal con cambios anteriores.

### 7.9 Reglas de oro (resumen)

1. **El slug es una etiqueta humana editable. El ID es la verdad.**
2. **El nombre físico de tabla y columna se decide una vez y nunca cambia.**
3. **Renombrar slug nunca altera schema físico.**
4. **Toda referencia interna entre tablas del sistema usa IDs.**
5. **Los slugs históricos quedan registrados para resolver redirects.**
6. **La validación de slugs es idéntica en frontend (UX) y backend (seguridad).**

---

## 8. Tipos de Campo (MVP Fase 1)

Cada tipo implementa `FieldTypeInterface`:

```php
interface FieldTypeInterface {
    public function getSlug(): string;
    public function getLabel(): string;
    public function getSqlDefinition(array $config): string;
    public function validate(mixed $value, array $config): ValidationResult;
    public function serialize(mixed $value, array $config): mixed;
    public function unserialize(mixed $value, array $config): mixed;
    public function getConfigSchema(): array;
}
```

**Tipos en MVP:**

| Slug           | SQL                        | Notas                                          |
|----------------|----------------------------|------------------------------------------------|
| `text`         | `VARCHAR(255)`             | `max_length` configurable (≤255)               |
| `long_text`    | `TEXT`                     | Rich text opcional (Fase 2)                    |
| `number`       | `DECIMAL(18,4)` o `BIGINT` | `precision` configurable                       |
| `currency`     | `DECIMAL(18,4)`            | guarda moneda en config, no por fila           |
| `select`       | `VARCHAR(64)`              | options en config, columna indexada            |
| `multi_select` | `JSON`                     | array de strings                               |
| `date`         | `DATE`                     | indexada si es campo primario de orden         |
| `datetime`     | `DATETIME`                 | siempre en UTC                                 |
| `checkbox`     | `TINYINT(1)`               | 0 / 1                                          |
| `url`          | `VARCHAR(2048)`            |                                                |
| `email`        | `VARCHAR(191)`             | opcional `is_unique` → índice único            |
| `user`         | `BIGINT UNSIGNED`          | FK lógica a `wp_users.ID`                      |
| `relation`     | sin columna                | se guarda en `wp_imcrm_relations`              |
| `file`         | `BIGINT UNSIGNED`          | FK lógica a `wp_posts.ID` (attachment)         |

**Validación:** doble capa. Backend (PHP) valida siempre. Frontend valida con Zod schemas generados desde la config de cada campo para UX.

---

## 9. API REST

**Namespace:** `imagina-crm/v1`
**Autenticación:** cookies WP + `X-WP-Nonce` (wp_rest). Sin API keys en Fase 1.
**Capability base:** `manage_options` (configurable en Fase 2).
**Formato errores:** JSON con `{code, message, data: {status, errors?}}`.

### 9.1 Resolución de identificadores en URLs

Las URLs REST aceptan **tanto ID como slug** para listas y campos:

- `GET /imagina-crm/v1/lists/42` → por ID
- `GET /imagina-crm/v1/lists/clientes_anuales` → por slug actual
- `GET /imagina-crm/v1/lists/clientes` (slug viejo) → resuelve vía `slug_history` y devuelve con header `X-Imagina-CRM-Slug-Renamed`

Internamente, una vez resuelto, todo el código trabaja con el ID. Los slugs son solo entrada/salida.

### 9.2 Endpoints

```
# Lists
GET    /imagina-crm/v1/lists
POST   /imagina-crm/v1/lists
GET    /imagina-crm/v1/lists/{id_or_slug}
PATCH  /imagina-crm/v1/lists/{id_or_slug}                  # incluye cambio de slug
DELETE /imagina-crm/v1/lists/{id_or_slug}

# Fields
GET    /imagina-crm/v1/lists/{list}/fields
POST   /imagina-crm/v1/lists/{list}/fields
PATCH  /imagina-crm/v1/lists/{list}/fields/{id_or_slug}    # incluye cambio de slug
DELETE /imagina-crm/v1/lists/{list}/fields/{id_or_slug}
POST   /imagina-crm/v1/lists/{list}/fields/reorder

# Records
GET    /imagina-crm/v1/lists/{list}/records
POST   /imagina-crm/v1/lists/{list}/records
GET    /imagina-crm/v1/lists/{list}/records/{id}
PATCH  /imagina-crm/v1/lists/{list}/records/{id}
DELETE /imagina-crm/v1/lists/{list}/records/{id}
POST   /imagina-crm/v1/lists/{list}/records/bulk

# Saved Views
GET    /imagina-crm/v1/lists/{list}/views
POST   /imagina-crm/v1/lists/{list}/views
PATCH  /imagina-crm/v1/lists/{list}/views/{id}
DELETE /imagina-crm/v1/lists/{list}/views/{id}

# Slugs
GET    /imagina-crm/v1/slugs/check?type=list&slug=foo
GET    /imagina-crm/v1/slugs/check?type=field&list_id=42&slug=bar
GET    /imagina-crm/v1/slugs/history?type=list&entity_id=42

# System
GET    /imagina-crm/v1/field-types
GET    /imagina-crm/v1/me
```

### 9.3 Query params de `/records`

Los filtros aceptan **slug actual del campo** o `field_id`:

```
?page=1
&per_page=50
&sort=due_date:desc,name:asc                  # por slug
&sort=field_15:desc                           # por ID
&filter[status][eq]=vencido                   # por slug
&filter[field_22][gte]=100                    # por ID
&filter[name][contains]=acme
&search=texto
&fields=id,name,status                        # proyección por slug o id
```

Internamente, el `QueryBuilder` siempre resuelve a `column_name` antes de armar SQL. Si un filtro usa un slug que ya no existe, intenta resolver por `slug_history`.

### 9.4 QueryBuilder

- Whitelist estricta de columnas físicas (`column_name`) consultando `wp_imcrm_fields`.
- Resolución de slug → field_id → column_name antes de armar SQL.
- Todos los valores van a `$wpdb->prepare()`.
- Operadores mapeados internamente.
- Máximo 5 filtros anidados por query.

---

## 10. Frontend — Admin SPA

### 10.1 Montaje

WordPress registra una página bajo `admin.php?page=imagina-crm`. El PHP solo renderiza un `<div id="imcrm-root"></div>` y enqueueá el bundle de Vite.

### 10.2 Layout

```
┌─────────────────────────────────────────────────────────┐
│ Topbar: breadcrumb · search · user menu                  │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │   Main outlet (React Router)                 │
│          │                                              │
│ - Lists  │   Ej: /records/:listSlug                     │
│   > Lista│   → RecordsPage → TableView                  │
│   > Lista│                                              │
│          │                                              │
│ - Settings                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

Las URLs del frontend usan **slug actual** (mejor UX). Si el usuario tiene una URL guardada con slug viejo, el resolver del frontend la reescribe con el slug actual usando un guard de ruta que consulta `slug_history`.

### 10.3 Vista Table (único MVP)

- **TanStack Table v8** con virtualización (`@tanstack/react-virtual`).
- **Server-side** de todo: paginación, sort, filtros.
- Edición inline: doble click en celda → input apropiado al tipo → `PATCH` con optimistic update.
- Reordenar columnas (drag con dnd-kit) → persiste en `saved_views.config.visible_fields` (por field_id).
- Resize de columnas persistido por vista.
- Filtros en popover estilo Linear: campo → operador → valor.
- Sort multi-columna (shift+click).
- Selección múltiple + acciones en bulk.
- Fila "sticky" arriba para crear registro rápido.
- Panel lateral (Drawer) al clic en fila: detalle completo del registro.

### 10.4 List Builder

- Ruta: `/lists/new` y `/lists/:id_or_slug/edit`.
- Form de metadatos: name, description, icon picker (Lucide), color, **slug editable con `<SlugEditor>`**.
- Lista de campos con drag-and-drop para reordenar.
- Botón "Add field" → dropdown de tipos → panel de config a la derecha (incluye `<SlugEditor>` para el campo).
- Preview en vivo de cómo se verá la tabla.
- Sección "Configuración avanzada" colapsada con `table_suffix` (read-only) e historial de slugs.

### 10.5 Design tokens (Tailwind config)

Paleta tipo Linear/Vercel — neutrals grises fríos + accent. `tailwind.config.ts` con:
- `primary` (accent de la marca, ej. indigo-600)
- `gray` escala completa neutral
- `success`, `warning`, `danger`, `info`
- Radios: `sm: 4px`, `md: 6px`, `lg: 8px`, `xl: 12px`
- Sombras sutiles tipo shadcn
- Tipografía: Inter, con `-0.01em` letter-spacing
- Prefijo `imcrm-` para todas las clases Tailwind

### 10.6 Accesibilidad

- Todos los componentes interactivos accesibles por teclado.
- `aria-*` correcto (Radix vía shadcn).
- Focus rings visibles.
- Lighthouse Accessibility ≥ 95.

---

## 11. Contratos de Rendimiento

| Métrica                                                   | Objetivo                          |
|-----------------------------------------------------------|-----------------------------------|
| GET /records con 5k filas, paginación 50, 2 filtros       | p95 ≤ 80ms backend                |
| GET /records con 50k filas, paginación 50, 2 filtros      | p95 ≤ 200ms backend               |
| Render inicial de TableView con 50 filas visibles         | TTI ≤ 400ms                       |
| Bundle JS inicial (gzip)                                  | ≤ 250KB                           |
| Scroll en tabla con 5k registros (virtualización)         | 60fps                             |
| Admin de WP sin entrar al plugin                          | impacto ≤ 15ms en TTFB            |
| Resolución de slug → ID (cacheada)                        | ≤ 1ms                             |
| Rename de slug                                            | ≤ 50ms (sin tocar schema físico)  |

**Reglas:**
- No se ejecuta lógica del plugin si la URL actual no es página del plugin o endpoint REST propio.
- `ListRegistry` y `FieldRegistry` con cache `wp_cache_*`, invalidación por hooks internos.
- Resolución de slugs cacheada por request (memoria) y entre requests (object cache).
- Queries N+1 prohibidas.

---

## 12. Seguridad

- **Capability checks** en cada endpoint REST.
- **Nonces** verificados en todas las mutaciones.
- **Prepared statements** siempre.
- **Whitelist de columnas físicas** al recibir filtros/sort.
- **Validación doble de slugs** (regex + reservados + unicidad) en backend, igual en frontend.
- **Escape de identificadores** en `SchemaManager`: solo se usan `table_suffix` y `column_name` que ya pasaron por `SlugManager` y se sanitizan adicionalmente con `esc_sql()` y backticks.
- **Rate limit en rename de slugs**: máximo 10 renames de la misma entidad por hora (anti-abuse).
- **XSS:** todo output en React escapado. Shell PHP usa `esc_html`, `esc_attr`, `esc_url`.
- **CSRF:** cubierto por nonces.
- **File uploads:** se delega a `wp_handle_upload`.

---

## 13. Internacionalización

- Text domain: `imagina-crm`.
- Strings PHP con `__()`, `_e()`, `_n()`, `_x()`.
- Strings React: `app/i18n/en.json`, `app/i18n/es.json`.
- Formatos respetan `get_locale()` y `wp_timezone()`.
- Backend siempre UTC; frontend convierte.
- Idiomas iniciales: **es_ES, es_CO, en_US**.

---

## 14. Licenciamiento y Updates

- **LicenseManager:** valida contra `https://licenses.imaginawp.com/v1/validate`.
- **Estados:** `valid`, `expired`, `invalid`, `site_limit_reached`.
- **Grace period:** 7 días.
- **UpdaterClient:** `releases.imaginawp.com`.
- **Activaciones por licencia:** configurable.
- **Nunca** bloquear datos del usuario por licencia — solo updates y soporte.

---

## 15. Roadmap por Fases

### Fase 1 — MVP Comercializable · 8-10 semanas
- Core arquitectura (Plugin, Container, Installer, REST, tooling)
- Lists CRUD con `SlugManager` + `SchemaManager`
- Fields CRUD con 14 tipos, slugs editables, column_name inmutable
- Records CRUD con QueryBuilder (filtros, sort, paginación, search)
- Vista Table pulida con TanStack Table
- Saved Views (solo `table` en MVP)
- Admin shell completo: sidebar, topbar, routing
- List builder + Field builder con `<SlugEditor>`
- Slug history y redirects
- Licensing + Updater
- i18n (es_ES, es_CO, en_US)
- Tests
- Docs usuario en español

### Fase 2 — Automatizaciones (4-6 semanas)
- Trigger registry: `record_created`, `record_updated`, `field_changed`, `due_date_reached`, `scheduled`
- Action registry: `send_email` con templates y merge tags, `call_webhook`, `update_field`, `create_record`
- Builder visual tipo Zapier (nodos + conectores con React Flow)
- Motor con Action Scheduler
- Log de ejecuciones con retries

### Fase 3 — Comentarios + Activity (2 semanas)
- Panel lateral por registro con tabs Comments/Activity
- Menciones @usuario con notificaciones
- Activity log detallado con diffs

### Fase 4 — Vista Kanban + Calendar (3 semanas)

### Fase 5 — Dashboards (3 semanas)

### Fase 6 — Cards + Extras (2 semanas)

### Fase 7 — Módulo de Facturación propio (fase futura, doc separado)

---

## 16. Estándares de Código

### PHP
- `declare(strict_types=1);` en todos los archivos.
- Namespaces PSR-4 bajo `ImaginaCRM\`.
- Tipos explícitos en parámetros y returns.
- No `global $wpdb` — inyección vía Container.
- Constantes en `ImaginaCRM\Plugin::class`: `VERSION`, `DIR`, `URL`, `TEXT_DOMAIN`, `DB_VERSION`.
- PHPStan nivel 8, PHPCS WordPress-Extra.
- `PascalCase` clases, `camelCase` métodos, `SCREAMING_SNAKE` constantes.

### TypeScript / React
- `strict: true`, `noUncheckedIndexedAccess: true`.
- No `any` salvo justificado.
- `PascalCase.tsx` componentes, `useCamelCase.ts` hooks.
- Un componente por archivo.
- TanStack Query para server state, Zustand o `useState` para client state.
- React Hook Form + Zod siempre.

### Commits
- Conventional commits.

### Tests
- PHPUnit ≥ 70% en Services y Repositories.
- Vitest ≥ 60% en hooks y componentes con lógica.
- E2E con Playwright en Fase 2+.

---

## 17. Definition of Done — Fase 1

1. Usuario puede crear una lista, agregar/editar/eliminar campos, y crear registros.
2. **Slugs de listas y campos son editables en cualquier momento, con validación, redirects históricos y sin pérdida de datos.**
3. Vista Table soporta paginación, filtros, sort multi-columna, edición inline, selección múltiple, bulk actions.
4. Saved Views funcionan (referencias internas por ID, no por slug).
5. Los 14 tipos de campo del MVP implementados.
6. 5000 registros de prueba cargan y filtran dentro de los contratos de rendimiento.
7. Licencia y updates funcionan contra servidor propio.
8. UI ≥ 1024px, accesibilidad Lighthouse ≥ 95.
9. Docs de usuario en español publicadas (incluyendo sección "Editar slugs y URLs").
10. i18n completo es_ES, es_CO, en_US.
11. Zero warnings/errors en PHPStan 8 y ESLint.
12. Tests pasando.
13. Instalación / activación / desinstalación limpia.

---

## 18. Decisiones de Arquitectura clave (ADRs)

**ADR-001 — Schema físico dinámico, no EAV.**
Cada lista = tabla MySQL propia.

**ADR-002 — Tailwind con prefijo `imcrm-`.**
Evita colisiones con WP y otros plugins.

**ADR-003 — Vite en lugar de wp-scripts.**
HMR moderno, build rápido, ecosistema TS/React first-class.

**ADR-004 — REST propio en namespace `imagina-crm/v1`.**
Control total de shapes, errores, paginación.

**ADR-005 — Sin integración con Perfex CRM en MVP.**
Reduce dependencias. Módulo de facturación propio en fase futura.

**ADR-006 — Una sola Vista (Table) en MVP.**
Arquitectura preparada para múltiples vistas vía `saved_views.type`.

**ADR-007 — Licensing no bloquea datos.**
Cliente conserva sus datos aunque deje de pagar.

**ADR-008 — Slugs editables con identidad física inmutable.**
`slug` editable + `table_suffix`/`column_name` inmutables. Toda referencia interna por ID. Renames del slug nunca tocan schema físico. Historial de slugs en `wp_imcrm_slug_history` para resolver redirects.

**ADR-009 — Nombre del plugin "Imagina CRM".**
"CRM" funciona como caso de uso ancla, pero el producto es genérico para listas/registros con automatizaciones. Nombre escalable a futuras verticales.

---

## 19. Cómo trabajar con Claude Code en este repo

1. Lee **siempre** este CLAUDE.md antes de cualquier tarea.
2. Respeta namespaces, DI, Service/Repository, prepared statements.
3. TypeScript: nunca `any`; data fetching con TanStack Query; UI con shadcn existente antes de crear nuevos componentes.
4. **Schema:** siempre vía `SchemaManager`. Slugs siempre vía `SlugManager`. Nunca SQL DDL directo fuera de esas clases.
5. **Identidad:** referencias internas siempre por ID. Slugs solo para entrada/salida.
6. Cada feature: tipos TS, validación Zod, validación PHP, test backend, test frontend.
7. Performance: si una feature toca contratos de rendimiento, incluir benchmark en el PR.
8. Antes de implementar algo no listado en este doc, proponerlo y actualizar el CLAUDE.md.

---

**Última actualización:** 2026-04-25
**Versión del documento:** 0.2.0 (Fase 1 — rebrand a Imagina CRM + slugs editables)
