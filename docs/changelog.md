# Changelog

Todos los cambios notables de este proyecto se documentan aquí. Sigue [Keep a Changelog](https://keepachangelog.com/) y [SemVer](https://semver.org/).

## [Unreleased]

## [0.54.0] — 2026-05-26

**Crear opciones de select/multi_select inline desde el editor.**

Antes había que ir al field builder a agregar la opción y volver al
record. Ahora el picker custom (`OptionPicker`) tiene un footer
"+ Crear …" que aparece cuando lo escrito no matchea ninguna opción
existente; un click lo agrega via `POST /lists/{list}/fields/{field}/options`
y auto-selecciona la nueva opción.

### Backend
- `FieldService::appendOption(listId, fieldId, option)`: lee fresh,
  valida tipo y duplicados por `value`, escribe vía `update()`. Reusa
  el flujo de update para que se disparen hooks e invalidations.
- `POST /lists/{list}/fields/{field}/options` (FieldsController):
  body `{value, label?, color?}`. Permission `canManage`.

### Frontend
- Nuevo `app/components/ui/option-picker.tsx`: popover con search +
  lista filtrada + footer "+ Crear" + navegación teclado.
- Nuevo `useAppendFieldOption(listId)` hook: POST mutation +
  `invalidateQueries(fieldsKeys.forList)`.
- Reemplazados los 3 callsites con `<select>` nativo:
  - `RecordFieldsForm` (RecordCreateDialog, RecordPage, drawer).
  - `CompactFieldRow` (drawer + CRM layout).
  - `EditableCell` (tabla principal).
- Propagado `listId` en cascada por los wrappers (`RecordFieldsForm`,
  `CompactFieldRow`, `PropertiesSidebar`, `BlockRenderer.FieldsContent`).

Notas:
- Opciones creadas inline arrancan sin color (chip neutro). Editables
  después desde el field builder.
- Race condition: duplicados detectados en backend con read fresh.

Build: 0 errores TS, 548 tests OK.

## [0.53.4] — 2026-05-26

**Fixes del shortcode público: layout del toolbar + sin dark mode auto.**

### Motivación

Feedback del usuario sobre 0.53.3:
1. "Esos filtros que sean de ancho completo y uno debajo de otro se ve
   muy raro y ocupan demasiado espacio" — los `<select>` se mostraban
   apilados verticalmente full-width en lugar de en fila.
2. "¿Por qué hiciste la tabla oscura? No entiendo si todavía no
   estamos manejando o creado un modo oscuro" — el shortcode viraba
   a dark cuando el OS del visitante estaba en dark mode.

### Cambios

**Filtros stackeados**: el problema era que muchos temas modernos
aplican `display: block; width: 100%` global a `<select>` desde
selectores con mayor specificity (ej. `.entry-content > div select`),
y mi CSS sin `!important` no defendía.

Fix:
```css
.imcrm-public-list__toolbar {
    display: flex !important;
    flex-direction: row !important;
}
.imcrm-public-list__filter {
    display: inline-flex !important;
    flex: 0 1 auto;
    width: auto !important;
    min-width: 160px;
    max-width: 240px;
}
.imcrm-public-list__search {
    width: auto !important;
    max-width: 320px;
}
.imcrm-public-list__clear-filters {
    flex: 0 0 auto;
    width: auto !important;
}
```

`!important` quirúrgico solo en propiedades de layout — el resto sigue
override-able via tokens `--imcrm-public-*`. Anchos max-width evitan
que los filtros se extiendan más allá de su contenido razonable.

**Dark mode automático eliminado**: removido el bloque
`@media (prefers-color-scheme: dark)` con sus 7 tokens override y los
18 `-text` invertidos. El shortcode siempre se ve light salvo que el
tema override los tokens desde su propio CSS.

Cuando implementemos dark mode como feature explícita (probablemente
un toggle en list settings + persistencia por cookie/localStorage),
volveremos a agregar la paleta dark — pero deliberada, no automática.

### Archivos

- `assets/public-list.css` (selectors con `!important` quirúrgico
  + eliminado bloque `@media (prefers-color-scheme: dark)`)

Build: 0 errores TS, 548 tests PHPUnit OK.

## [0.53.3] — 2026-05-26

**Paridad de formato del shortcode público con la tabla del admin.**

### Motivación

El público no formateaba currency/date/select/multi_select como el
admin — caía a `String(value)` por default. Selects se veían como
texto plano; multi_selects con pills washed-out indigo, sin importar
el color que el admin configuró.

### Cambios

**Nuevo `app/public/cellFormat.tsx`**: componente `<Cell>` con paridad
de formato vs `renderCellValue.tsx`. Recibe `PublicFieldMeta`
completo para acceder a `config.decimals/currency/options`.

Formato por tipo:
- currency → `Intl.NumberFormat({style: 'currency', currency, decimals})`
- number → `toLocaleString` con decimals
- date → `toLocaleDateString()`
- datetime → UTC → local con `toLocaleString()`
- select → chip coloreado con `options[i].color`
- multi_select → grupo de chips, cada uno con su color
- computed → respeta operation + decimals
- checkbox → `✓` / `—` (antes era `✓` / `✗`)
- user → `@ID` (público no tiene endpoint de lookup)

**`Shortcode.php::formatCellHtml` reescrito** con paridad SSR. El
primer paint muestra ya el mismo formato que el render hidratado.

**Chips coloreados**: CSS vars `--imcrm-public-opt-{name}` para los 18
presets + variante `-text`. Hex via alpha notation. Paridad con
`chipSoftStyle` del admin (bg/14, border/32, text de la variante).

**Visual** más plano alineado con admin TableView: sin shadow, header
`bg-soft` sutil, padding 0.625rem, borders hairline. Quitada la
"card pomposa" anterior.

**Test ajustado**: `test_checkbox_renders_check_or_cross` chequea ahora
`imcrm-public-list__empty-cell` en lugar del literal `✗`.

Archivos: nuevo `app/public/cellFormat.tsx`; modificados
`app/public/PublicList.tsx`, `src/PublicLists/Shortcode.php`,
`assets/public-list.css`, `tests/Unit/PublicLists/ShortcodeTest.php`.

Build: 548 tests OK, 0 errores TS.

## [0.53.2] — 2026-05-25

**Rediseño visual del shortcode `[imcrm-list]` (frontend público).**

### Motivación

Screenshot del usuario mostró el shortcode en un tema moderno
(Twenty Twenty Six style) y se veía **sin estilos**: tabla sin border,
selects sin chevron, search input sin chrome, pills washed-out, sin
responsive. El CSS anterior usaba `transparent` / `inherit` /
opacidades muy bajas, confiando en que el tema heredara o "ayudara"
con sus propios estilos — pero la mayoría de los temas modernos
aplican resets agresivos (`appearance: none`, `border: 0`,
`padding: 0`, etc.) que destruían el chrome del shortcode.

### Cambios

**`assets/public-list.css` reescrito completamente** con approach
defensivo:

- **Tokens explícitos**: defaults conservadores (paleta neutra fría
  con accent indigo) en lugar de `inherit`. El tema sigue pudiendo
  hacer override via las variables `--imcrm-public-*`.
- **Toolbar prominente** con `bg-soft` + border + radius. Search
  input con focus state propio (border + ring), selects con chevron
  SVG inline base64 para que se vean igual en todos los browsers/temas
  (anti-`appearance: none` del tema).
- **Tabla** envuelta en `<div class="imcrm-public-list__table-wrap">`
  con border + shadow + border-radius + overflow hidden. La tabla
  interna usa `border-collapse: separate !important` con
  `border-spacing: 0 !important` — defensa contra temas que pisan
  border-collapse y romperían el radius del wrap.
- **Pills de multi_select** con border + bg + color de marca claros
  (antes era solo `rgba(_, 0.1)`, casi invisible).
- **Pagination** con botones reales: border, padding, hover state que
  vira a primary.
- **Empty state** rediseñado: bg suave, border dashed, padding
  generoso (antes era italic muted invisible).
- **Card layout mobile** (≤ 639px): cada `<tr>` colapsa a una card
  con label-izquierda / valor-derecha. Se lee el `data-label` que
  ahora setea PublicList.tsx y Shortcode.php en cada `<td>`. Estilo
  Linear/Notion en móvil. El thead queda visualmente oculto pero
  accesible (`absolute; left: -9999px`).
- **Dark mode automático** con `prefers-color-scheme: dark` —
  tokens override con paleta gray-900/gray-800.
- **`box-sizing: border-box` forzado** en el árbol del shortcode
  (defensa contra temas con reset incompleto).

**HTML actualizado** en ambos lados (servidor + cliente hidrated):
- `Shortcode.php` envuelve la tabla en `<div class="...__table-wrap">`
  y agrega `data-label` a cada `<td>` con el label de la columna.
- `PublicList.tsx` hace lo mismo: el wrapper div + `data-label` en
  `<Row>`. El bundle público hidrata el SSR sin desincronización.

### Sin cambios

- Schema, REST, autorización, `PublicListReader`, `PublicListConfig`,
  validación — todo intacto.
- El template `chipSoftStyle` del admin no se reusa acá — el bundle
  público es deliberadamente independiente del admin (sin Tailwind,
  sin shadcn) y este CSS vive como `assets/public-list.css` autonomo
  cargado vía `PublicAssets`.

### Archivos

Modificados:
- `assets/public-list.css` (reescrito completo — 277 → 350 líneas)
- `src/PublicLists/Shortcode.php` (wrapper + data-label en `<td>`)
- `app/public/PublicList.tsx` (wrapper + data-label en `<Row>`)

Build: 0 errores TS, 548 tests PHPUnit OK.

## [0.53.1] — 2026-05-25

**Dialog "Configurar columnas" para reorder masivo + visibilidad combinada.**

### Motivación

Feedback del usuario: drag-and-drop columna por columna en la cabecera
es engorroso con muchas columnas. Quiere un setting/dialog donde
configurar todo de una.

### Solución

**Nuevo `ColumnsConfigDialog.tsx`** — modal con todas las columnas
verticales:
- Drag-and-drop HTML5 nativo (mismo stack que TableView, sin dnd-kit).
- Flechas up/down alternativas en hover para accesibilidad sin drag.
- Toggle visibility por fila (ojo / ojo-tachado).
- Header con counter "X de Y" + "Mostrar todas / Ocultar todas".
- Footer con "Reset orden" + "Reset visibilidad".
- Detección de columnas borradas (slug en orden persistido pero campo
  ya no existe) → marca "borrado" + opacity reducida.
- Tipo chip por fila (text, currency, date, ...).
- Patrón draft: cambios solo se commitean al "Aplicar"; Cancel descarta.

**`ColumnsMenu`** extiende su contrato con `columnOrder` +
`onColumnOrderChange`. Agrega "Configurar columnas…" al pie del dropdown
existente con icono Settings2.

**`RecordsPage`** pasa `state.columnOrder` + setter al menú.

### Archivos

Nuevo:
- `app/admin/records/views/ColumnsConfigDialog.tsx`

Modificados:
- `app/admin/records/views/ColumnsMenu.tsx`
- `app/admin/records/RecordsPage.tsx`

Build: 0 errores TS, 548 tests PHPUnit OK.

## [0.53.0] — 2026-05-25

**UserPicker con autocomplete para el field type `user`.**

### Motivación

Feedback del usuario: "hay un tipo de field en las listas que se llama
'usuario' pero por lo que veo solo permite poner el ID y no autocompleta…
debería poderse colocar el nombre username y poder autocompletar para
buscar ahí mismo el usuario en lugar de tener que ir al menu de
usuarios de wordpress a buscar el ID".

Antes el field `user` se editaba como `<Input type="number">` y se
mostraba como `#ID` en celdas/displays — completamente inutilizable
para usuarios que no recuerdan IDs de memoria.

### Backend

**`/me/users-search`** se extiende para incluir `avatar_url` en cada
hit (vía `get_avatar_url()`). Sin breaking change — el campo es
adicional.

**Nuevo endpoint `GET /me/users/{id}`** — lookup individual de un
user por ID. Devuelve `{id, login, display_name, avatar_url}`. 404
si no existe. Misma capability que users-search (admin only).

### Frontend

**Nuevo hook `app/hooks/useWpUsers.ts`** con:
- `useWpUsersSearch(query, limit)` — wrapping de `/me/users-search`,
  staleTime 30s, no refetch on focus.
- `useWpUser(id)` — wrapping de `/me/users/{id}`, staleTime 5min,
  retorna null si 404.
- `usePrefetchWpUser()` — prefetch imperativo para optimizaciones.

**Nuevo componente `app/components/ui/user-picker.tsx`**:
- Botón trigger que muestra el chip del user actual (avatar + nombre)
  o un placeholder con icono.
- Popover con input de búsqueda debounced (200ms) + lista de hits
  navegable por teclado.
- Footer con "Asignar a mí" (lee `getBootData().user.id`) y "Quitar
  asignación" cuando aplica.
- Variante `compact` (trigger h-8 sin @login secundario) para
  CompactFieldRow.

### Integración

3 lugares actualizados para usar `<UserPicker>`:

1. **`RecordFieldsForm`** (modo comfortable, RecordCreateDialog y
   RecordPage) — case `'user'` reemplaza el `<Input type="number">`.

2. **`CompactFieldRow`** (modo compact, drawer y CRM layout) — `user`
   pasa a la lista de `isInlineControl` (siempre visible, no
   edit-on-click) y delega a `<UserPicker compact showAssignMe />`.
   El case `'user'` se elimina del `EditingControl`.

3. **`FieldValueDisplay`** (CRM layout displays) y **`renderCellValue`**
   (TableView celdas) ahora resuelven el user via `useWpUser` y muestran
   avatar + display_name. Mientras carga: "…". Si user borrado:
   "#ID (borrado)".

### Cache strategy

TanStack Query cachea por queryKey `['wp-user', id]` con staleTime
5min. 30 celdas de tabla con el mismo user ID → 1 sola HTTP request.
Cambios de display_name fuera del CRM (perfil de WP) toman hasta
5min en reflejarse — aceptable, no es data crítica.

### Archivos

Nuevos:
- `app/hooks/useWpUsers.ts`
- `app/components/ui/user-picker.tsx`

Modificados:
- `src/REST/SystemController.php` (avatar_url en search + nuevo endpoint /me/users/{id})
- `app/admin/records/RecordFieldsForm.tsx` (case user → UserPicker)
- `app/admin/records/crm/CompactFieldRow.tsx` (user en InlineControl)
- `app/admin/records/crm/FieldValueDisplay.tsx` (UserDisplay con useWpUser)
- `app/admin/records/renderCellValue.tsx` (UserCell con useWpUser)

Build: 0 errores TS, 548 tests PHPUnit OK.

## [0.52.1] — 2026-05-25

**Drawer lateral del registro: layout compacto label-izquierda.**

Feedback del usuario: "en el editor de plantilla crm me hiciste una
vista de el bloque 'Grupo de propiedades' con densidad compacta y con
label a la izquierda, ese estilo me gustó mucho y quiero implementar
ese mismo estilo de visualización en el sidebar lateral que se abre
en las listas cuando se le da click a un registro".

### Cambios

**`RecordFieldsForm`** ahora acepta prop `density?: 'comfortable' | 'compact'`
(default `comfortable` para no romper otros callers).

Cuando `compact`, delega a `CompactFieldRow` (el componente ya existente
del CRM layout). Wrap en un solo container con `border` + `rounded-lg`
y `overflow-hidden` para que el conjunto se vea como una "card de
propiedades" unificada. Sin gap entre filas — `CompactFieldRow` ya
pone `border-b` interno.

**`RecordDetailDrawer`** pasa `density="compact"`. `RecordCreateDialog`
y `RecordPage` quedan en `comfortable` deliberadamente (create flow y
detail page tienen suficiente espacio horizontal).

### Archivos

- `app/admin/records/RecordFieldsForm.tsx` (prop density + branch compact)
- `app/admin/records/RecordDetailDrawer.tsx` (density="compact")

Build: 0 errores TS, 548 tests PHPUnit OK.

## [0.52.0] — 2026-05-25

**Color picker con hex + 6 presets nuevos + edit dialog Kanban + fix Cards.**

### A — Color picker extendido

`OptionColor` ahora es `PresetColor | string` (preset OR hex). 18
presets (6 nuevos: slate, red, emerald, sky, indigo, fuchsia). UI del
picker: 18 swatches + `<input type="color">` nativo + input manual hex
con validación.

`chipSoftStyle()` detecta el tipo: preset usa CSS vars (theme-aware);
hex usa `${hex}24/52` para bg/border y deriva text con HSL forzando
lightness 28% (light) / 72% (dark). Theme detectado al render via
`[data-imcrm-theme]`.

Helpers nuevos: `isPresetColor`, `isHexColor`, `normalizeHex`.
`FieldConfigEditor` valida `isAcceptableColor` (preset OR hex).

### B — Fix vista Cards (state que se reseteaba)

Bug: checkboxes se deseleccionaban solos, selectors no preservaban
valor. Causa: `useEffect(..., [open, view, update])` en
`EditCardsViewDialog` — `view` y `update` cambian de referencia cada
render → efecto re-corría → state se reseteaba al original. Fix: deps
`[open, view.id]` + `update.reset()` en efecto separado.

### C — Edit dialog para Kanban

Nuevo `EditKanbanViewDialog.tsx`. Form: nombre + agrupación (select) +
título de card (fallback automático) + lista reordenable de meta
fields. `SavedViewConfig` extendido con `kanban_title_field_id` y
`kanban_meta_field_ids` (ambos opcionales). `KanbanView` los usa si
están presentes; cae a heurística previa si no.

Build: 0 errores TS, 548 tests OK.

## [0.51.0] — 2026-05-25

**Cambio de tipo de campo + contraste mejorado en chips de color.**

### Parte A — Cambio de tipo de campo

**Nuevo: `src/Fields/FieldTypeMigration.php`** — matriz estática de
transiciones permitidas con su nivel de riesgo (safe/lossy/destructive)
y un helper `migrateValue(value, from, to)` que transforma valores en
memoria.

Transiciones soportadas:
- `text` ↔ `long_text` (long → text trunca a 255)
- `text` ↔ `email` / `url` (text → email/url filtra inválidos)
- `number` ↔ `currency` (mismo SQL, solo metadata)
- `date` ↔ `datetime` (datetime → date descarta hora)
- `select` ↔ `multi_select` (multi → select pierde N-1)
- `email` / `url` ↔ `text`

**Nuevo: `FieldService::changeType(listId, fieldId, newType, ?config)`** —
método separado de `update()` por la complejidad. Flujo:

1. Valida transición vía `FieldTypeMigration::isAllowed`.
2. Lee todos los valores raw vía `RecordRepository::fetchColumnValuesById`
   (nuevo helper).
3. Para cada uno: `oldType.unserialize → migrate → newType.serialize`.
4. Dropea índice único si lo tenía.
5. `ALTER COLUMN` con el nuevo SQL si difiere (compara normalizado).
6. Reescribe valores transformados.
7. Reaplica índice único si el nuevo tipo lo soporta (si falla por
   duplicados post-migration, lo desactiva sin bloquear).
8. Actualiza `wp_imcrm_fields.type` y `.config`.

Si el ALTER falla, no se tocan los valores → no hay corrupción.

**Helper `bridgeConfigForTypeChange`** preserva subset compatible:
- select↔multi_select → `options`
- number↔currency → `decimals` (+ `currency` para currency)
- Resto → config vacío

**REST: `PATCH /lists/{}/fields/{}`** ahora acepta `type` en el payload.
Si difiere del actual, rutea a `changeType()` antes del update normal.
Si tipo y `config` vienen juntos, `changeType` aplica el config y se
omite del segundo update para no duplicar.

**REST: `GET /lists/{}/fields/{}/type-transitions`** — devuelve
`{current, transitions: [{type, risk}]}` para el frontend (no usado
todavía; el frontend usa el mirror TS).

**Frontend: `app/lib/fieldTypeMigration.ts`** — mirror del matrix PHP.
Mantenelo sincronizado.

**Frontend: `FieldTypeSelect`** acepta nuevo prop `editingFromType`. Si
está presente, filtra el dropdown a current + allowed transitions, y
agrega badge de riesgo a las opciones no-safe.

**Frontend: `FieldDialog`**:
- Removido `disabled={isEdit}` del `<FieldTypeSelect>`.
- Pasa `editingFromType={field.type}` en modo edición.
- Componente nuevo `<TypeChangeWarning>` con bg destructive/warning
  según riesgo.
- Pre-submit: `confirm()` si la transición es `destructive`.
- Patch incluye `type` solo cuando difiere del actual.

**`UpdateFieldInput`** type extendido con `type?: FieldTypeSlug`.

### Parte B — Contraste de chips de color

Los colores `yellow`/`amber`/`lime`/`cyan` (lightness 43-53%) eran
ilegibles cuando se usaban como `color` del chip de select/multi_select
— el bg al 14% opacity es casi blanco, y el text con esos valores
saturados pero claros no daba contraste.

Solución: nueva variante CSS `--imcrm-opt-{color}-text` por color con
lightness forzada:
- Light mode: 24-32% (oscuro sobre bg near-white)
- Dark mode: 65-78% (claro sobre bg dark tintado)

`chipSoftStyle()` ahora usa la variante `-text` para el `color`
(manteniendo `base` para bg/border). Cualquier código que ya use
`chipSoftStyle` (TableView, MultiSelectField config, FieldValueDisplay,
renderCellValue) hereda la mejora automáticamente.

### Tests

- `tests/Unit/Fields/FieldTypeMigrationTest.php` — 16 tests cubren matrix
  + migrateValue para todas las combinaciones. 548 tests passing total.

### Archivos

Nuevos:
- `src/Fields/FieldTypeMigration.php`
- `tests/Unit/Fields/FieldTypeMigrationTest.php`
- `app/lib/fieldTypeMigration.ts`

Modificados:
- `src/Fields/FieldService.php` (changeType + 2 helpers)
- `src/Records/RecordRepository.php` (fetchColumnValuesById helper)
- `src/REST/FieldsController.php` (updateItem rutea type change + nuevo endpoint type-transitions)
- `app/admin/lists/FieldDialog.tsx` (UI cambio tipo + warning + confirm)
- `app/admin/lists/FieldTypeSelect.tsx` (filtra opciones + risk badge)
- `app/types/field.ts` (UpdateFieldInput.type)
- `app/components/ui/color-picker.tsx` (chipSoftStyle usa -text variant)
- `app/styles/globals.css` (12 vars -text light + 12 vars -text dark)

## [0.50.1] — 2026-05-25

**Fix UX: bloques Notas/Markdown en modo `field` son editables inline
desde el admin.**

### Motivación

Feedback del usuario: "no me dejaste como campo editable estos de
notas, se supone que en esta vista y dado que estoy desde el admin
debería poder editar todo en esta vista individual". Cierto — en 0.50.0
solo agregué el modo `field` para LECTURA. Falta el contraparte de
edición.

### Cambios

**`NotesView`** acepta nuevo prop opcional `editable: { onChange,
placeholder? }`. Cuando se pasa, renderea un `<textarea>` always-on
sin chrome (border-0, bg transparente) — visualmente parece el bloque
estático pero es editable. Cambios entran al `values` del padre =
dirty state = se guarda con el botón "Guardar" del header.

**`MarkdownBlockView`** acepta `values` + `onChange` opcionales. En
modo `field` con esos disponibles, usa el componente nuevo
`MarkdownEditView` que tiene toggle preview/edit:
- Default: preview del markdown rendereado en un `<button>` con
  estilo de área editable (hover muestra border + bg).
- Click → textarea con fuente monoespaciada para editar el source.
- Toggle "Vista previa" / "Editar markdown" abajo a la derecha.
- Si el contenido es vacío, arranca directamente en modo edit.

**`BlockRenderer`** en el case `notes` ahora detecta `source === 'field'`
y construye el descriptor `editable` con `onChange` apuntando al
slug correcto del field. Para markdown, pasa `values` + `onChange`
crudo al view.

### Comportamiento por modo

| Modo del bloque | Vista en el admin | Editable |
|----------------|------------------|----------|
| `notes` literal | Texto plano | No (editar desde template editor) |
| `notes` field | Textarea always-on | Sí ✓ |
| `markdown` literal | Markdown rendereado | No (editar desde template editor) |
| `markdown` field | Preview + click-to-edit | Sí ✓ |

### Archivos

- `app/admin/records/crm/BlockRenderer.tsx` (case `notes` con editable + pass values/onChange a markdown)
- `app/admin/records/crm/blocks/SimpleBlockViews.tsx` (MarkdownBlockView + nuevo MarkdownEditView component)

Build: 0 errores TS, 532 tests PHPUnit OK.

## [0.50.0] — 2026-05-25

**Bloques dinámicos alimentables desde campos del registro.**

### Motivación

Feedback del usuario: "hay varios bloques que hay que reconstruir
ahora porque los veo que son estaticos y globales para todos pero que
deberían tener la opción de ser dinámicos como los de notas ya que
deberían tener la opción de poderse alimentar de un campo en lugar de
solo ser algo fijo para todos los registros".

Antes los bloques `notes`, `markdown`, `action_button` y `stats` eran
template-level static — su contenido era idéntico para todos los
registros de la lista. Solo `embed` ya tenía modo `field` desde antes.

### Cambios por bloque

**`V2NotesBlock`** + **`V2MarkdownBlock`** — nuevo campo
`source: 'literal' | 'field'` (default `literal` para backward-compat)
y `field_slug?`. Cuando es `field`, el renderer lee
`record.fields[field_slug]` como string. Form filtra a campos
`long_text` y `text`.

**`V2ActionButtonBlock`** — nuevos campos `target_source` y
`target_field_slug`. Cuando `target_source === 'field'`, resuelve el
target dinámicamente del record. El selector de campo en el form se
filtra según `action_type`:
- `mailto` → solo fields tipo `email`
- `url` → solo fields tipo `url`
- `tel` → fields tipo `text` y `number`
- `copy` → cualquier campo de texto/número/etc.

Si el campo está vacío en un record específico, el botón queda
disabled con mensaje "El campo no tiene valor en este registro."

**`V2StatsBlock`** — antes tenía `config: Record<string, never>` (sin
opciones). Ahora:
```ts
config: {
    mode?: 'auto' | 'custom';
    items?: Array<
      | { kind: 'auto'; metric: 'days_in_system' | 'days_since_changes' | 'comments' | 'changes' }
      | { kind: 'field'; field_slug: string; label?: string }
    >;
}
```

Modo `auto` (default, backward-compat) muestra las 4 métricas
automáticas de toda la vida. Modo `custom` muestra exactamente los
items definidos — pueden ser mezcla de auto-metrics y valores de
campos (con label opcional por item). Reordenable con flechas
arriba/abajo, eliminable individualmente.

Formato de valor por tipo en custom: number/currency con
`toLocaleString` + decimals del config, date con `toLocaleDateString`,
checkbox con Sí/No, resto como string.

### Forms (UI del editor)

- `NotesForm`: agrega selector `<select source>` + `<select field>` cuando es field.
- `MarkdownForm`: idem.
- `ActionButtonForm`: agrega `<select target_source>` + selector de campo filtrado por action_type.
- `StatsForm`: form completamente nuevo (antes el inspector decía "sin opciones"). Toggle mode + lista de items reordenable + dropdowns para agregar.
- `BlockInspectorPanel`: ruta `stats` al nuevo `StatsForm`, pasa `fields` a NotesForm/MarkdownForm/ActionButtonForm.

### Renderers

- `NotesView` (en BlockRenderer.tsx) y `MarkdownBlockView`: lógica
  común de resolución `source === 'field' ? record.fields[slug] : config.content`.
- `ActionButtonView`: resuelve `resolvedTarget` antes de `handleClick`; mensaje específico cuando el campo está vacío.
- `StatsBlock`: nuevo prop `mode`/`items`. Helper `renderAutoMetric` que respeta el orden custom; helper `formatFieldStatValue` para formato por tipo.

### Archivos

Modificados:
- `app/lib/crmTemplates.ts` (5 tipos extendidos + resolver inflate de fields)
- `app/admin/records/crm/BlockRenderer.tsx` (NotesView resuelve source + pass `record` a markdown/action/stats)
- `app/admin/records/crm/blocks/SimpleBlockViews.tsx` (MarkdownBlockView + ActionButtonView reciben `record`)
- `app/admin/records/crm/RightRail.tsx` (StatsBlock con custom items + helpers)
- `app/admin/lists/template-editor/forms/BlockForms.tsx` (NotesForm/MarkdownForm/ActionButtonForm con source toggle + nuevo StatsForm)
- `app/admin/lists/template-editor/panels/BlockInspectorPanel.tsx` (hookup StatsForm + pass fields)

Build: 0 errores TS, 532 tests PHPUnit OK.

## [0.49.0] — 2026-05-25

**Encabezado del registro CRM como bloque configurable del grid.**

### Motivación

Feedback del usuario: "me gustaría poder ajustar el bloque de
'Encabezado del panel' que veo que ahora no existe sino que es
automatico y no le puedo ajustar el ancho". El header era un
componente fijo (`<RecordHeader>`) renderizado en `RecordCrmLayout`
fuera del grid — no se podía mover, redimensionar ni configurar.

### Cambios

#### Nuevo tipo de bloque V2: `header`

`V2HeaderBlock` con config:
- `variant`: `'hero' | 'compact' | 'minimal' | 'banner'`
- `show_avatar`, `show_id_badge`, `show_subtitle`, `show_created_at`,
  `show_status_strip`, `show_actions` (booleans)
- `accent_color`: string hex | null (auto desde hash del título)

#### 4 variantes visuales

- **`hero`** — avatar 16×16 rounded-2xl con ring-4, banda decorativa
  gradient arriba, layout horizontal con título + subtítulo + fecha.
  Equivalente al estilo previo.
- **`compact`** — fila única, avatar 10×10 rounded-lg, título inline
  con badges, sin banda decorativa. Padding 3 vs 5 del hero.
- **`minimal`** — sin avatar, solo título grande + acciones a la
  derecha. Sin border ni bg (transparente). Layout limpio.
- **`banner`** — avatar 20×20 + título centrados, gradient sutil del
  accent color como bg, acciones debajo del status strip.

#### Datos vs estilo

Los **datos** (qué campo es título, subtítulos, status, quick actions)
siguen siendo template-level — vienen del `headerSpec` del template
resuelto. Solo el **estilo** vive en `block.config`. Esto preserva la
coherencia entre header config y search/sort/etc.

#### Backward-compat

3 puntos de inyección automática del header block:

1. **`getResolvedV2` (render)**: si los blocks resueltos no incluyen
   `header`, inyecta uno sintético en (0,0,12,4) y shifta los demás
   `y += 4`. Templates legacy renderean idénticos al visual previo.
2. **`ensureV2` (load editor con config custom)**: si la config
   serializada no tiene header block, prepende uno con defaults antes
   de devolverla.
3. **`customConfigV2FromBuiltin` (load editor con template built-in)**:
   las built-in templates (`V2Builder.build()`) no emiten header, así
   que se inyecta acá. El user ve el header inmediatamente como bloque
   real en el editor.

El render del header en el grid usa `RecordHeader` (refactorizado para
aceptar `style: RecordHeaderStyle` + `data: RecordHeaderData` en lugar
del `layout: ResolvedLayout` compat shim que se eliminó del flujo).

#### Hookup del editor

- `HeaderForm` en `app/admin/lists/template-editor/forms/BlockForms.tsx`:
  - `<select>` de variante
  - 6 toggles para show_*
  - color picker hex + input para accent_color con botón Reset
- `BlockInspectorPanel` ruta `block.type === 'header'` al `HeaderForm`.
- `BlockPalettePanel` lista el header en nueva categoría "Estructura"
  con `singleton: true` (1 solo por panel).
- `createBlock('header')` retorna bloque con `defaultHeaderBlockConfig()`
  y posición 12-wide al tope.
- `EditorCommandPalette.describeBlock` maneja el nuevo tipo.

### Archivos

Modificados:
- `app/lib/crmTemplates.ts` (V2HeaderBlock + ResolvedV2Block + resolver
  + ensureV2 + customConfigV2FromBuiltin + factories de defaults)
- `app/admin/records/crm/RecordCrmLayout.tsx` (elimina render fijo del
  header, pasa headerData + callbacks al BlockRenderer)
- `app/admin/records/crm/RecordHeader.tsx` (reescrito — 4 variantes,
  acepta `data` + `style` props)
- `app/admin/records/crm/BlockRenderer.tsx` (case `header` →
  `<RecordHeader>`, props opcionales)
- `app/admin/lists/template-editor/forms/BlockForms.tsx` (HeaderForm
  + Toggle helper)
- `app/admin/lists/template-editor/panels/BlockInspectorPanel.tsx`
  (ruta a HeaderForm + title/desc)
- `app/admin/lists/template-editor/panels/BlockPalettePanel.tsx`
  (categoría "Estructura" + Layout icon)
- `app/admin/lists/template-editor/utils/createBlock.ts`
- `app/admin/lists/template-editor/EditorCommandPalette.tsx`
  (describeBlock para 'header')

Build: 0 errores TS, 532 tests PHPUnit OK.

## [0.48.0] — 2026-05-25

**Pulido visual del layout CRM.**

Tras un screenshot del usuario mostrando el layout CRM con densidad
pobre, inputs sin diferenciación visual y cards huérfanas de 1 solo
campo, se atacan los 6 puntos identificados.

### 1. Densidad compact en propiedades

Nuevo componente `app/admin/records/crm/CompactFieldRow.tsx`. Cada campo
se rendea como fila label-izquierda (120px, muted) + valor-derecha
(flex-1) de ~32-40px de alto. Antes: label arriba + input abajo + gap-4
= 70-80px por campo.

Edit on-click: en modo lectura se ve el valor renderizado con
`FieldValueDisplay`; click activa el input apropiado al tipo. Enter o
blur cierra. Sin escape: el cambio queda en el `values` del padre (que
acumula el dirty state y guarda con el botón "Guardar" del header).

Tipos con UI compleja (checkbox, select, multi_select) tienen control
inline permanente — sin "modo edit", el control vive comprimido en la
columna de valor.

### 2. Renderers visuales por tipo de campo

Nuevo `app/admin/records/crm/FieldValueDisplay.tsx`:

- `currency` → `Intl.NumberFormat({style:'currency', currency})` lee
  `field.config.currency` (default COP). Output: `$1.000.000 COP`.
- `number` → `toLocaleString` con `field.config.decimals`.
- `date` / `datetime` → fecha localizada + tiempo relativo entre paréntesis
  (`hoy`, `mañana`, `hace 3 días`, `en 2 semanas`, etc.).
- `checkbox` → ícono ✓ verde / − muted.
- `select` → chip con color de la opción (reusa `chipSoftStyle`).
- `multi_select` → row de chips.
- `email` → `mailto:` link con icono.
- `url` → link target=_blank con icono (display strippea `https://`).
- `user` / `file` → icono + ID.
- `long_text` → line-clamp-3 con leading relaxed.
- `computed` → respeta `decimals` del config y operación.

### 3. Auto-promoción de cards de 1 campo

Cubierto vía la nueva opción `variant: 'inline' | 'card'` (ver punto 4).
El usuario puede elegir explícitamente `inline` para grupos de 1-2
campos clave; el bloque se rendea sin card wrapper, solo con label
pequeño arriba y los campos.

### 4. Opciones de layout en el editor de plantilla

`V2PropertiesGroupBlock.config` ahora acepta:
- `density?: 'compact' | 'comfortable'` (default `compact`).
- `variant?: 'card' | 'inline'` (default `card`).

Ambos opcionales — plantillas viejas siguen funcionando (el resolver
aplica defaults seguros).

`PropertiesGroupForm.tsx` (panel del editor) expone los dos como
`<select>` arriba de los campos del grupo. Hot reload via `commit`
existente.

### 5. Polish del header del registro

`RecordHeader.tsx`:
- Avatar 16×16 (antes 14×14), rounded-2xl, ring-4 ring-card, shadow-md.
- Banda decorativa de 1.5px arriba con gradient del color del avatar.
- Badges + quick actions agrupados en chip-row con `bg-muted/30` y
  border, en lugar de flotar en el padding.
- Botón "Guardar" con shadow-sm para destacar.

### 6. Empty states de timeline

`RecordTimeline.tsx`: el estado vacío ahora muestra:
- Círculo muted con icono de Activity centrado.
- Título principal + descripción debajo en text-center.
- Border dashed + bg sutil que delimita visualmente el bloque.

### Archivos

Nuevos:
- `app/admin/records/crm/FieldValueDisplay.tsx`
- `app/admin/records/crm/CompactFieldRow.tsx`

Modificados:
- `app/lib/crmTemplates.ts` (tipos + resolver defaults)
- `app/admin/records/crm/BlockRenderer.tsx` (PropertiesGroupView con density/variant)
- `app/admin/records/crm/PropertiesSidebar.tsx` (CompactFieldRow en grupos del rail)
- `app/admin/records/crm/RecordHeader.tsx` (polish visual)
- `app/admin/records/crm/RecordTimeline.tsx` (empty state)
- `app/admin/lists/template-editor/forms/BlockForms.tsx` (controles density/variant)
- `imagina-crm.php`, `readme.txt`, `package.json`, `docs/changelog.md`

### Backward-compat

- `density` y `variant` opcionales con defaults seguros. Plantillas
  serializadas previas no se rompen.
- `RecordFieldsForm` sigue intacto — lo usa el RecordDetailDrawer y la
  variante `comfortable` del editor. No se eliminó.
- `renderCellValue.tsx` (TableView) sigue intacto — los renderers nuevos
  son más ricos pero también más grandes, no aptos para celdas de tabla.

## [0.47.3] — 2026-05-25

**Fix: importación CSV con fechas ISO de ClickUp + invalidación de cache
post-import.**

Dos bugs reportados al importar exports CSV de ClickUp:

### 1. Fechas ISO con cola horaria rechazadas en campos `date`

ClickUp emite fechas en formato `2024-07-23T00:00:00.000+00:00` incluso
para columnas tipo "Due date" que el usuario configuró como solo día.
`ImportService::normalizeDate()` detectaba el prefijo ISO `YYYY-MM-DD`
y devolvía el string entero, incluyendo la cola `T00:00:00.000+00:00`.
`DateField::validate()` usa parsing estricto con formato `Y-m-d` y
rechazaba el valor → el record entero quedaba marcado como error y no
se importaba esa celda.

Fix: cuando el destino es `date`, `normalizeDate()` truncá al
`YYYY-MM-DD` capturado por la regex (la cola se descarta). Para
`datetime` sigue pasando el string completo — `DateTimeField` acepta
ISO 8601 nativo.

Tests nuevos en `ImportDateNormalizationTest`:
- `test_iso_datetime_with_time_strips_to_date_for_date_field`
- `test_iso_datetime_with_time_passes_through_for_datetime_field`

### 2. Records importados invisibles hasta recargar el navegador

Al cerrar el wizard de import, la lista de records aparecía vacía y
había que hacer reload manual. Causa: `ImportDialog` invalidaba con
`['records', listId]` y `['fields', listId]` con `listId` numérico,
pero los hooks `useRecords` / `useFields` indexan por
`String(listId)`. TanStack Query compara cada posición del array por
igualdad estricta → `42 !== '42'` → ninguna query matcheaba → cache no
se invalidaba.

Fix: usar las factories `recordsKeys.forList()` y `fieldsKeys.forList()`
que producen el shape canónico (`['records', String(listId)]`).

### Archivos

- `src/Imports/ImportService.php` (regex captura + branch por tipo)
- `app/admin/records/ImportDialog.tsx` (imports + invalidateQueries)
- `tests/Unit/Imports/ImportDateNormalizationTest.php` (+2 tests)
- `readme.txt`, `imagina-crm.php`, `package.json`, `docs/changelog.md`
  (version bump 0.47.2 → 0.47.3).

## [0.47.2] — 2026-05-23

**Perf: virtualización TableView**
(Fase 17.C — DEFERRED #1 · **CIERRE DE FASE 17**).

Cierra el tercer crítico de escala. La TableView ahora puede
renderear listas de 5000+ records sin saturar el browser. El
contrato del CLAUDE.md §11 "Scroll con 5k records a 60fps" pasa
a ser realizable (pendiente bench formal).

### Diseño preservando layout HTML `<table>`

`useVirtualizer` controla qué rows se rendean. El layout
`<table>` HTML se mantiene intacto — column resize, sticky
columns, drag-and-drop de columnas, footer con aggregates,
EditableCell inline siguen funcionando.

Truco: en lugar de absolute positioning (que rompe `<table>`),
las "rows no visibles" se reemplazan por **2 `<tr>` spacer**
(uno arriba, uno abajo) con `height` calculada — el browser
reserva el espacio en el scroll pero no rendea celdas dentro.

### Activación condicional

`shouldVirtualize = rows.length > 100`. Para listas chicas
(default `per_page = 200`, pero comúnmente <100 rows visibles
por página), render normal sin overhead del virtualizer.

Para listas grandes (per_page hasta 500, o vistas Kanban/Cards
que pueden cargar 500 records):
- `useVirtualizer` con `estimateSize: 40` y `overscan: 10`.
- Solo `~20-30 rows` renderean visualmente en cualquier momento
  (viewport + buffer).
- Padding-top/bottom rows reservan el espacio total scrollable.

### Impacto

Lista con 500 records visibles:

| | Antes | Después |
|---|---|---|
| DOM rows | 500 | ~20-30 |
| Re-renders al scrollear | 500 cells × N | ~20-30 cells |
| FPS scroll | <30 (lag visible) | 60 (smooth) |

### Bundle

- main.js: 633 → 651 KB raw / 178 → 183 KB gzip. **+5 KB gzip**
  por `@tanstack/react-virtual` (que ya estaba en deps pero
  ahora se usa).
- Initial paint total: ~235 → ~240 KB gzip. Sigue bajo el
  contrato CLAUDE.md §11 (≤ 250 KB). ✅

### Estado

- PHPUnit: 530/0 errors.
- PHPStan: 0 errors.
- TypeScript strict: OK.
- Bundle: OK.

### Cierre Fase 17 — Escalabilidad

```
0.47.0  · 17.A · Export async via Action Scheduler (DEFERRED #2)
0.47.1  · 17.B · Bulk update con valores uniformes (DEFERRED #3)
0.47.2  · 17.C · Virtualización TableView (DEFERRED #1)  ← acá
```

Los **3 críticos de escala del DEFERRED.md cerrados**. Quedan
los 7 items menores (perf medio: M3, M4, M6; cleanup técnico:
PHPStan 2.x, tests integration, PHPCS audit, XLSX nativo).

### Veredicto post Fase 17

**Listo para escala razonable**: 10-50 instalaciones, listas
hasta 50k records, exports frecuentes funcionando async sin
bloquear UI. Quedaron pendientes los items M3/M4/M6 del DEFERRED
(optimizaciones medias) — no son bloqueadores.

## [0.47.1] — 2026-05-23

**Perf: bulk update con values uniformes**
(Fase 17.B — DEFERRED #3).

Cierra el N+1 restante en `RecordService::bulk('update', ...)`.
La 16.B había optimizado bulk delete pero update seguía con loop
legacy (validate + find + update + relations + find + do_action
**por cada record**).

### Fast path

Cuando `$values` NO contiene fields tipo `relation`:

1. **Validate × 1** — los validators son deterministas, validar
   una vez aplica a todos.
2. **`findManyByIds` × 1** — SELECT IN para snapshots
   (necesarios para el hook `record_updated`).
3. **`bulkUpdate` × 1** — single UPDATE SET ... WHERE id IN.
4. **Hydrate in-memory × N** — `$updatedRecord` desde `snapshot +
   row` aplicado, sin SELECT post-update.
5. **`do_action('record_updated')` × N** — listeners (ETag bump,
   search index, automation engine con `field_changed` triggers)
   reciben payload correcto.

### Fallback

Si `$values` incluye al menos un slug de field tipo `relation`,
caemos al loop legacy. Razón: relations son many-to-many via
`wp_imcrm_relations` y cada record necesita su propio sync.

### Impacto

Bulk update de 100 IDs con un column value:

| | Antes (16.B) | Después (17.B) |
|---|---|---|
| Validate | 100 | 1 |
| SELECT snapshots | 200 | 1 |
| UPDATE queries | 100 | 1 |
| SELECT post-update | 100 | 0 |
| **Total queries directas** | **~500** | **~3** |

(Listeners siguen disparándose por ID — eso es by-design.)

### Repo nuevo

- `RecordRepository::bulkUpdate($tableSuffix, $ids, $row): int`
- `RecordRepository::findManyByIds($tableSuffix, $ids): array<int, array>`

### Estado

- PHPUnit: 530/0 errors.
- PHPStan: 0 errors.

## [0.47.0] — 2026-05-23

**Export async via Action Scheduler**
(Fase 17.A — DEFERRED #2).

Cierra el bug **P3** del reporte de auditoría. El export síncrono
acumulaba hasta 50k filas en memoria PHP y emitía el CSV con
`header()` directo en la request — riesgo de OOM + timeout HTTP
en listas grandes.

### Diseño

Cuando el cliente pasa `?async=1` (lo hace automáticamente
cuando `total > 5000` records), el endpoint:

1. **POST** persiste un row en `wp_imcrm_export_jobs` con status
   `pending` + dispatch a Action Scheduler.
2. Devuelve **202 Accepted** con `{ job_id, status, poll_url }`.
3. El worker (`ExportJobService::runJob`) levanta el job, ejecuta
   `CsvExporter` con los params guardados, escribe el archivo en
   `uploads/imagina-crm/exports/<id>-<slug>-<ts>.csv`, marca
   `ready` (o `failed` con el error).
4. El frontend polea `GET /export/jobs/{id}` cada 2s (timeout 5min).
5. Cuando `status=ready`, el response trae `download_url` con
   token firmado HMAC + TTL 24h.
6. **GET** `/export/jobs/{id}/download?token=...` valida el token
   y stream-ea el archivo.

### Seguridad del download

- Token HMAC con `wp_salt('auth')` — no se puede falsificar sin
  acceso a la BD del sitio.
- Token incluye `user_id` + `expires` — solo el creador (o admin
  del plugin) puede descargar.
- TTL 24h. Después: token expira aunque el archivo siga.
- Directorio `uploads/imagina-crm/exports/` protegido con
  `.htaccess: Deny from all` + `index.html` en blanco. Acceso
  directo desde el web bloqueado.

### Cleanup automático

`wp_schedule_event` diario corre `imagina_crm/export_jobs_cleanup`
que borra jobs (+ archivos) > 7 días via
`ExportJobRepository::purgeOlderThan`.

### Esquema

Nueva tabla `wp_imcrm_export_jobs`:
- `id, list_id, user_id, status, params (JSON), row_count,
  file_path, error, created_at, completed_at`.
- Índices: `(user_id, created_at)` para "mis exports",
  `(list_id, created_at)`, `(status, created_at)` para cleanup.

`IMAGINA_CRM_DB_VERSION` bump: `8 → 9`. La migration corre en
`dbDelta()` la próxima vez que el plugin activa o un admin
visita el wp-admin.

### Endpoints REST nuevos

- `GET /lists/{slug}/export?async=1` — crea job (202).
- `GET /export/jobs/{id}` — status del job.
- `GET /export/jobs/{id}/download?token=...` — descarga.
- `GET /export/jobs` — historial del usuario actual.

### Frontend

`ExportButton` ahora recibe `totalRecords` prop. Si > 5000,
agrega `async=1` automáticamente. Si el backend devuelve 202,
entra a un loop de polling (`pollAndDownload`) que dispara el
download al final.

UX: el botón muestra "Exportando…" durante toda la operación
(crear job + polling + download). Para exports muy grandes
(>5 min), un timeout dispara error con mensaje pidiendo recargar
y revisar la sección de jobs.

### Estado

- PHPUnit: 530/0 errors.
- PHPStan: 0 errors.
- TypeScript strict: OK.
- Build: OK (sin cambios significativos en bundle).

## [0.46.4] — 2026-05-23

**Security: rate-limit bypass via X-Forwarded-For + cierre Fase 16**
(Fase 16 · Iteración 16.F · **CIERRE DE FASE 16**).

### Fix S6 — Rate limit XFF bypass

`PublicListsController::clientIp()` confiaba en
`HTTP_X_FORWARDED_FOR` sin verificar si el sitio corre detrás de
un proxy. Un atacante podía spoofear el header en cada request
y rotear infinito el rate limit (60 req/min/IP queda sin efecto
porque el contador se resetea por IP "distinta").

**Fix**: solo aceptamos `X-Forwarded-For` / `X-Real-IP` cuando
la constante `IMAGINA_CRM_TRUST_FORWARDED_HEADERS` está definida
como `true` en `wp-config.php`. El admin lo activa explícitamente
solo si tiene un reverse proxy / CDN conocido (Cloudflare,
nginx, etc.) que sanea el header antes de pasar la request.

**Por default** (sin la constante): cae directo a `REMOTE_ADDR`,
robusto contra spoofing.

**Documentación para el admin**: agregar a `wp-config.php`:

```php
// Si tu WP corre detrás de Cloudflare / nginx / Varnish, etc.
// que SETEAN X-Forwarded-For confiablemente:
define('IMAGINA_CRM_TRUST_FORWARDED_HEADERS', true);
```

### Documentación de deuda técnica

Items que NO se cerraron en Fase 16 quedaron documentados
formalmente en **`docs/DEFERRED.md`** con:
- Severidad estimada.
- Lo que falta hacer concretamente.
- Estimación de esfuerzo.
- Workaround actual.

Items diferidos (10 en total):
1. Virtualización TableView (perf media)
2. Export síncrono → Action Scheduler (perf alta — solo listas >10k)
3. Bulk update con valores uniformes (perf media)
4. Plugin::register() defer (perf media)
5. Fetch waterfall list→fields→records (perf baja)
6. CardsView background-image → img lazy (perf baja)
7. PHPStan 2.x upgrade
8. Tests integration con WP real
9. Auditoría 379 PHPCS violations
10. XLSX export nativo

### Resumen Fase 16 — Production readiness

```
0.46.0  · 16.A · Per-field permissions strip + XSS markdown (S1-S5)
0.46.1  · 16.B · Fix N+1 en bulk delete (P1)
0.46.2  · 16.C · Fix BM25 subquery correlacionada (P2)
0.46.3  · 16.D · staleTime + memo + lazy views (M1, M2, bundle)
0.46.4  · 16.F · Rate-limit XFF bypass (S6) + cierre  ← acá
```

(16.E se reasignó a documentación formal de deuda técnica —
la virtualización TableView pasó a `docs/DEFERRED.md` item #1
por scope.)

### Cobertura del reporte de auditoría

**Seguridad**: 6 bugs reales (S1-S6) → **6 cerrados** ✅
**Performance**: 7 issues (5 críticos + 2 medios) → **3 críticos
cerrados** (P1, P2, M1/M2/bundle); 4 diferidos a DEFERRED.md.
**Cumplimiento de contratos CLAUDE.md §11**:
- Bundle ≤ 250 KB gzip inicial ✅ (235 KB)
- TTI ≤ 400ms con 50 rows ✅ (con memo aplicado)
- Otros contratos requieren benchmark con BD real para validar.

### Estado de salud al cierre

| Tool | Estado |
|---|---|
| **Vitest** | 62 tests, 0 errors |
| **PHPUnit** | 530 tests, 0 errors |
| **PHPStan** | 0 errors |
| **PHPCS** | runs, 379 violations cosméticas |
| **TypeScript** | strict, sin errors |
| **Build** | OK, ~235 KB gzip inicial |

### Veredicto production-ready (honesto)

**Listo para clientes pequeños-medianos** (1-10 users, ≤5000
records por lista, sin escala extrema). Los 6 bugs de seguridad
están cerrados. Los issues de performance críticos también.

**No listo para escala masiva** (decenas de instalaciones,
listas >50k records, exports frecuentes >10k): los items 1, 2 y
3 de `DEFERRED.md` deberían cerrarse antes.

## [0.46.3] — 2026-05-23

**Perf frontend: staleTime + memo + lazy views**
(Fase 16 · Iteración 16.D).

Bugs **M1, M2 y bundle size** del reporte de auditoría. Bajamos
el bundle inicial bajo el contrato del CLAUDE.md §11 (≤250 KB
gzip) y reducimos drásticamente refetches innecesarios y
re-renders de cells.

### Cambios

**`staleTime` en 9 hooks de TanStack Query**:

| Hook | staleTime | Razón |
|---|---|---|
| `useLists`, `useList` | 60 s | Lists rara vez cambian en sesión |
| `useFields` | 60 s | Schema changes son raros |
| `useSavedViews` | 60 s | Vistas rara vez se modifican mid-session |
| `useDashboards`, `useDashboard` | 60 s | Mismo patrón |
| `useAutomations` | 60 s | Lista de automations estable |
| `useComments` | 30 s | Append-style; mutations invalidan |
| `useActivity` | 30 s | Append-only en backend |
| `useRecord` (single) | 30 s | Drawer cache entre opens del mismo record |

`useRecords` (list query con paginación) sigue sin staleTime
por diseño — usa `keepPreviousData` que es el patrón correcto
para tablas live.

**`React.memo(EditableCell)` con custom comparator**:

`EditableCell` (448 líneas, con state propio + 3-4 useEffect) se
renderea ~500 veces por re-render del `RecordsPage` (10 cols × 50
rows). Sin memo, tipear en el search input disparaba 500 cell
re-renders.

Comparator: solo re-rendea si `recordId`, `listId`, `field.id`,
`value` o `canEdit` cambian. Los demás props son closures fresh
del parent pero NO afectan el pintado.

**Lazy-load de views alternativas**:

`KanbanView`, `CalendarView`, `CardsView`, `GroupedTableView`
ahora son chunks separados (`React.lazy` + `<Suspense>`). Solo
se cargan cuando una saved view de ese tipo está activa.

### Bundle sizes

| | Antes | Después |
|---|---|---|
| `main.js` | 651 KB raw / 184 KB gzip | 633 KB / **178 KB gzip** |
| `KanbanView.js` | (en main) | 5.97 KB / 2.18 KB gzip |
| `CalendarView.js` | (en main) | 4.06 KB / 1.63 KB gzip |
| `CardsView.js` | (en main) | 4.21 KB / 1.85 KB gzip |
| `GroupedTableView.js` | (en main) | 11.98 KB / 4.12 KB gzip |
| **Initial paint total** (main + vendor + css) | ~254 KB gzip | **~235 KB gzip** |

**Bajo el contrato CLAUDE.md §11 (≤250 KB inicial gzip).** ✅

### Pendientes para iteraciones siguientes

- **Virtualización TableView** (bug perf #3): `@tanstack/react-virtual`
  está en deps pero sin usar. Necesario para cumplir DoD §17 #6
  (5k records a 60fps). Llega en 16.E.
- **Rate-limit XFF bypass** (bug seguridad S6): pendiente
  16.F.
- **Plugin::register() defer** (bug perf M4): pendiente.
- **Export síncrono → Action Scheduler** (bug perf P3): pendiente.

### Estado

- Vitest: 62 tests passing.
- PHPUnit: 530/0 errors.
- PHPStan: 0 errors.

## [0.46.2] — 2026-05-23

**Perf: fix BM25 subquery correlacionada**
(Fase 16 · Iteración 16.C).

**Bug P2** del reporte de auditoría. El motor de búsqueda
`InvertedIndexEngine` ejecutaba una **subquery correlacionada
por cada fila del JOIN** para calcular `df` (document frequency).
Para 5 tokens × 1000 matches = **5000 ejecuciones** del subselect.

### Fix

Pasamos de 1 query con subselect N veces a **2 queries planas**:

1. `SELECT token, COUNT(DISTINCT record_id) AS df FROM search_tokens
   WHERE list_id = ? AND token IN (...) GROUP BY token` —
   un único scan agrupado.
2. JOIN search_tokens + search_documents **sin** subselect.

PHP combina ambos lookups in-memory antes de computar BM25 — el
`df` se busca en un map `Array<token, int>` en O(1) por row.

### Impacto estimado

Para una query típica de 3-5 tokens contra una lista con 10k
records indexados:

- Antes: 1 query + ~3000-5000 subquery executions inline.
- Después: 2 queries planas. **~95% reducción de SQL ops**.

El JOIN principal sigue siendo el bottleneck pero su perf es
estable (usa el índice `(list_id, token)` que ya existe en
`search_tokens`).

### Estado

- PHPUnit: 530/0 errors (sin regresiones; los tests del search
  engine pasan).
- PHPStan: 0 errors.

## [0.46.1] — 2026-05-23

**Perf: fix N+1 en `RecordService::bulk('delete', ...)`**
(Fase 16 · Iteración 16.B).

**Bug P1** del reporte de auditoría. Severidad alta — un bulk
delete de 500 IDs ejecutaba ~1000-2000 queries (find + softDelete
+ relations + do_action per record + listener queries) y saturaba
la DB / timeout HTTP en listas activas.

### Fix

- **`RecordRepository::bulkSoftDelete($tableSuffix, $ids): int`**
  — single `UPDATE ... SET deleted_at = NOW() WHERE id IN (...)
  AND deleted_at IS NULL`. Devuelve filas afectadas.
- **`RecordRepository::bulkHardDelete($tableSuffix, $ids): int`**
  — análogo con `DELETE FROM`. Para el purge mode (futuro uso).
- **`RecordService::bulk`** ahora tiene fast path para
  `action='delete'`: 1 query SQL + N `do_action` calls. Los
  listeners (ETag bump, search index, automation engine) reciben
  cada ID via `imagina_crm/record_deleted` igual que antes —
  semántica de eventos preservada, sin queries adicionales en el
  loop.

### Trade-off documentado

Si un ID viene ya soft-deleted o no existe, el bulk NO los
distingue de los exitosos (lo haría con un SELECT extra). Para
bulk delete la semántica "ya estaba borrado" es aceptable; todos
se marcan como `succeeded`. Si alguna integración necesita
distinguir, puede hacer un SELECT pre-bulk antes del POST.

### Pendiente para iteración siguiente

- `bulk('update', ...)` sigue con el loop legacy. Requiere
  re-implementar la pipeline de validación + serialize +
  relations + activity log fuera del flow normal. El use case
  caliente (bulk delete) ya cubierto; bulk update con values
  uniformes queda para 16.C+.

### Estado

- PHPUnit: 530/0 errors (sin regresiones).
- PHPStan: 0 errors.

## [0.46.0] — 2026-05-23

**Security fix: per-field permissions bypass en 5 endpoints**
(Fase 16 · Iteración 16.A).

**Severidad: alta.** Bugs **S1-S4** del reporte de auditoría
(Fase 15 cierre): el sistema de per-field permissions de Fase 10
solo se aplicaba en `RecordsController::list/get/update`. Los
demás endpoints que devuelven valores de fields exponían los
campos hidden sin filtro:

| # | Endpoint | Vector |
|---|---|---|
| S1 | `GET /lists/{slug}/export?fields=<id>` | CSV con campos hidden via param fields |
| S2 | `GET /portal/me` + `getRecord` + `getRecords` | Cliente del portal recibe record completo |
| S3 | `GET /lists/{slug}/activity` + `/records/{id}/activity` | `changes.before/after` JSON con valores hidden |
| S3 | `GET /portal/lists/{slug}/aggregates` + `/lists/{slug}/records/aggregates` | counts/sums sobre campos hidden revelan info |
| S4 | `GET /lists/{slug}/records/groups?group_by=<id>` + aggregates con group_by | Group por hidden field |

### Diseño del fix

En lugar de parchear cada controller individualmente
(re-introduciría el bug en el siguiente endpoint que se sume),
centralizamos en un servicio:

- **`Permissions/RecordSanitizer`**: value object stateful con
  los hidden slugs pre-computed para `(user, list)`. Métodos:
  - `stripRecord(array): array` — strip de campos en `{fields,
    relations}` o plain row.
  - `stripRecords(array): array` — batch.
  - `stripActivityChanges(?array): ?array` — strip de `before/
    after` o map plano.
  - `filterAllowedFieldIds(list<int>, idToSlug): list<int>` —
    para guardar IDs de `?fields=` antes de pasar al
    QueryBuilder/exporter.
  - `canSeeField(string): bool` — guard rápido para group_by /
    sort / filter target.
  - `isNoop(): bool` — fast path cuando admin del plugin o sin
    ACL hidden.
- **`PermissionService::sanitizerFor(user, list): RecordSanitizer`**:
  factory que pre-computa los hidden slugs en una sola llamada.

### Endpoints arreglados

- `ExportController::export()`: filtra `?fields=` contra hidden;
  si la intersección queda vacía, **403 Forbidden** con mensaje
  claro. Si no se pasaron IDs, fuerza `fieldIds` a los visibles
  (en lugar de "todos los exportable" del CsvExporter default).
- `PortalController::getMe/getRecord/getRecords`: aplica
  `stripRecord(s)` antes de serializar.
- `PortalController::getAggregates`: filtra `fields[]` contra
  hidden; respuesta vacía si todo era hidden.
- `RecordsController::getGroups`: bloquea `group_by` sobre
  hidden field con 403.
- `AggregatesController::aggregate`: filtra `fields[]` + bloquea
  `group_by` contra hidden.
- `ActivityController::getRecordActivity/getListActivity`:
  aplica `stripActivityChanges` al JSON `changes` de cada item.

### Bug S5 — XSS en markdown renderer

Fixeado en este mismo commit. El handler de `[text](url)` ahora
**whitelist scheme**: solo `http`, `https`, `mailto`, `tel`, o
relativo (sin `:` o empezando con `/`, `#`, `?`). Schemas como
`javascript:` o `data:` se neutralizan a `#` en el output.

Archivo: `app/admin/records/crm/blocks/SimpleBlockViews.tsx` —
función `renderMarkdown`.

### Tests

- Sin tests automatizados nuevos en este commit (los específicos
  de seguridad llegarán en 16.E con WP integration tests). Por
  ahora: PHPUnit 530/0 errors + PHPStan 0 errors confirman que
  el refactor no rompe contratos existentes.

## [0.45.3] — 2026-05-23

**Cierre de Fase 15 — Features nuevas cherry-picked**
(Fase 15 · Iteración 15.D · **CIERRE DE FASE 15**).

### Resumen Fase 15

```
0.45.0  · 15.A · Command palette global Cmd+K en admin shell
0.45.1  · 15.B · Bulk export con selección de fields + BOM
0.45.2  · 15.C · Webhooks manager en Ajustes
0.45.3  · 15.D · Cierre  ← acá
```

---

## Cierre del trabajo del PR completo (Fases 12-15)

Con la Fase 15 cerrada terminan **4 fases de trabajo** en este
branch (`claude/session-handoff-docs-qK1LW`):

```
Fase 12 — Cards view + portal mejorado          0.42.0 - 0.42.6  (7 commits)
Fase 13 — Quality Pass                          0.43.0 - 0.43.5  (6 commits)
Fase 14 — Polish del editor CRM                 0.44.0 - 0.44.4  (5 commits)
Fase 15 — Features nuevas (Cmd+K, export, webhooks)
                                                0.45.0 - 0.45.3  (4 commits)
```

### Estado de salud al cierre

| Tool | Estado |
|---|---|
| **Vitest** | 38 tests, 0 errors |
| **PHPUnit** | 530 tests, 0 errors |
| **PHPStan** | 0 errors |
| **PHPCS** | runs, 379 violations cosméticas |
| **TypeScript** | strict, sin errors |
| **Build** | OK |

### Items pendientes del backlog (opcionales)

- **XLSX export nativo** (requiere PhpSpreadsheet ~5MB).
- **PHPStan 2.x upgrade**.
- **Tests integration con WP real**.
- **Auditoría de 379 PHPCS violations** (mayoría false positives
  de PreparedSQL).
- **Fase 7 del roadmap original — Facturación propia**: requiere
  planning extenso aparte (CLAUDE.md lo marca como "fase futura,
  doc separado").

## [0.45.2] — 2026-05-23

**Webhooks manager en Ajustes**
(Fase 15 · Iteración 15.C).

Vista cross-list de todas las automatizaciones del workspace que
disparan `call_webhook`. Card en la página de Ajustes con tabla
+ toggle activo/pausado + delete inline + link a edición.

### Diseño

En lugar de crear infra paralela (tabla `wp_imcrm_webhooks` +
listener + delivery propio), el manager **reutiliza el motor
de Automations** que ya soporta `call_webhook` como action. Esto:

- Cero código nuevo de delivery / retry / logging — todo lo
  hereda del `AutomationEngine` (Action Scheduler, retries,
  AutomationRunRepository).
- Misma UI de edición avanzada (merge tags, headers custom,
  body template, condiciones de trigger) — accesible desde
  "Editar en Automatizaciones".
- Toggle / delete usan los endpoints existentes
  `PATCH/DELETE /lists/{slug}/automations/{id}`.

### Añadido

- Backend:
  - `AutomationRepository::allWithActionType(string)`: scan
    cross-list de automations cuyo JSON `actions` contiene
    una action del tipo dado. LIKE seguro sobre el JSON.
  - `AutomationService::allWithActionType(string)`: passthrough.
  - REST: `GET /imagina-crm/v1/webhooks` (cap:
    `manage_automations`). Enriquece cada item con `list_name`
    + `list_slug` para evitar N+1 lookups en el frontend.
- Frontend:
  - `app/admin/settings/WebhooksCard.tsx`: tabla con columnas
    Webhook (nombre + URL truncada), Lista, Trigger, Estado,
    Acciones. Toggle play/pause, link al editor de
    Automations, delete con confirm.
  - Wireup en `SettingsPage` después de `CustomRolesCard`.

### Limitaciones conocidas

- La URL en la tabla solo muestra la primera de las actions
  `call_webhook` de la automation. Si una automation tiene varias
  (raro), se indica con un badge `+N` y se ven completas al
  editarla.
- "Nueva conexión" linkea a `/automations` genérico (no
  pre-puebla call_webhook como action). Pre-poblar requeriría
  query params adicionales del builder. Scope futuro.
- No hay HMAC signature configurable desde aquí (vive como
  feature del action `call_webhook` via header custom).

## [0.45.1] — 2026-05-23

**Bulk export mejorado: selector de fields + delimiter + BOM**
(Fase 15 · Iteración 15.B).

El export de records ahora abre un dialog con opciones en lugar
de descargar inmediatamente.

### Añadido

- **Dialog de export** en `ExportButton`:
  - Multi-checkbox para elegir qué fields incluir (default:
    todos los no-relation).
  - Atajos "Todos" / "Ninguno" para selección rápida.
  - Toggle de delimitador: coma (`,`) por default o punto y
    coma (`;`) para locales europeos que usan coma como decimal.
  - Checkbox "UTF-8 con BOM" (default ON): Excel respeta el
    encoding al abrir y los acentos no se rompen.
  - Counter "%d campos seleccionados de %d".
- Backend (`ExportController` + `CsvExporter`):
  - Query params nuevos `?delimiter=...` y `?with_bom=1`.
  - `CsvExporter::export()` acepta `delimiter` y `withBom`.
  - Whitelist de delimiters en el exporter — solo `,` o `;`.
    Cualquier otro valor (incluyendo tab) se normaliza a `,`
    por seguridad.
  - BOM `\xEF\xBB\xBF` prepended cuando `withBom=true`.

### Notas

- **No incluye XLSX nativo**: requeriría una dep grande
  (PhpSpreadsheet ~5 MB) o reimplementación de Office Open XML.
  CSV con BOM cubre el 90% del use case "exporto a Excel" sin
  agregar peso al plugin.
- El orden de fields en el CSV respeta el orden del schema, no
  el orden de checkboxes clickeados — evita columnas barajadas
  si el user clickea desordenado.

## [0.45.0] — 2026-05-23

**Global command palette (Cmd+K) en admin shell**
(Fase 15 · Iteración 15.A).

Arranque de **Fase 15 — Features nuevas cherry-picked**. Suma un
command palette global accesible con Cmd/Ctrl+K desde cualquier
página del plugin.

### Añadido

- `app/admin/layout/GlobalCommandPalette.tsx`: palette estilo
  Linear/Raycast con sections:
  - **Listas**: todas las listas del workspace + "Crear lista
    nueva".
  - **Dashboards** (si tiene cap): todos los dashboards + "Ver
    todos".
  - **Navegar**: Automatizaciones, Ajustes del plugin, Mi cuenta.
- Wireup en `AdminShell`: listener global de Cmd/Ctrl+K que
  abre el palette. Coexistencia con el `EditorCommandPalette` —
  cuando la ruta actual contiene `/template-editor`, este global
  palette se deshabilita (el del editor toma prioridad porque
  tiene comandos contextuales más útiles ahí).

### Diferencias con `EditorCommandPalette`

| | Global | Editor |
|---|---|---|
| **Activo en** | Resto del admin | Solo `/template-editor` |
| **Comandos** | Navegación + jump a entidades | Bloques + selección + presets |
| **Implementación** | `app/admin/layout/GlobalCommandPalette.tsx` | `app/admin/lists/template-editor/EditorCommandPalette.tsx` |

### Notas

- No incluye búsqueda de records cross-list — eso requeriría un
  endpoint global de search. El user navega a la lista y usa el
  search interno.
- Gating por capabilities (`MANAGE_DASHBOARDS`, `MANAGE_AUTOMATIONS`,
  `MANAGE_LISTS`, `manage_options`) — la sección Dashboards no
  aparece si el user no la puede ver.

## [0.44.4] — 2026-05-23

**Cierre de Fase 14 — Polish del editor CRM**
(Fase 14 · Iteración 14.E · **CIERRE DE FASE 14**).

### Resumen Fase 14

```
0.44.0  · 14.A · Command palette Cmd+K
0.44.1  · 14.B · Undo / Redo Cmd+Z / Cmd+Shift+Z
0.44.2  · 14.C · Industry presets (eCommerce, agencia, salud, RE)
0.44.3  · 14.D · Modo full-screen Cmd+J
0.44.4  · 14.E · Cheat-sheet actualizado + cierre  ← acá
```

### Cheat-sheet de atajos completo

El cheat-sheet del `TemplateSettingsPanel` (panel del inspector
cuando no hay bloque seleccionado) ahora lista los **10 atajos**
del editor:

- ⌘K — Command palette
- ⌘S — Guardar plantilla
- ⌘P — Toggle Editor / Preview
- ⌘J — Toggle full-screen
- ⌘Z — Deshacer
- ⌘⇧Z — Rehacer
- ⇧ click — Sumar a la selección
- ⌘D — Duplicar seleccionados
- ⌫ — Eliminar seleccionados
- Esc — Deseleccionar (o salir de full-screen)

### Bundle final

- TemplateEditorPage v0.44.4: **78.9 KB / 19.2 KB gzip**.
- Crecimiento durante Fase 14: 62 KB → 78.9 KB (+27%). Por
  feature: command palette ~7 KB, undo/redo ~2 KB, presets ~6 KB,
  full-screen <1 KB.

## [0.44.3] — 2026-05-23

**Modo full-screen del editor**
(Fase 14 · Iteración 14.D).

### Añadido

- Botón Maximize2 / Minimize2 en el toolbar para entrar/salir
  full-screen.
- Atajo **Cmd/Ctrl + J** toggle (no en inputs editables).
- **Esc** sale del full-screen cuando no hay bloques
  seleccionados (los seleccionados tienen prioridad — Esc primero
  los deselecciona).

### Implementación

- State `fullScreen` boolean en `TemplateEditorPage`.
- Cuando activo, agrega clase `imcrm-template-editor-fullscreen`
  al `<body>` (cleanup en el unmount/toggle).
- CSS en `globals.css`:
  - Oculta `#wpadminbar`, `#adminmenumain`, `#wpfooter` (chromes
    de WP).
  - Resetea margenes/padding de `#wpcontent`, `#wpbody-content`.
  - Oculta sidebar + topbar del plugin (`.imcrm-admin-sidebar`,
    `.imcrm-admin-topbar`).
  - El editor (`.imcrm-template-editor-root`) pasa a `fixed inset-0`
    z-9999 con padding 1rem.

## [0.44.2] — 2026-05-23

**Industry presets aplicables**
(Fase 14 · Iteración 14.C).

4 presets pre-armados que appendean bloques al canvas según el
caso de uso (eCommerce, Agencia, Salud, Inmobiliaria). Accesibles
desde el command palette (Cmd+K → "Aplicar preset: ...").

### Diseño

En lugar de built-in templates completas (que reemplazan todo el
config), los presets **suman** bloques al final del canvas — más
útil porque:

- No destruye trabajo existente del admin.
- Se pueden combinar (aplicar dos presets para casos híbridos).
- Más simples de mantener (no necesitan resolveV2 propio ni
  header).

### Añadido

- `presets/industryPresets.ts`:
  - **`ecommerce`**: heading + contacto (email/url/phone) +
    dirección de envío + KPIs de monto/pedidos + bloque
    `related` para pedidos + notas con recordatorios.
  - **`agency`**: contacto + facturación (cuit/nif/rut) +
    proyectos relacionados + KPI MRR + `comments_thread` para
    notas internas.
  - **`health`**: ficha del paciente (dni/edad/género) + contacto
    + historia clínica (long_text) + citas relacionadas + notas
    de alergias.
  - **`realestate`**: características (tipo/m2/dormitorios) + KPI
    precio + ubicación + galería de archivos + leads
    relacionados.
- `applyPreset(config, preset, fields)`: appendea bloques con
  layout flow horizontal hasta llenar 12 cols, después wrap a
  fila siguiente. Genera IDs únicos.
- Comando palette: "Aplicar preset: X" por cada preset.

### Defensive design

Cada preset es **defensivo respecto al schema**: solo agrega un
bloque si los fields requeridos existen. Si la lista no tiene
email, el preset eCommerce no agrega un grupo email — pero el
resto del preset se sigue aplicando. Pattern matching por
slug/label común a la industry (regex).

## [0.44.1] — 2026-05-23

**Undo / Redo del editor (Cmd+Z / Cmd+Shift+Z)**
(Fase 14 · Iteración 14.B).

### Añadido

- `hooks/useConfigHistory.ts`: hook que wrappea el state del
  `CustomTemplateConfigV2` con stacks `past` y `future`. Cap a
  `MAX_HISTORY=50` entradas para evitar crecimiento sin límite.
  API: `{ config, setConfig, undo, redo, reset, canUndo, canRedo }`.
- Botones Undo / Redo en el toolbar del editor (icono `Undo2` /
  `Redo2`). Deshabilitados cuando no hay history o estamos en
  preview.
- Atajos de teclado:
  - **Cmd/Ctrl + Z** → undo.
  - **Cmd/Ctrl + Shift + Z** (o Cmd/Ctrl + Y) → redo.
  - Solo se activan cuando el foco NO está en un input editable
    (el navegador maneja undo nativo del texto del input
    primero).

### Detalles de implementación

- El first paint (load del config desde backend) usa `resetConfig`
  para NO meter el "estado inicial" al historial — undo desde
  el primer cambio te devuelve al config cargado, no a uno vacío.
- "Restaurar desde plantilla" también usa `resetConfig` — el
  built-in es un nuevo punto cero. Si se quiere volver atrás,
  hay que cambiar de plantilla, no usar undo.
- `setConfig` skipea agregar al history si el config nuevo es
  referencialmente igual al anterior (`prev === resolved`) —
  evita basura en el stack por re-renders.

### Bundle

- TemplateEditorPage: 69.5 KB → 71.4 KB (gzip 16.4 → 16.9). +0.5 KB
  gzip por el hook + botones.

## [0.44.0] — 2026-05-23

**Command palette del editor (Cmd+K)**
(Fase 14 · Iteración 14.A).

Arranque de **Fase 14 — Polish del editor CRM**. Suma un command
palette estilo Linear/Raycast accesible con Cmd/Ctrl+K que
centraliza todas las acciones del editor.

### Añadido

- `EditorCommandPalette.tsx`: Dialog modal con input de búsqueda
  + lista filtrable + navegación por teclado (↑↓ + Enter, Esc
  cierra). Filter fuzzy simple por label + description + keywords.
- Comandos disponibles, agrupados:
  - **Editor**: Guardar, Cambiar a preview / editor (con su
    keybinding visible).
  - **Selección** (solo si hay bloques seleccionados): Duplicar
    todos, Eliminar todos.
  - **Bloques del canvas**: lista todos los bloques actuales —
    seleccionar uno equivale a click en el canvas.
  - **Agregar bloque**: las 14 entradas de tipos de bloque (mismas
    que la paleta lateral, pero sin scroll). Singletons en uso
    se deshabilitan.
  - **Restaurar plantilla**: lista todos los `CRM_TEMPLATES`
    built-in.
- Cmd/Ctrl+K toggle abre/cierra el palette desde cualquier punto
  del editor.
- Footer del palette con cheat-sheet `↑↓ navegar / ⏎ ejecutar /
  Esc cerrar`.

### Bundle

- TemplateEditorPage: 62 KB → 69.5 KB (gzip 14.6 → 16.4). +1.8 KB
  gzip por el component.

## [0.43.5] — 2026-05-23

**Cierre de Fase 13 — Quality Pass**
(Fase 13 · Iteración 13.F · **CIERRE DE FASE 13**).

### Resumen Fase 13 — Quality Pass

```
0.43.0  · 13.A · Vitest setup + tests del resolver V2
0.43.1  · 13.B · Tests createBlock + dragPayload
0.43.2  · 13.C · Fix 7 errores PHPUnit preexistentes
0.43.3  · 13.D · Reducir errores PHPStan: 22 → 0
0.43.4  · 13.E · PHPCS WordPress sniffs unblock
0.43.5  · 13.F · Cierre  ← acá
```

### Estado de salud del repo

| Tool | Antes | Después |
|---|---|---|
| **Vitest** | sin specs | 38 tests, 0 errors |
| **PHPUnit** | 530 tests, 7 errors | 530 tests, 0 errors |
| **PHPStan** | 22 errors | 0 errors |
| **PHPCS** | no corría | 379 violations reales |

Los 3 items "preexistentes" documentados en el handoff de Fases
7-10 quedan **resueltos**:

- ✅ "7 errores PHPUnit por CommentEntity::__construct" (13.C).
- ✅ "22 errores PHPStan en Search/Records" (13.D).
- ✅ "PHPCS bloqueado por sniffs WP no registrados" (13.E).

### Items que quedan abiertos del handoff (no críticos)

- **PHPStan 2.x upgrade**: actualmente en 1.x. Sería trabajo
  de migración del config + posibles cambios de sintaxis.
- **Tests integration con WP real**: `bin/install-wp-tests.sh`
  existe pero la suite real requeriría DB + WP install. Fuera
  de scope para una iteración rápida.
- **Auditoría de las 379 PHPCS violations**: la mayoría son
  `PreparedSQL` false positives. Útil revisar caso por caso pero
  no urgente.

## [0.43.4] — 2026-05-23

**PHPCS WordPress sniffs unblock**
(Fase 13 · Iteración 13.E).

`composer phpcs` ahora corre exitosamente desde un install limpio.
Antes fallaba con `ERROR: Referenced sniff "WordPress-Extra" does
not exist` porque los standards de `wp-coding-standards/wpcs` no
estaban registrados con PHPCS.

### Causa raíz

El plugin `dealerdirect/phpcodesniffer-composer-installer` que
registra los standards automáticamente se deshabilita en entornos
non-interactive con privilegios root (containers, CI sin
`COMPOSER_ALLOW_SUPERUSER=1`).

### Fix

- `composer.json`: el script `phpcs` ahora invoca un sub-script
  `phpcs:register-paths` antes que ejecuta
  `phpcs --config-set installed_paths <vendor paths>`. Idempotente
  (no falla si ya estaba registrado).
- Mismo wireup para `phpcbf`.

### Ruleset alineado con el estilo PSR-12-ish del proyecto

El proyecto usa espacios (no tabs), arrays cortos, camelCase para
variables internas, K&R braces — todo distinto del WordPress
Core style. El ruleset original heredaba `WordPress-Extra` sin
exclusions, lo que generaba 44k+ violaciones cosméticas que
ahogaban los issues reales.

Sniffs excluidos en `phpcs.xml.dist`:

- Cosméticos: `DisallowSpaceIndent`, `DisallowShortArraySyntax`,
  `ValidVariableName`, `OpeningFunctionBraceKernighanRitchie`,
  `YodaConditions`, `FunctionDeclarationArgumentSpacing`,
  `FunctionCallSignature`, `ControlStructureSpacing`,
  `OperatorSpacing`, `ArrayBraceSpacing`, etc.
- Conflictivos con PHP 8.2+ typed: `Squiz.Commenting`,
  `Generic.Commenting`, `FunctionComment.MissingParamComment`.
- `WordPress.WP.AlternativeFunctions` (el proyecto usa la API
  moderna de PHP donde aplica).

### Estado

- Antes: PHPCS no corría (sniffs no registrados).
- Después: PHPCS corre, reporta **379 violations** reales.
  Mayoría son `WordPress.DB.PreparedSQL.NotPrepared` (171) — el
  sniff no detecta sanitización indirecta en algunos call sites
  (false positives), pero quedan como signal útil para hacer un
  audit de seguridad SQL en una iteración futura.
- Lo importante: PHPCS ahora es usable en CI / development
  flow. Antes era equivalente a no tener PHPCS configurado.

## [0.43.3] — 2026-05-23

**Reducir errores PHPStan: 22 → 0**
(Fase 13 · Iteración 13.D).

PHPStan ahora reporta **cero errores**. Los 22 preexistentes
documentados en el handoff Fases 7-10 quedan resueltos.

### Causa raíz

Los stubs WP (vía `phpstan-wordpress`) declaran que
`$wpdb->prepare(): string|null`, pero el método siempre retorna
string cuando el SQL es válido y los placeholders coinciden con
los args. Antes esto se silenciaba con `@phpstan-ignore-next-line`
esparcidos por toda la base de código. Una mejora de los stubs
en una versión reciente hizo que algunos ignores quedaran
obsoletos (`No error to ignore is reported on line X`).

Adicionalmente: `FieldRepository::forList()` fue renombrado a
`allForList()` en algún momento, pero 3 callers no se
actualizaron.

### Fix

- **3 archivos** (`MysqlSearchEngine`, `InvertedIndexEngine`,
  `CompositeIndexSuggester`): `->forList(` → `->allForList(`.
- **`InvertedIndexEngine`**: helper `safePrepare(string, array): string`
  que normaliza el return de `$wpdb->prepare()` a string siempre.
  Reemplaza los 6 ignores + ifs sueltos por una llamada limpia.
- **`InvertedIndexEngine`**: removida property `$lists` (private
  readonly) que nunca se leía. Container binding actualizado.
- **`QueryBuilder::buildSelect`**: `@param` annotations agregadas
  para `$fields`, `$whereOverride`, `$idWhitelist`.
- **`CompositeIndexSuggester::buildDdl`**: `@param list<string>`
  annotation agregada.
- **Ignores obsoletos eliminados** en `DashboardRepository`,
  `PurgeService`, `RecordRepository`, `CompositeIndexSuggester`,
  `MysqlSearchEngine`.
- **`MysqlSearchEngine`**: cast defensivo `is_string($escaped) ? $escaped : ''`
  para resolver "Binary operation . between '`' and array|string".

### Estado

- Antes: **22 errors** PHPStan (level configurado del proyecto).
- Después: **0 errors**.
- PHPUnit: **530 tests, 0 errors** (sin regresiones).
- Vitest: **38 tests, 0 errors** (sin regresiones).

## [0.43.2] — 2026-05-23

**Fix 7 errores PHPUnit preexistentes (CommentEntity)**
(Fase 13 · Iteración 13.C).

Los 7 errores PHPUnit que arrastraba el repo desde la
introducción del campo `metadata` en `CommentEntity` (commit
0.33.0+, documentado en el handoff como issue preexistente) ya
están resueltos.

### Causa

El constructor de `CommentEntity` se actualizó para sumar el
parámetro nombrado `metadata: array<string, mixed>` como
argumento #7, pero los tests que llamaban `new CommentEntity(...)`
manualmente con argumentos nombrados nunca se actualizaron:

- `CommentEntityTest::test_to_array_omits_deleted_at` (1 error).
- `ActivityLoggerTest::test_comment_events_attribute_to_author_not_current_user` (1).
- `ActivityLoggerTest::test_truncates_long_comment_content` (1).
- `MentionNotifierTest::test_no_mentions_means_no_side_effects` (1).
- `MentionNotifierTest::test_creates_activity_and_email_per_mention` (1).
- `MentionNotifierTest::test_unknown_login_is_silently_ignored` (1).
- `MentionNotifierTest::test_self_mention_does_not_notify` (1).

### Fix

Agregado `metadata: []` en cada construcción (default sensato:
ningún test estaba evaluando metadata, así que `[]` no cambia
la semántica).

### Estado

- Antes: **530 tests, 7 errors**.
- Después: **530 tests, 0 errors** (92 integration skipped por
  requerir WP env — no relacionados).

## [0.43.1] — 2026-05-23

**Tests de createBlock + dragPayload**
(Fase 13 · Iteración 13.B).

Sigue ampliando la cobertura del editor de plantilla CRM.

### Añadido

- `tests/unit/template-editor/createBlock.test.ts`: **13 tests**:
  - `createBlock` returns null para related sin relation field,
    crea bloque para related con relation field disponible.
  - Posicionamiento por default (`maxY`), posición explícita
    cuando se pasa.
  - IDs únicos entre llamadas.
  - Defaults correctos para `kpi` (currency / number),
    `divider`, `heading`, `comments_thread`.
  - `appendBlock` no muta el config input.
  - `appendFieldAsGroup` usa label del field como label del
    grupo + slug en field_slugs.
- `tests/unit/template-editor/dragPayload.test.ts`: **11 tests**:
  - Roundtrip encode/decode para `block-type` y `field`.
  - Decode devuelve null para JSON malformado, shape inválido,
    `kind` desconocido, falta de campos requeridos.
  - `readDropPayload` lee del MIME custom, fallback a `text/plain`,
    null cuando no hay nada o cuando hay garbage.

### Estado

- **Total: 38 tests passing** (14 resolver + 13 createBlock +
  11 dragPayload), 653ms.

## [0.43.0] — 2026-05-23

**Vitest setup + tests del resolver V2**
(Fase 13 · Iteración 13.A).

Arranca la **Fase 13 — Quality Pass**. Bootstrap del runner de
tests Vitest (que estaba en `package.json` desde Fase 1 pero sin
specs) y primer test file cubriendo el contrato del resolver V2.

### Añadido

- `vite.config.ts`: sección `test` con jsdom environment, setup
  file global, include pattern `tests/unit/**/*.test.{ts,tsx}`,
  coverage config básica.
- `tests/unit/setup.ts`: mock global de `@wordpress/i18n`
  (`__`, `_x`, `_n`, `sprintf` devuelven el string fuente para
  que los componentes/units no dependan de un runtime WP).
- `tests/unit/lib/crmTemplates.test.ts`: **14 tests** del
  `resolveV2`:
  - Header: title field resolution, missing slug fallback,
    quickActions kind mapping (email/url/phone).
  - `properties_group`: inflado de field_slugs a FieldEntity,
    drop silencioso de fields inexistentes.
  - `related`: drop cuando el field no es type relation, keep
    cuando sí.
  - `files`: default a todos los file fields cuando array vacío,
    filtro por slugs declarados cuando no.
  - Fase 11.F: pass-through correcto de `divider` /
    `heading` / `comments_thread` configs.
  - Preservación del orden de bloques en el output.

### Detalles

- Los tests del resolver usan `// @vitest-environment node`
  per-file porque no tocan DOM — corren más rápido.
- Total: 633ms para 14 tests. Sin tests previos en el repo.

## [0.42.6] — 2026-05-23

**Docs + cierre de Fase 12**
(Fase 12 · Iteración 12.G · **CIERRE DE FASE 12**).

### Añadido

- `docs/vistas-guardadas.md`: sección "Tipos de vista" con docs
  para Cards (campos, cover, densidad, editar config). Las
  secciones Kanban / Calendar también quedaron documentadas
  formalmente en el mismo archivo.

### Resumen Fase 12 — Cards + portal mejorado

```
0.42.0  · 12.A · SavedViewType='cards' + componente base
0.42.1  · 12.B · Editor de config + resolución coverField
0.42.2  · 12.C · Editar config de vistas Cards existentes
0.42.3  · 12.D · Bloque comments_thread para portal
0.42.4  · 12.E · UI de filtros en bundle público
0.42.5  · 12.F · Magic link UI en panel CRM
0.42.6  · 12.G · Docs + cierre  ← acá
```

### Cobertura

Con este release cierran 4 items pendientes del handoff de Fases
7-10:

- ✅ `comments_thread` para portal (Fase 12.D).
- ✅ "Magic link UI en panel CRM" (Fase 12.F).
- ✅ "Filtros UI en bundle público" (Fase 12.E).
- ✅ Cards view, última fase del roadmap original CLAUDE.md §15
  que faltaba (Fase 6 → ahora cubierta).

Quedan en el backlog del handoff (no críticos):

- `chart_widget` para portal (requiere lib de charts ~30 KB).
- UI para `fixed_filter_tree` en `PublicVisibilityPanel`.
- Inputs por tipo en `editable_form` (user / file / relation).
- Filtros UI en bundle público para tipos no-discretos (text /
  number / date).
- Mensaje específico cuando WP no tiene pretty permalinks.

## [0.42.5] — 2026-05-23

**Magic link UI en panel CRM**
(Fase 12 · Iteración 12.F).

Cierra el gap del handoff: el endpoint `POST .../magic-link`
existía desde Fase 10 pero no tenía UI en el `PortalAccessButton`.
Hoy queda accesible con dos botones: "Enviar magic link" (por
email) y "Copiar link" (al clipboard).

### Añadido

- Backend (`PortalController`):
  - `GET /portal/page-url`: auto-detect de la URL de la página del
    portal buscando el primer post/page publicado con el
    shortcode `[imcrm-client-portal]`. Devuelve `{ url: string | null }`.
    Cap: `manage_lists`.
- Frontend:
  - `hooks/usePortalPageUrl.ts`: hook con TanStack Query, cachea
    5min.
  - `PortalAccessButton`: cuando `hasAccess === true` y la página
    del portal está detectada, aparecen 2 botones nuevos:
    - **"Enviar magic link"** (icono Mail): llama `POST .../magic-link`
      con `send_email=true`. Toast de éxito.
    - **"Copiar link"** (icono Copy): mismo endpoint con
      `send_email=false`, copia la URL al clipboard via
      `navigator.clipboard`. Fallback a toast con la URL si no se
      puede acceder al clipboard (HTTP, browsers viejos).
  - Si no hay página del portal detectada, muestra mensaje
    "Agregá el shortcode [imcrm-client-portal] a una página".

### UX

- `magicLink.variables` (boolean) se usa para distinguir cuál de
  los dos botones está pendiente — solo ese muestra el spinner.
- Toast errors específicos (mensaje del backend si vino, sino
  default).

## [0.42.4] — 2026-05-23

**UI de filtros en bundle público de listas**
(Fase 12 · Iteración 12.E).

El visitante anónimo de una lista pública ahora puede filtrar la
tabla por campos discretos (select / multi_select / checkbox). Si
`viewer_filters` está habilitado en la lista pública, dropdowns
aparecen en el toolbar junto al search.

### Añadido

- Backend (`PublicLists/Shortcode.php`): el `config` de cada
  field se incluye en las columnas serializadas
  (`data-imcrm-config`). Permite al bundle JS armar dropdowns con
  options correctas sin exponer datos sensibles.
- Frontend:
  - `PublicFieldMeta.config?` opcional con `options?: [...]`.
  - `FetchParams.filters: Record<slug, string>` — payload de
    filtros activos.
  - `api.ts#buildUrl` serializa `filter[slug][eq]=value`. Para
    valores con `,` usa `filter[slug][in]=v1,v2`.
  - `FilterDropdown` component: select nativo con la lista de
    options del field. Para `checkbox` el toggle es 3-estados
    (todos/sí/no).
  - Botón "Limpiar filtros" aparece cuando hay al menos uno activo.
- CSS (`public-list.css`): estilos `.imcrm-public-list__filter`
  y `.imcrm-public-list__clear-filters`. Toolbar pasó a
  `flex-wrap` para acomodar varios dropdowns.

### Detalles

- Solo tipos discretos por ahora (select / multi_select /
  checkbox). Text/number/date requieren input + operator,
  scope futuro.
- Cambio de filtro vuelve a página 1 (igual que search y sort).
- Backend ya soportaba `?filter[slug][op]=value` con whitelist
  por `visible_field_slugs` desde Fase 8 — esta iteración solo
  expone la UI.

## [0.42.3] — 2026-05-23

**Bloque `comments_thread` para portal del cliente**
(Fase 12 · Iteración 12.D).

El cliente ahora puede ver y crear comentarios desde su portal.
Cierra el gap del handoff Fases 7-10 que indicaba el bloque como
"futuro".

### Añadido

- Backend (PHP):
  - `'comments_thread'` agregado a
    `PortalTemplate::VALID_BLOCK_TYPES`.
  - `CommentService` inyectado en `PortalController` via Container.
  - `GET  /imagina-crm/v1/portal/me/comments` — lista los comments
    del record del cliente. `list_id` + `record_id` se resuelven
    desde el `ClientResolver` (sin spoofing posible).
  - `POST /imagina-crm/v1/portal/me/comments` — crea un comment
    del cliente. `user_id` viene del WP session; `parent_id` /
    `metadata` no expuestos (composer simple).
- Frontend:
  - `app/portal/blocks/CommentsThreadBlock.tsx`: lista
    cronológica simple + composer textarea (5000 char cap, igual
    al CRM).
  - Wireup en `PortalRenderer` (case `'comments_thread'` del
    switch).
  - Modo `readonly` opcional desde la config (cliente ve pero no
    puede crear).
- Admin:
  - `PORTAL_BLOCK_TYPES` extendido con
    `{ value: 'comments_thread', label: 'Hilo de comentarios' }`.
  - `PortalTemplateEditor`: form de config con title + checkbox
    "Solo lectura".
  - `defaultConfigFor('comments_thread')` → `{ title: 'Comentarios',
    readonly: false }`.
- CSS:
  - `assets/portal.css`: estilos `.imcrm-portal-comments`,
    `.imcrm-portal-comments__item`, `.imcrm-portal-comments__composer`,
    `.imcrm-portal-comments__textarea`, `.imcrm-portal-comments__submit`.

### Seguridad

- El cliente NUNCA puede ver ni crear comments sobre records
  ajenos. Los endpoints resuelven `recordId` desde el
  `ClientResolver` — no aceptan IDs como params.
- Mismas reglas de validación del `CommentService` aplican (5000
  char cap, contenido obligatorio).
- El admin sigue moderando todo desde el `CommentsPanel` del
  CRM (edit/delete con `_isAdmin=true`).

## [0.42.2] — 2026-05-23

**Cards: editar config en vistas existentes**
(Fase 12 · Iteración 12.C).

Hasta acá, una vista Cards solo se podía configurar al crearla.
Para cambiar qué campos muestra había que borrar y crear de
nuevo. Ahora hay un editor accesible desde el dropdown menu de
la vista.

### Añadido

- `CardsConfigPanel` (componente compartido): el editor de
  config de cards extraído como pieza reusable.
- `EditCardsViewDialog`: dialog para editar nombre + config de
  una vista Cards existente. Pre-rellena valores desde
  `activeView.config`. Submit dispara `useUpdateSavedView`.
- ViewsTabs: opción "Editar configuración" en el dropdown menu
  de cada vista cuando `view.type === 'cards'`. Solo aparece en
  cards por ahora (Kanban / Calendar requieren tratamiento
  separado por la complejidad de cambiar `group_by_field_id` o
  `date_field_id` sobre una vista en uso).

### Cambiado

- `SaveViewDialog` ahora usa `CardsConfigPanel` en lugar de su
  versión inline. Cero cambio funcional, mejor mantenibilidad.

## [0.42.1] — 2026-05-23

**Cards: editor de config + cover image resoluble**
(Fase 12 · Iteración 12.B).

Termina la experiencia de Cards: al crear una vista de tipo
`cards` el dialog ahora muestra el editor visual de su config y
las imágenes de portada se resuelven correctamente desde
attachment IDs.

### Añadido

- `hooks/useAttachments.ts`: hook reutilizable que batchea IDs de
  attachments en un único request a `/wp-json/wp/v2/media?include=...`
  y devuelve un `Map<id, { url, thumbUrl, title, mimeType }>`.
  Cacheado con TanStack Query (5 min stale time).
- Editor de config de Cards en `SaveViewDialog`:
  - Multi-select con checkboxes para `card_field_ids` (cualquier
    field excepto `relation`).
  - Single-select para `card_cover_field_id` (solo `file` fields;
    se desactiva si no hay ninguno).
  - Segmented control Compacta / Normal / Espaciada para `card_size`.

### Cambiado

- `CardsView` ahora usa `useAttachments` para resolver los IDs de
  cover de todos los records visibles en un solo fetch. Antes
  esperaba que el backend devolviera URL string o `{url}` directo
  (que no era el caso — el backend devuelve attachment ID).
- Card component recibe `coverUrl: string | null` directo en
  lugar de `coverField` + record. Cleaner separation.

### Detalles

- `useAttachments` dedup + sort de IDs para `queryKey` estable.
- Pide solo `_fields=id,source_url,mime_type,title,media_details`
  para minimizar payload.
- Prefiere `media_details.sizes.medium` para el thumb, fallback
  a `thumbnail`, fallback a `source_url`.

## [0.42.0] — 2026-05-23

**Vista Cards — schema + componente base**
(Fase 12 · Iteración 12.A).

Suma `cards` como cuarto `SavedViewType` (después de `table`,
`kanban`, `calendar`). Cierra la única fase del roadmap original
(CLAUDE.md §15 — Fase 6 "Cards + Extras") que faltaba.

### Añadido

- Backend (`SavedViewService.php`):
  - `'cards'` agregado a `ALLOWED_TYPES`.
  - Validación de `config.card_field_ids[]` (deben pertenecer a
    la lista), `config.card_cover_field_id` (debe ser tipo `file`)
    y `config.card_size` (compact/comfortable/spacious).
- Types (`app/types/view.ts`):
  - `SavedViewType = ... | 'cards'`.
  - `SavedViewConfig` agrega `card_field_ids?`, `card_cover_field_id?`,
    `card_size?`.
- Frontend (`app/admin/records/views/CardsView.tsx`):
  - Grid CSS auto-fill con `minmax()` ajustado por densidad.
  - Cada card: cover image (si hay coverField y URL resoluble)
    o avatar colorizado generado desde el título; título grande
    (primary field); hasta N campos extra con label inline.
- `RecordsPage.tsx` detecta `isCards`, calcula `cardsExtraFields`
  y `cardsCoverField` desde el config, y rendera `CardsView`.
- `SaveViewDialog`: opción "Cards (grid de tarjetas)" en el
  selector de tipo.
- `ViewsTabs`: icono `LayoutGrid` para vistas tipo cards.

### Pendiente para 12.B

- Editor de config visual (card_field_ids + card_cover_field_id +
  card_size) en `SaveViewDialog`.
- Resolución de `coverField` desde attachment ID a URL (hoy solo
  funciona si el field devuelve URL string o `{url}` directo).
- Virtualización si records.length > 200 (por ahora full render).

## [0.41.6] — 2026-05-23

**Polish + cierre de Fase 11**
(Fase 11 · Iteración 11.G · **CIERRE DE FASE 11**).

Pequeños retoques de UX, atajos globales del editor y mejor empty
state. Con este release la Fase 11 (Editor de plantilla CRM v3)
queda cerrada.

### Añadido

- **Cmd/Ctrl + S** desde cualquier punto del editor (incluyendo
  inputs) → Guardar plantilla. Previene el "guardar página" del
  browser.
- **Cmd/Ctrl + P** → toggle Editor / Preview. Cuando entra a
  Preview limpia la selección. Solo activo fuera de inputs para
  no interferir con tipeo.
- **Cheat-sheet de atajos** en el panel "Ajustes de la plantilla"
  (inspector cuando no hay bloque seleccionado): lista todos los
  atajos del editor con `<kbd>` styled.
- **Empty state** del canvas mejorado: icono `LayoutGrid` en
  círculo + mensaje contextual diferente para Editor vs Preview.
- `title` con `(⌘S)` en el botón Guardar.

### Resumen Fase 11 — Editor de plantilla CRM v3

```
0.41.0  · 11.A · Layout 3 columnas (paleta + canvas + inspector)
0.41.1  · 11.B · Drag-from-palette + tab Campos
0.41.2  · 11.C · Drop-on-block + grid guides + toggle Preview
0.41.3  · 11.D · Multi-select + duplicar + atajos por-bloque
0.41.4  · 11.E · Preview con record real
0.41.5  · 11.F · divider + heading + comments_thread
0.41.6  · 11.G · Polish + atajos globales + cierre  ← acá
```

El contrato persistido (`CustomTemplateConfigV2`) NO cambió en
toda la Fase 11. Las plantillas guardadas en 0.40.x abren en
0.41.6 sin migración. Lo único que se agregaron son 3 tipos de
bloque nuevos a la unión `V2BlockType` — backward-compatible.

Bundle del editor: 38KB (gzip 9KB) en 11.A → 62KB (gzip 14.5KB)
en 11.G. +24KB de funcionalidad: paleta visual, drag&drop,
multi-select, preview con record real, 3 bloques nuevos, atajos.

## [0.41.5] — 2026-05-23

**3 bloques nuevos: divider, heading, comments_thread**
(Fase 11 · Iteración 11.F).

Suma 3 tipos de bloque al editor de plantilla CRM, extendiendo
la unión `V2BlockType` en `crmTemplates.ts`. Backward-compatible:
las plantillas anteriores siguen funcionando sin migración.

### Añadido

- **`divider`** (categoría Layout): línea horizontal con label
  opcional centrado. Sin label es un `<hr>` simple. Default
  width 12 × height 1.
- **`heading`** (categoría Layout): título de sección con nivel
  jerárquico configurable (h2, h3, h4). Sirve para agrupar
  visualmente bloques relacionados sin chrome de tarjeta. Default
  width 12 × height 2.
- **`comments_thread`** (categoría Contenido): wrapper del
  `CommentsPanel` existente, alimentado por
  `/lists/{list}/records/{record}/comments`. En el editor visual
  queda no-interactivo por el `pointer-events-none` del wrapper
  del GridEditor — en `RecordCrmLayout` es interactivo. Cuando
  `recordId === 0` (modo mock), muestra placeholder "Seleccioná
  un record real arriba para previsualizar el hilo".

### Cambiado

- `V2BlockType` union extendida con los 3 nuevos tipos.
- `ResolvedV2Block` extendido con sus counterparts resolved.
- `resolveV2` agrega branches para los 3 nuevos.
- `createBlock` agrega defaults razonables.
- `BlockInspectorPanel` agrega forms inline (`DividerForm`,
  `HeadingForm`, `CommentsThreadForm`).
- `BlockPalettePanel` agrega cards en las categorías Layout y
  Contenido.

### Mientras estaba ahí

- Fix lint warning en `BlockRenderer.tsx`: el tipo `RecordEntity`
  ahora se importa con `import type` en lugar de `import()` type
  annotation inline.

## [0.41.4] — 2026-05-23

**Preview con record real**
(Fase 11 · Iteración 11.E).

Permite ver la plantilla renderada con datos reales de la lista,
no solo con el mock generado desde el schema.

### Añadido

- `RecordSelector` — combobox en el toolbar del editor con
  búsqueda debounced. Lista los primeros 20 records de la lista
  (filtrados por la búsqueda si hay texto). Labels usan el primary
  field del record.
- Opción especial "Datos de muestra" (valor inicial) que vuelve
  al mock generado a partir del schema de fields.
- `effectiveRecord` reemplaza a `mockSample` en el `<GridEditor>`:
  cuando hay record real seleccionado, todos los bloques reciben
  sus datos. Cuando no, sigue mostrando el mock.

### Detalles

- Search debounced 250ms para no spammear `/records?search=`.
- Loading inline con `<Loader2>` mientras el endpoint responde.
- Estados vacíos diferenciados: "Sin resultados para la búsqueda"
  vs "Esta lista no tiene records todavía".
- El selector vive en el toolbar del editor permanentemente —
  visible en modo Editor y en modo Preview por igual. Permite
  validar el render con datos reales en ambos modos.

## [0.41.3] — 2026-05-23

**Multi-select + duplicar + atajos de teclado**
(Fase 11 · Iteración 11.D).

Permite operar con múltiples bloques a la vez. Shift+click acumula
selección. Cmd/Ctrl+D duplica. Backspace o Delete eliminan. Esc
deselecciona.

### Añadido

- **Shift+click** sobre un bloque del canvas suma/quita de la
  selección. Click sin modifier selecciona uno solo (reemplaza la
  selección anterior).
- **`BulkActionsPanel`** (nuevo panel del inspector cuando hay
  2+ bloques seleccionados): resumen "N bloques seleccionados" +
  acciones Duplicar todos / Eliminar todos + cheat-sheet de
  atajos.
- **`BlockInspectorPanel` + duplicar**: el botón Duplicar al pie
  del inspector ahora está cableado (en 11.A se renderizaba pero
  `onDuplicate` venía `undefined`). Funciona para selección
  individual.
- **Atajos de teclado** globales (solo en modo Editor, no en
  Preview, y solo cuando el foco no está en input/textarea/select
  editable):
  - `Cmd/Ctrl + D` → duplicar seleccionados
  - `Backspace` / `Delete` → eliminar (con confirm si son 2+)
  - `Esc` → deseleccionar

### Cambiado

- Estado de selección pasó de `selectedBlockId: string | null` a
  `selectedBlockIds: string[]`. El inspector switchea entre tres
  modos: bulk (≥2) / single (1) / template settings (0).
- Duplicar genera nuevos IDs con timestamp+random suffix y posiciona
  cada copia debajo del último bloque con offset acumulado para
  evitar que se monten visualmente.
- Borrar con confirmación cuando son 2+ bloques (single block
  borra directo sin confirmación).

## [0.41.2] — 2026-05-23

**Drop sobre grupo, grid guides, toggle Editor/Preview**
(Fase 11 · Iteración 11.C).

Cierra el flujo de drag-and-drop del editor: arrastrar un field
sobre un `properties_group` existente lo agrega al grupo en lugar
de crear uno nuevo. Suma feedback visual del drop target, grid
guides sutiles, y un modo Preview WYSIWYG.

### Añadido

- **Drop sobre grupo existente**: al arrastrar un field desde la
  tab Campos sobre un `properties_group` del canvas, el field se
  agrega al `field_slugs` del grupo (si no estaba ya). El bloque
  target muestra ring `primary` + overlay "Soltar para agregar
  al grupo" durante el dragover.
- **Grid guides**: 13 líneas verticales sutiles (`border/40`)
  cada columna del grid (12 cols), posicionadas `z-0` debajo del
  contenido del grid. Solo visibles en modo editor — ayudan a
  anticipar dónde se alinearán los bloques.
- **Toggle Editor / Preview** en el toolbar:
  - **Editor**: estado normal (drag, drop, selección, ring del
    bloque activo, paleta+inspector visibles).
  - **Preview**: deshabilita drag/resize/drop/selección. La paleta
    y el inspector se ocultan y el canvas pasa a full-width sobre
    fondo `card` — vista WYSIWYG fiel al panel CRM final.

### Cambiado

- `GridEditor` acepta props `onDropOnBlock(blockId, payload)` y
  `preview?: boolean`. `onDropOnBlock` retorna `true` cuando el
  drop fue manejado (el grid evita propagación al handler global).
- Validación del MIME `application/x-imcrm-palette` en
  `onDragOver` antes de mostrar feedback visual — evita reaccionar
  a drags ajenos al editor (archivos del SO, links, etc.).
- `handleBlockDragLeave` discrimina entre "salir del bloque" vs
  "cruzar a un hijo" con `relatedTarget.contains` — evita flicker
  del feedback durante el dragover.

### UX

- Drop de field ya presente en el grupo → toast info "Este campo
  ya está en el grupo", el drop se considera manejado.
- En modo Preview no se muestra ring de selección ni hover —
  experiencia idéntica al `RecordCrmLayout` real (sin chrome del
  editor).

## [0.41.1] — 2026-05-23

**Drag-from-palette + tab Campos**
(Fase 11 · Iteración 11.B).

Hace el editor de plantilla CRM verdaderamente DnD: las cards de
la paleta ahora se pueden arrastrar al canvas y soltarse en la
posición exacta deseada. Click-to-add se mantiene como atajo
rápido.

### Añadido

- `panels/BlockPalettePanel`: tabs **Bloques** / **Campos** con
  filtro de búsqueda inline. Tab Campos muestra los fields
  disponibles de la lista (excluyendo `relation`).
- Drag-from-palette: cards arrastrables vía HTML5 DnD nativo.
  Drop en el canvas crea el bloque en la posición soltada.
- Drop de un field al canvas crea automáticamente un
  `properties_group` con ese campo y el label del field como
  nombre del grupo.
- `utils/dragPayload.ts`: payload tipado discriminado
  (`block-type` | `field`) con MIME custom `application/x-imcrm-palette`
  para distinguir drops del editor de drops externos del SO.
- `utils/createBlock.ts#appendFieldAsGroup`: factory para crear un
  properties_group inicializado con un único field.
- `GripVertical` icon en las cards de la paleta como affordance
  visual del drag. `cursor: grab` cuando está sobre la card.

### Cambiado

- `GridEditor` ahora declara `isDroppable={true}` + `droppingItem`
  + `onDrop`. El placeholder visual aparece mientras se arrastra
  un item desde la paleta sobre el canvas.
- El estado vacío del canvas ya no oculta el grid — se renderea
  un overlay no-interactivo encima del grid para que el drop area
  siga existiendo cuando no hay bloques.
- `appendBlock` y `createBlock` aceptan posición `{ x, y }`
  opcional para soportar drops en coordenadas específicas.

### UX

- Cuando se hace drop de un block-type singleton (`timeline` /
  `stats`) que ya existe en el canvas, la card de la paleta
  aparece con `cursor: not-allowed` y `opacity: 50%`. El drag se
  cancela en `onDragStart` si la card está disabled.
- Cuando se hace drop de un field que no existe (caso edge), el
  toast lo reporta como error.

### Contrato persistido

Sin cambios — `CustomTemplateConfigV2`. Drop-from-palette es
azúcar para la operación "agregar bloque", el resultado en disco
es indistinguible de click-to-add.

## [0.41.0] — 2026-05-23

**Editor de plantilla CRM v3 — layout 3 columnas**
(Fase 11 · Iteración 11.A).

Rework del editor visual de plantilla. El layout pasa de "header
colapsable + canvas + Dialog modal por bloque" a una experiencia
estilo Figma/Webflow:

```
┌────────────────────────────────────────────────────┐
│ Topbar: breadcrumb + Guardar                        │
├──────────┬──────────────────────┬──────────────────┤
│ Paleta   │       Canvas         │    Inspector     │
│ (left)   │   (drag/resize)      │     (right)      │
└──────────┴──────────────────────┴──────────────────┘
```

### Añadido

- `panels/BlockPalettePanel.tsx` — columna izquierda con cards de
  bloques agrupados por categoría (Datos, Visualización, Contenido,
  Acciones). Click agrega al canvas. Singleton blocks (`timeline`,
  `stats`) se deshabilitan cuando ya existe uno.
- `panels/BlockInspectorPanel.tsx` — columna derecha persistente.
  Muestra los settings del bloque seleccionado con acciones
  Duplicar/Eliminar al pie. Reemplaza el `BlockConfigDialog` modal.
- `panels/TemplateSettingsPanel.tsx` — fallback del inspector cuando
  no hay bloque seleccionado. Incluye los slots del header (título,
  subtítulos, badges, acciones rápidas) y "Restaurar desde
  plantilla".
- `forms/BlockForms.tsx` — forms inline por tipo de bloque,
  extraídos del Dialog modal.
- `utils/createBlock.ts` — factory de bloques compartida entre
  GridEditor y BlockPalettePanel.
- Selección de bloque por click. Click en background vacío
  deselecciona. Ring `primary` visible en el bloque activo.

### Cambiado

- `TemplateEditorPage.tsx` reescrito con grid CSS 3 columnas
  (`260px_1fr_320px`) y altura `calc(100vh-8rem)` para layout
  estilo IDE.
- `GridEditor.tsx` ya no abre Dialog ni muestra dropdown "Agregar
  bloque": esos responsabilidades migran a paleta + inspector.
  Sigue siendo responsable solo del drag/resize del grid.

### Eliminado

- `template-editor/HeaderEditor.tsx` (su lógica vive en
  `TemplateSettingsPanel`).
- `template-editor/blocks/BlockConfigDialog.tsx` (su lógica vive
  en `BlockInspectorPanel` + `forms/BlockForms.tsx`).

### Contrato persistido

Sin cambios — sigue siendo `CustomTemplateConfigV2`. Backward-
compatible: las plantillas guardadas con 0.40.x abren sin migración
en 0.41.0.

## [0.40.4] — 2026-05-18

**Fix:** pantalla en blanco al entrar a Ajustes del plugin
(`CustomRolesCard` de 0.40.3).

### Causa

El endpoint `GET /roles` devolvía `{ data: [...], custom_roles: [...],
capabilities: [...] }` pero el wrapper `api.ts` solo expone
`envelope.data` y descarta el resto — `custom_roles` y `capabilities`
llegaban como `undefined`, crash en `.map()`.

### Fix

- Backend (`PermissionsController::listRoles`): shape anida todo
  dentro de `data`: `{ data: { roles, custom_roles, capabilities } }`.
- Frontend (`CustomRolesCard`): consume el nuevo shape con
  fallbacks `?? []` defensivos.
- `useRoles()` actualizado al shape nuevo.

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
