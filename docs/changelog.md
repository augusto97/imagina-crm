# Changelog

Todos los cambios notables de este proyecto se documentan aquí. Sigue [Keep a Changelog](https://keepachangelog.com/) y [SemVer](https://semver.org/).

## [Unreleased]

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
