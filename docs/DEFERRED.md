# Deuda técnica diferida — Production Readiness

Items del reporte de auditoría (Fase 15 cierre) que NO se cerraron en
Fase 16. Documentados acá para que el siguiente desarrollador pueda
retomarlos con contexto suficiente.

Última actualización: 2026-05-23 — al cierre de Fase 16.

---

## 🟡 Performance — diferidos

### 1. Virtualización de TableView (bug perf P4)

**Severidad**: media. Aplica solo cuando el user setea `per_page > 200`
en una lista activa. El default es 200 y los EditableCell ya están
memoizados (Fase 16.D), así que renders típicos andan bien.

**Lo que falta**:
- Integrar `@tanstack/react-virtual` (ya está en `package.json`).
- Refactorizar `<table>` HTML a divs con `position: absolute` para
  cada row, porque tables HTML no permiten skip-rendering rows
  fuera del viewport.
- Mantener compatibility con: column resize (`columnSizing`), drag
  & drop de columnas (`columnOrder`), header sticky, selected row
  highlighting, edit mode (EditableCell pop-up).
- Tests de scroll smoothness con 5k records.

**Estimación**: 2-3 días de trabajo enfocado. Bottleneck principal
es mantener todas las features actuales sin regresiones.

**Workaround actual**: el plugin pagina por defecto a 200 records.
Para listas >>5000, recomendar al user mantener `per_page=200` o
menos (la UI no expone selector de per_page, así que ya está
acotado).

---

### 2. Export síncrono → Action Scheduler — ✅ CERRADO en 0.47.0

Fase 17.A. Cuando `total > 5000` records el cliente automáticamente
pasa `?async=1` y el backend devuelve 202 con `job_id`. Worker
en Action Scheduler procesa, escribe el archivo en
`uploads/imagina-crm/exports/`, frontend polea cada 2s hasta
`ready` y dispara download via URL firmada (HMAC + TTL 24h).

Cleanup diario `imagina_crm/export_jobs_cleanup` borra jobs > 7d.

---

### 3. Bulk update con valores uniformes (perf — postergado de 16.B)

**Severidad**: media. Bulk delete ya está optimizado (16.B).
Bulk update con MISMOS values (caso común: "selecciono 100 records
y les cambio status=cerrado") sigue ejecutando N updates secuenciales.

**Lo que falta**:
- `RecordRepository::bulkUpdate($tableSuffix, $ids, $values): int`.
- `RecordService::bulk('update', ...)` fast path que valide $values
  una sola vez y haga single UPDATE WHERE id IN.
- Dispatch del hook `imagina_crm/record_updated` por cada ID (igual
  patrón que bulk delete).
- **Cuidado**: el snapshot pre-update lo usan los triggers
  `field_changed` de Automations. Hay que hacer un SELECT bulk
  pre-update para obtener todos los snapshots antes del UPDATE.

**Estimación**: 1-2 días.

---

### 4. `Plugin::register()` se ejecuta en TODA request admin (perf M4)

**Severidad**: media. El plugin instancia services y registra hooks
en cada request de wp-admin, no solo páginas del plugin. El CLAUDE.md
§11 dice "Admin de WP sin entrar al plugin → impacto ≤ 15ms en TTFB".
Probablemente excede el budget pero **no medido**.

**Lo que falta**:
- Diferir registración de hooks no-críticos (SearchHooks, RestBootstrap
  controller binds, listeners de record_*/comment_*/automation_*)
  hasta `current_screen` confirmar página del plugin O `rest_api_init`
  confirmar request REST propio del plugin.
- Instrumentar TTFB con `microtime(true)` en distintos puntos del
  bootstrap para validar el budget.

**Estimación**: 1 día (research + refactor).

---

## 🟡 Frontend — diferidos

### 5. Fetch waterfall list → fields → records (perf M3)

**Severidad**: baja. Agrega ~150-300ms al first paint del RecordsPage.

**Lo que falta**:
- Endpoint `GET /lists/{slug}/bootstrap` que collapse list + fields
  + recordsFirstPage en una sola respuesta.
- Wireup en RecordsPage para usar el endpoint.

**Estimación**: 1 día.

---

### 6. `CardsView` usa background-image sin lazy-loading nativo (perf M6)

**Severidad**: baja. Solo aplica cuando hay 500+ cards visibles con
cover image.

**Lo que falta**:
- Cambiar `<div style="background-image: url(...)" />` a
  `<img src="..." loading="lazy" decoding="async" />`.
- Verificar que el `object-fit: cover` produce el mismo layout
  visual.

**Estimación**: 30 min.

---

## 🔴 Cleanup técnico preexistente (no introducido en Fase 12-16)

### 7. PHPStan 2.x upgrade

Actualmente PHPStan 1.x. Reportaría más warnings con tipos más
estrictos. Migration guide:
<https://github.com/phpstan/phpstan/blob/2.1.x/UPGRADING.md>.

**Estimación**: 1-2 días (incluyendo fix de warnings nuevos).

### 8. Tests integration con WP real

`bin/install-wp-tests.sh` existe pero la suite real requeriría DB
+ WP install. Útil para validar shapes de response cross-version
y hubiera atrapado el bug 0.40.4 (CustomRolesCard pantalla en blanco).

**Estimación**: 2-3 días (setup CI + escribir suite mínima).

### 9. Auditoría de 379 PHPCS violations

La mayoría son `WordPress.DB.PreparedSQL.NotPrepared` false positives
(verificado en auditoría de Fase 15). Pero hay ~30-50 violations
reales (Generic.ControlStructures.InlineControlStructure, etc.).
No críticas; útil de pasar por phpcbf en algún momento.

**Estimación**: 1-2 días.

### 10. XLSX export nativo

CSV cubre el 90% del caso "abrir en Excel" pero algunos clientes
piden XLSX. Requiere lib pesada (`phpoffice/phpspreadsheet` ~5MB)
o implementación manual de Office Open XML (zip + xml — ~500 líneas
mínimas).

**Estimación**: 3-5 días si manual; 1 día si PhpSpreadsheet (pero
+5MB en el plugin).

---

## Items cerrados en Fase 16

Para referencia, lo que SÍ se cerró:

- ✅ **S1-S4**: per-field permissions bypass en Export / Portal /
  Aggregates / Activity / Groups (Fase 16.A).
- ✅ **S5**: XSS en markdown URL handler (Fase 16.A).
- ✅ **P1**: N+1 en bulk delete (Fase 16.B).
- ✅ **P2**: BM25 subquery correlacionada (Fase 16.C).
- ✅ **M1**: staleTime en 9 hooks TanStack Query (Fase 16.D).
- ✅ **M2**: React.memo en EditableCell (Fase 16.D).
- ✅ **Bundle size**: lazy-load views alternativas (Fase 16.D),
  235 KB gzip inicial bajo el contrato CLAUDE.md §11.
- 🟡 **S6**: rate-limit XFF — en progreso (Fase 16.F).

---

## Cómo retomar esta lista

1. Elegir un item del 1-10 según prioridad para el use case del
   cliente actual.
2. Abrir un branch nuevo `claude/session-deferred-<n>-<slug>`.
3. Implementar + tests + bench si toca contratos perf.
4. PR a main + actualizar este archivo (mover el item a "cerrados").
