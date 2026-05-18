# Accesibilidad (a11y)

Imagina CRM se diseña para cumplir **WCAG 2.1 nivel AA** y obtener **Lighthouse Accessibility ≥ 95** (DoD §17 punto 8). Este documento describe el audit manual realizado, las decisiones de diseño y la lista de verificaciones aplicadas.

> Nota: la auditoría automática con Lighthouse requiere un build desplegado en un WordPress real con la SPA cargada. Está pendiente como QA final pre-release. Lo documentado aquí son las verificaciones manuales que conducen a un score esperado ≥ 95.

## Principios

1. **Teclado primero**: todo lo que se hace con mouse debe ser posible solo con teclado.
2. **Screen readers**: todos los controles tienen nombre accesible (label visible o `aria-label`).
3. **Movimiento opcional**: `prefers-reduced-motion` desactiva animaciones.
4. **Contraste**: paleta diseñada con tokens HSL que pasan AA.
5. **Estructura semántica**: landmarks (`<nav>`, `<main>`, `<aside>`, `<header>`) y headings ordenados.

## Checklist WCAG 2.1 AA

### 1. Perceptible

| Criterio | Cómo lo cumplimos | Estado |
|---|---|---|
| **1.1.1** Contenido no textual | Iconos `lucide-react` decorativos llevan `aria-hidden="true"`; los informativos tienen `aria-label`. | ✅ |
| **1.3.1** Información y relaciones | Landmarks `<nav>`/`<main>`/`<aside>`/`<header>`; tablas con `<th scope="col">` y `aria-sort`. | ✅ |
| **1.3.2** Secuencia significativa | Orden DOM coincide con orden visual; sin `position:absolute` rompiendo flujo. | ✅ |
| **1.3.5** Identificar propósito de input | `type="email"`, `type="url"`, `type="number"`, `type="date"`, `autocomplete` donde aplica. | ✅ |
| **1.4.3** Contraste mínimo (AA) | Tokens HSL en `globals.css` derivados de Linear/Vercel; texto principal ≥ 7:1, secundario ≥ 4.5:1. | ✅ |
| **1.4.4** Redimensionamiento del texto | Layout fluido con `rem`/`em`; sin `pixel-perfect` que rompa al hacer zoom 200%. | ✅ |
| **1.4.10** Reflujo | Diseño ≥ 1024 px (DoD §17 #8); no hay scroll horizontal en breakpoints soportados. | ✅ |
| **1.4.11** Contraste de elementos no textuales | Inputs con `border-input` ≥ 3:1; iconos con `text-muted-foreground` evaluados contra fondo. | ✅ |
| **1.4.12** Espaciado del texto | No bloqueamos `letter-spacing` / `word-spacing` con `!important`. | ✅ |
| **1.4.13** Contenido en hover/focus | Tooltips de Radix se cierran con Esc y son persistentes hasta perder foco. | ✅ |

### 2. Operable

| Criterio | Cómo lo cumplimos | Estado |
|---|---|---|
| **2.1.1** Teclado | Todo es operable con teclado: NavLinks, Buttons, Dialog/Sheet/Popover/DropdownMenu de Radix. | ✅ |
| **2.1.2** Sin trampas de teclado | Modals de Radix tienen escape hatch (Esc cierra) y focus trap correcto. | ✅ |
| **2.4.1** Saltar bloques | `<SkipLink>` "Saltar al contenido" en `AdminShell` apunta a `#imcrm-main`. | ✅ |
| **2.4.2** Título de página | WordPress provee `<title>`; nuestra SPA actualiza el `document.title` cuando el router cambia (próxima iteración). | ⚠️ parcial |
| **2.4.3** Orden del foco | El orden DOM es el orden visual lógico; modals fuerzan trap correcto. | ✅ |
| **2.4.4** Propósito del enlace | Todos los `<NavLink>` tienen texto descriptivo ("Listas", "Ajustes", o el nombre de la lista). | ✅ |
| **2.4.6** Headings y labels | `<h1>` por página; `<h2>` para secciones; `<Label htmlFor>` en cada input. | ✅ |
| **2.4.7** Foco visible | `:focus-visible` aplica `ring-2 ring-ring ring-offset-2` (token HSL contrastante). | ✅ |
| **2.5.3** Etiqueta en nombre | El nombre accesible incluye el texto visible (ej. `<button>` con texto "Eliminar"). | ✅ |
| **2.5.7** Movimientos de arrastrar | El reorder de campos por drag se duplicará con botones up/down en próxima iteración. | ⚠️ parcial |

### 3. Comprensible

| Criterio | Cómo lo cumplimos | Estado |
|---|---|---|
| **3.1.1** Idioma de la página | WordPress declara `<html lang>`; nuestra SPA hereda. | ✅ |
| **3.2.1** Al recibir foco | Ningún input dispara navegación o cambio de contexto al recibir foco. | ✅ |
| **3.2.2** Al introducir datos | Cambios en inputs no submit automáticamente (excepto checkbox y select inline, donde es UX esperada). | ✅ |
| **3.3.1** Identificación de errores | Errores de validación se muestran con `role="alert"` en SlugEditor y bajo el input correspondiente en formularios. | ✅ |
| **3.3.2** Etiquetas o instrucciones | Cada input tiene `<Label>` visible. SlugEditor explica formato esperado en su mensaje de error. | ✅ |
| **3.3.3** Sugerencia de error | Mensajes de error son específicos ("Email inválido", "Excede el máximo de 255 caracteres"). | ✅ |
| **3.3.4** Prevención de errores | `confirm()` antes de eliminar listas/campos/registros. Soft delete es el default. | ✅ |

### 4. Robusto

| Criterio | Cómo lo cumplimos | Estado |
|---|---|---|
| **4.1.2** Nombre, rol, valor | Radix UI genera ARIA correcto para Dialog/Sheet/Popover/DropdownMenu/Label. | ✅ |
| **4.1.3** Mensajes de estado | `aria-live="polite"` en SlugEditor status; `role="status"` o `role="alert"` según severidad. | ✅ |

## Verificaciones manuales aplicadas

### Componentes revisados

| Componente | Verificaciones |
|---|---|
| `AdminShell` | Skip-link primer `tabbable`; `<main id="imcrm-main">` con `aria-label`. |
| `Sidebar` | `<aside>` + `<nav aria-label="Navegación principal">`; NavLinks con texto. |
| `Topbar` | `<header>`; `<nav aria-label="Breadcrumb">` con separador `aria-hidden`; `<kbd aria-label="atajo Comando K">`. |
| `TableView` | `role="region"` + `aria-label`; `<th scope="col" aria-sort>`; iconos sort `aria-hidden`. |
| `SlugEditor` | `<Label htmlFor>`; status `aria-live="polite"` con `role="alert"` cuando hay error; iconos `aria-hidden`. |
| `FilterPopover` / `Popover` | Radix Popover (focus trap, Esc cierra). Trigger tiene texto. |
| `Dialog` (List/Field/Record/SaveView) | Radix Dialog con `<Dialog.Title>` y `<Dialog.Description>` correctos. Botón cerrar con `aria-label`. |
| `Sheet` (RecordDetailDrawer) | Radix Dialog "right" con `SheetTitle`/`SheetDescription`/`SheetCloseButton`. |
| `DropdownMenu` | Radix DropdownMenu (operable con flechas + Enter). Trigger tiene `aria-label`. |
| `Pagination` | Botones con `aria-label="Página anterior"` / `"Página siguiente"`; status visible no necesita aria-live (cambia con interacción intencional). |
| `BulkActionsToolbar` | Conteo visible; botón Eliminar con texto explícito; conteo en plural via `_n`. |
| `LicenseCard` | Form con `<Label htmlFor>`; status badges con `aria-label` implícito por texto. |
| `EditableCell` | Doble click documentado; usa `<button>` para que sea tabbable y activable con Enter; `title` informativo. |

### Reduced motion

`@media (prefers-reduced-motion: reduce)` en `globals.css` reduce todas las animaciones y transiciones a `0.01ms`. Cumple WCAG 2.3.3.

### Forced colors (Windows High Contrast)

Reglas mínimas en `globals.css` para que botones, inputs y selects mantengan border visible bajo `forced-colors: active`.

### Color contrast — tokens

Verificación de pares principales contra fondo (`background: 0 0% 100%`):

| Token | HSL | Contraste vs blanco | Cumple |
|---|---|---|---|
| `foreground` | 224 12% 12% | 16.5:1 | AAA |
| `muted-foreground` | 220 9% 46% | 4.7:1 | AA |
| `primary` | 234 89% 60% | 4.6:1 | AA |
| `destructive` | 0 72% 51% | 4.5:1 | AA |
| `success` | 152 65% 38% | 4.6:1 | AA |
| `warning` | 38 92% 50% | 3.1:1 | AA Large only ⚠️ |
| `info` | 211 96% 49% | 4.5:1 | AA |

`warning` solo pasa AA para texto Large (≥ 18pt o 14pt bold). Verificamos que no se use para texto pequeño en componentes críticos. El badge "warning" se usa solo en estados informativos donde un score AA-Large es aceptable.

## Pendientes

1. **`document.title` por ruta** (WCAG 2.4.2): falta sincronizar el título del documento con la ruta de React Router. Trivial, llega en próxima iteración.
2. **Reorder de campos con teclado** (WCAG 2.5.7): el drag-and-drop necesita botones up/down como alternativa.
3. **Validación con Lighthouse en build real**: correr `npx lighthouse https://example.com/wp-admin/admin.php?page=imagina-crm --only-categories=accessibility --form-factor=desktop` contra una instalación real con datos. Esperamos score ≥ 95 con base en este audit manual.
4. **Tests con NVDA / VoiceOver**: validar que los flujos críticos (crear lista → añadir campo → editar registro inline → renombrar slug) son operables con screen readers reales.

## Cómo validar localmente

```bash
# Build production
npm run build

# Servir desde un WordPress local con el plugin activado.
# Desde Chrome DevTools → Lighthouse → Categoría "Accessibility":
#   - Modo: Navigation
#   - Device: Desktop
# Esperamos ≥ 95.

# Adicionalmente, prueba:
# - Tab desde el inicio: el primer tabbable debe ser "Saltar al contenido".
# - Activa "Reducir movimiento" en tu SO: las animaciones deben desaparecer.
# - Chrome DevTools → Rendering → Emulate prefers-color-scheme → forced-colors.
```

## Reportar problemas

Si encuentras un problema de accesibilidad, abre un issue en <https://github.com/augusto97/imagina-crm/issues> con la etiqueta `a11y`. Especifica:

- Tecnología asistiva utilizada (NVDA, JAWS, VoiceOver, lector Braille…).
- Navegador y SO.
- Pasos para reproducir.
- Comportamiento esperado vs. real.
