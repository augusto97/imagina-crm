import type { ComponentType } from 'react';
import {
    Briefcase,
    Building2,
    Calendar,
    CircleUser,
    Database,
    DollarSign,
    LifeBuoy,
    Mail,
    StickyNote,
    Tag,
    Target,
    User,
} from 'lucide-react';

import { pickPrimaryField } from '@/lib/recordCategorize';
import type { FieldEntity } from '@/types/field';

/**
 * Sistema de plantillas para el layout CRM panel.
 *
 * Una plantilla define **dónde va cada campo** en la ficha individual:
 * cuáles son status pills del header, cuáles son quick actions, en qué
 * grupo del sidebar aparece cada propiedad. Hasta ahora (0.31) el
 * `RecordCrmLayout` hardcodeaba la heurística — ahora la elige el
 * usuario por lista.
 *
 * **Modelo:** una plantilla expone una función `resolve(fields)` que
 * devuelve un `ResolvedLayout` — la estructura concreta con los
 * `FieldEntity` agrupados y ordenados. Los componentes (`RecordHeader`,
 * `PropertiesSidebar`) consumen `ResolvedLayout`, no `FieldEntity[]`.
 *
 * **Built-in templates (0.32.0):**
 *  - `auto` — la heurística conservadora original. Default.
 *  - `contact` — optimizada para personas/empresas (email/phone destacados).
 *  - `deal` — venta/oportunidad (monto + pipeline al frente).
 *  - `task` — tarea (fecha + estado + asignación).
 *  - `support` — ticket de soporte (cliente + prioridad).
 *
 * **Custom templates (0.34.0 — futuro):** el editor visual generará
 * un objeto serializable con slugs explícitos, que un resolver
 * convertirá al mismo `ResolvedLayout`. Misma capa de consumo, así
 * que esta arquitectura no se tira a la basura cuando llegue.
 */

export type IconName = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
export type ContactKind = 'email' | 'phone' | 'url';

export interface QuickActionEntry {
    field: FieldEntity;
    kind: ContactKind;
}

export interface SidebarGroup {
    id: string;
    label: string;
    icon: IconName;
    fields: FieldEntity[];
    collapsedByDefault: boolean;
}

/**
 * Bloques del right rail (Phase B 0.33.0). Cada plantilla declara qué
 * bloques quiere renderear; los componentes que renderean el rail
 * tipan exhaustivamente el `kind`.
 */
export type RightRailBlock =
    | { id: string; kind: 'stats' }
    | { id: string; kind: 'related'; field: FieldEntity };

export interface ResolvedLayout {
    /** Campo cuyo valor es el título grande del header. */
    titleField: FieldEntity | null;
    /** Campos que aparecen como "subtítulo" debajo del título (ej. empresa, rol). */
    subtitleFields: FieldEntity[];
    /** Status pills en el header (auto-rendereados como Badge con color de la option si tiene). */
    statusFields: FieldEntity[];
    /** Botones de acción rápida (mailto, tel, abrir url). */
    quickActions: QuickActionEntry[];
    /** Cards colapsables del sidebar izquierdo. Vacíos no se renderean. */
    sidebarGroups: SidebarGroup[];
    /** Bloques del right rail (stats, related records). */
    rightRail: RightRailBlock[];
    /** Fields que NO entraron en ningún slot. Renderea como "Otros" colapsado. */
    leftover: FieldEntity[];
}

export interface CrmTemplate {
    id: string;
    name: string;
    description: string;
    resolve: (fields: FieldEntity[]) => ResolvedLayout;
}

// --- helpers compartidos -----------------------------------------------------

const PHONE_PATTERNS = [/\b(phone|tel|telefono|teléfono|celular|movil|móvil|whatsapp|wsp|sms|fax)\b/i];
const ADDRESS_PATTERNS = [/\b(address|direccion|dirección|calle|street|ciudad|city|pais|país|country)\b/i];
const COMPANY_PATTERNS = [/\b(company|empresa|organization|organizacion|organización|business|cliente)\b/i];
const ROLE_PATTERNS = [/\b(role|rol|cargo|position|puesto|title|job)\b/i];
const STAGE_PATTERNS = [/\b(stage|etapa|pipeline|fase)\b/i];
const PRIORITY_PATTERNS = [/\b(priority|prioridad|urgency|urgencia)\b/i];
const TICKET_PATTERNS = [/\b(ticket|case|caso|incident|incidente)\b/i];

function matches(field: FieldEntity, patterns: RegExp[]): boolean {
    const haystack = field.slug + ' ' + field.label;
    return patterns.some((re) => re.test(haystack));
}

function isStatusLike(field: FieldEntity): boolean {
    if (field.type === 'checkbox') return true;
    if (field.type !== 'select' && field.type !== 'multi_select') return false;
    const opts = (field.config as { options?: unknown[] }).options;
    return Array.isArray(opts) && opts.length > 0 && opts.length <= 8;
}

function isPhoneLike(f: FieldEntity): boolean {
    return f.type === 'text' && matches(f, PHONE_PATTERNS);
}

function isContactKind(f: FieldEntity): ContactKind | null {
    if (f.type === 'email') return 'email';
    if (f.type === 'url') return 'url';
    if (isPhoneLike(f)) return 'phone';
    return null;
}

/**
 * Helper para construir un `ResolvedLayout` consumiendo fields uno a uno
 * sin duplicar. Cada `pick*` llama y marca los fields como usados.
 */
class LayoutBuilder {
    private used = new Set<number>();

    constructor(private readonly fields: FieldEntity[]) {}

    private take(field: FieldEntity): void {
        this.used.add(field.id);
    }

    private isAvailable(field: FieldEntity): boolean {
        return ! this.used.has(field.id) && field.type !== 'relation';
    }

    pickTitle(): FieldEntity | null {
        const title = pickPrimaryField(this.fields);
        if (title) this.take(title);
        return title;
    }

    /** Toma los fields que matcheen el predicate y los devuelve. */
    pickAll(predicate: (f: FieldEntity) => boolean, limit?: number): FieldEntity[] {
        const out: FieldEntity[] = [];
        for (const f of [...this.fields].sort((a, b) => a.position - b.position)) {
            if (! this.isAvailable(f)) continue;
            if (! predicate(f)) continue;
            out.push(f);
            this.take(f);
            if (limit !== undefined && out.length >= limit) break;
        }
        return out;
    }

    /** Quick actions: email/phone/url presentes (todos), preserva orden de declaración. */
    pickQuickActions(): QuickActionEntry[] {
        const out: QuickActionEntry[] = [];
        for (const f of [...this.fields].sort((a, b) => a.position - b.position)) {
            if (! this.isAvailable(f)) continue;
            const kind = isContactKind(f);
            if (kind === null) continue;
            out.push({ field: f, kind });
            this.take(f);
        }
        return out;
    }

    pickStatusFields(): FieldEntity[] {
        return this.pickAll(isStatusLike);
    }

    /** Devuelve un `SidebarGroup` solo si hay fields para mostrar; sino devuelve null. */
    group(
        id: string,
        label: string,
        icon: IconName,
        predicate: (f: FieldEntity) => boolean,
        opts: { collapsedByDefault?: boolean } = {},
    ): SidebarGroup | null {
        const picked = this.pickAll(predicate);
        if (picked.length === 0) return null;
        return {
            id,
            label,
            icon,
            fields: picked,
            collapsedByDefault: opts.collapsedByDefault ?? false,
        };
    }

    leftover(): FieldEntity[] {
        return this.fields
            .filter((f) => this.isAvailable(f))
            .sort((a, b) => a.position - b.position);
    }

    /**
     * Construye el array de right rail blocks según una receta básica:
     *   - 1 block de stats (siempre, cuando `withStats=true`).
     *   - 1 block "related" por cada `relation` field del list.
     *
     * Las plantillas pueden invocar este helper o componer los blocks
     * a mano si necesitan algo distinto.
     */
    buildRightRail(opts: { withStats?: boolean } = {}): RightRailBlock[] {
        const { withStats = true } = opts;
        const blocks: RightRailBlock[] = [];
        if (withStats) {
            blocks.push({ id: 'stats', kind: 'stats' });
        }
        for (const f of this.fields) {
            if (f.type === 'relation') {
                blocks.push({ id: `related-${f.id}`, kind: 'related', field: f });
            }
        }
        return blocks;
    }
}

// --- built-in templates -------------------------------------------------------

const autoTemplate: CrmTemplate = {
    id: 'auto',
    name: 'Automática',
    description: 'Categorización conservadora por tipo de campo. Default.',
    resolve: (fields) => {
        const b = new LayoutBuilder(fields);
        const titleField = b.pickTitle();
        const statusFields = b.pickStatusFields();
        const quickActions = b.pickQuickActions();

        const groups: SidebarGroup[] = [];
        const contact = b.group('contact', 'Contacto', Mail, (f) =>
            f.type === 'email' || f.type === 'url' || isPhoneLike(f) || matches(f, ADDRESS_PATTERNS),
        );
        const keyData = b.group('key_data', 'Datos clave', Briefcase, (f) =>
            f.type === 'currency' || f.type === 'number' || f.type === 'date' || f.type === 'datetime',
        );
        const assignment = b.group('assignment', 'Asignación', CircleUser, (f) => f.type === 'user');
        const otherStatus = b.group('status_other', 'Estado adicional', Tag, isStatusLike);

        if (contact) groups.push(contact);
        if (otherStatus) groups.push(otherStatus);
        if (keyData) groups.push(keyData);
        if (assignment) groups.push(assignment);

        return {
            titleField,
            subtitleFields: [],
            statusFields,
            quickActions,
            sidebarGroups: groups,
            rightRail: b.buildRightRail(),
            leftover: b.leftover(),
        };
    },
};

const contactTemplate: CrmTemplate = {
    id: 'contact',
    name: 'Contacto',
    description: 'Personas y empresas. Email/teléfono al frente, empresa y rol en su propio grupo.',
    resolve: (fields) => {
        const b = new LayoutBuilder(fields);
        const titleField = b.pickTitle();

        // Subtitle: empresa + rol si existen, en ese orden.
        const subtitleFields = [
            ...b.pickAll((f) => f.type === 'text' && matches(f, COMPANY_PATTERNS), 1),
            ...b.pickAll((f) => f.type === 'text' && matches(f, ROLE_PATTERNS), 1),
        ];

        const statusFields = b.pickStatusFields();
        const quickActions = b.pickQuickActions();

        const groups: SidebarGroup[] = [];
        const contact = b.group('contact', 'Contacto', Mail, (f) =>
            f.type === 'email' || f.type === 'url' || isPhoneLike(f) || matches(f, ADDRESS_PATTERNS),
        );
        const company = b.group('company', 'Empresa y rol', Building2, (f) =>
            f.type === 'text' && (matches(f, COMPANY_PATTERNS) || matches(f, ROLE_PATTERNS)),
        );
        const dates = b.group('dates', 'Fechas', Calendar, (f) =>
            f.type === 'date' || f.type === 'datetime',
        );
        const numeric = b.group('numbers', 'Datos numéricos', DollarSign, (f) =>
            f.type === 'number' || f.type === 'currency',
        );
        const assignment = b.group('assignment', 'Asignación', CircleUser, (f) => f.type === 'user');

        if (contact) groups.push(contact);
        if (company) groups.push(company);
        if (dates) groups.push(dates);
        if (numeric) groups.push(numeric);
        if (assignment) groups.push(assignment);

        return {
            titleField,
            subtitleFields,
            statusFields,
            quickActions,
            sidebarGroups: groups,
            rightRail: b.buildRightRail(),
            leftover: b.leftover(),
        };
    },
};

const dealTemplate: CrmTemplate = {
    id: 'deal',
    name: 'Venta / Oportunidad',
    description: 'Pipeline al frente: monto destacado, etapa y prioridad como pills, contacto del cliente.',
    resolve: (fields) => {
        const b = new LayoutBuilder(fields);
        const titleField = b.pickTitle();

        // Status: stage + priority + otros status-like.
        const statusFields: FieldEntity[] = [
            ...b.pickAll((f) => isStatusLike(f) && matches(f, STAGE_PATTERNS), 1),
            ...b.pickAll((f) => isStatusLike(f) && matches(f, PRIORITY_PATTERNS), 1),
            ...b.pickStatusFields(),
        ];

        const quickActions = b.pickQuickActions();

        const groups: SidebarGroup[] = [];
        const monto = b.group('monto', 'Monto y métricas', DollarSign, (f) =>
            f.type === 'currency' || f.type === 'number',
        );
        const cliente = b.group('cliente', 'Cliente', User, (f) =>
            f.type === 'email' || f.type === 'url' || isPhoneLike(f) || matches(f, COMPANY_PATTERNS),
        );
        const fechas = b.group('fechas', 'Fechas clave', Calendar, (f) =>
            f.type === 'date' || f.type === 'datetime',
        );
        const assignment = b.group('assignment', 'Asignación', CircleUser, (f) => f.type === 'user');

        if (monto) groups.push(monto);
        if (cliente) groups.push(cliente);
        if (fechas) groups.push(fechas);
        if (assignment) groups.push(assignment);

        return {
            titleField,
            subtitleFields: [],
            statusFields,
            quickActions,
            sidebarGroups: groups,
            rightRail: b.buildRightRail(),
            leftover: b.leftover(),
        };
    },
};

const taskTemplate: CrmTemplate = {
    id: 'task',
    name: 'Tarea',
    description: 'Fecha de vencimiento prominente, estado + prioridad, asignación.',
    resolve: (fields) => {
        const b = new LayoutBuilder(fields);
        const titleField = b.pickTitle();

        // Subtitle: la primera fecha (típicamente "due_date").
        const subtitleFields = b.pickAll(
            (f) => (f.type === 'date' || f.type === 'datetime'),
            1,
        );

        const statusFields = b.pickStatusFields();
        const quickActions = b.pickQuickActions();

        const groups: SidebarGroup[] = [];
        const programacion = b.group('programacion', 'Programación', Calendar, (f) =>
            f.type === 'date' || f.type === 'datetime',
        );
        const assignment = b.group('assignment', 'Asignación', CircleUser, (f) => f.type === 'user');
        const numeric = b.group('numbers', 'Datos', Briefcase, (f) =>
            f.type === 'number' || f.type === 'currency',
        );
        const notas = b.group('notas', 'Notas', StickyNote, (f) => f.type === 'long_text', {
            collapsedByDefault: false,
        });

        if (programacion) groups.push(programacion);
        if (assignment) groups.push(assignment);
        if (numeric) groups.push(numeric);
        if (notas) groups.push(notas);

        return {
            titleField,
            subtitleFields,
            statusFields,
            quickActions,
            sidebarGroups: groups,
            rightRail: b.buildRightRail(),
            leftover: b.leftover(),
        };
    },
};

const supportTemplate: CrmTemplate = {
    id: 'support',
    name: 'Soporte',
    description: 'Ticket: prioridad y estado prominentes, datos del cliente, fechas y SLA.',
    resolve: (fields) => {
        const b = new LayoutBuilder(fields);
        const titleField = b.pickTitle();

        // Subtitle: ticket id (campo number con slug "ticket"|"case").
        const subtitleFields = b.pickAll(
            (f) => (f.type === 'number' || f.type === 'text') && matches(f, TICKET_PATTERNS),
            1,
        );

        const statusFields: FieldEntity[] = [
            ...b.pickAll((f) => isStatusLike(f) && matches(f, PRIORITY_PATTERNS), 1),
            ...b.pickStatusFields(),
        ];

        const quickActions = b.pickQuickActions();

        const groups: SidebarGroup[] = [];
        const cliente = b.group('cliente', 'Cliente', User, (f) =>
            f.type === 'email' || f.type === 'url' || isPhoneLike(f) || matches(f, COMPANY_PATTERNS),
        );
        const detalles = b.group('detalles', 'Detalles', LifeBuoy, (f) =>
            f.type === 'long_text' || f.type === 'file',
        );
        const fechas = b.group('fechas', 'Fechas', Calendar, (f) =>
            f.type === 'date' || f.type === 'datetime',
        );
        const numeric = b.group('numbers', 'Métricas', Target, (f) =>
            f.type === 'number' || f.type === 'currency',
        );
        const assignment = b.group('assignment', 'Asignación', CircleUser, (f) => f.type === 'user');

        if (cliente) groups.push(cliente);
        if (detalles) groups.push(detalles);
        if (fechas) groups.push(fechas);
        if (numeric) groups.push(numeric);
        if (assignment) groups.push(assignment);

        return {
            titleField,
            subtitleFields,
            statusFields,
            quickActions,
            sidebarGroups: groups,
            rightRail: b.buildRightRail(),
            leftover: b.leftover(),
        };
    },
};

// --- registry ----------------------------------------------------------------

export const CRM_TEMPLATES: CrmTemplate[] = [
    autoTemplate,
    contactTemplate,
    dealTemplate,
    taskTemplate,
    supportTemplate,
];

export const DEFAULT_TEMPLATE_ID = 'auto';
export const CUSTOM_TEMPLATE_ID  = 'custom';

export function getTemplate(id: string | undefined): CrmTemplate {
    return CRM_TEMPLATES.find((t) => t.id === id) ?? autoTemplate;
}

/** Icon helper para el sidebar "Otros" (siempre fallback al final). */
export const OTHER_GROUP_ICON: IconName = Database;

// --- Custom templates (0.34.0): editor visual --------------------------------

/**
 * Catálogo de iconos disponibles en el editor visual. Cada slot del
 * sidebar puede elegir uno. Mantenemos una lista corta y curada para
 * que el editor sea finite y serializable — nada de free-form lucide
 * names que cambian entre versiones.
 */
export const SIDEBAR_ICON_OPTIONS: Array<{ key: string; icon: IconName; label: string }> = [
    { key: 'mail', icon: Mail, label: 'Contacto' },
    { key: 'building', icon: Building2, label: 'Empresa' },
    { key: 'tag', icon: Tag, label: 'Etiqueta' },
    { key: 'briefcase', icon: Briefcase, label: 'Trabajo' },
    { key: 'dollar', icon: DollarSign, label: 'Dinero' },
    { key: 'calendar', icon: Calendar, label: 'Fechas' },
    { key: 'user', icon: User, label: 'Persona' },
    { key: 'circle_user', icon: CircleUser, label: 'Asignación' },
    { key: 'sticky_note', icon: StickyNote, label: 'Notas' },
    { key: 'target', icon: Target, label: 'Métricas' },
    { key: 'lifebuoy', icon: LifeBuoy, label: 'Soporte' },
    { key: 'database', icon: Database, label: 'Otros' },
];

export function iconForKey(key: string): IconName {
    return SIDEBAR_ICON_OPTIONS.find((o) => o.key === key)?.icon ?? Database;
}

/**
 * Configuración serializable del template "Personalizada", producida
 * por el editor visual (0.34.0+) y persistida en
 * `list.settings.crm_template_custom`.
 *
 * Toda referencia a campos es por **slug** (que el SlugManager garantiza
 * único + tolerante a renames vía slug_history). Slugs faltantes se
 * skipean silenciosamente al resolver — sin esto, borrar un campo
 * dejaría la plantilla rota.
 */
export interface CustomSidebarGroupConfig {
    id: string;
    label: string;
    icon_key: string;
    field_slugs: string[];
    collapsed_by_default: boolean;
}

export interface CustomTemplateConfig {
    title_field_slug?: string;
    subtitle_field_slugs: string[];
    status_field_slugs: string[];
    quick_action_field_slugs: string[];
    sidebar_groups: CustomSidebarGroupConfig[];
    show_stats: boolean;
    related_field_slugs: string[];
}

export function emptyCustomConfig(): CustomTemplateConfig {
    return {
        subtitle_field_slugs: [],
        status_field_slugs: [],
        quick_action_field_slugs: [],
        sidebar_groups: [],
        show_stats: true,
        related_field_slugs: [],
    };
}

/**
 * Convierte el resultado del resolver de una plantilla built-in en un
 * `CustomTemplateConfig` serializable. Útil para "duplicar y editar" —
 * el user empieza desde una plantilla curada y la modifica.
 */
export function customConfigFromBuiltin(
    builtinId: string,
    fields: FieldEntity[],
): CustomTemplateConfig {
    const layout = getTemplate(builtinId).resolve(fields);
    return {
        title_field_slug: layout.titleField?.slug,
        subtitle_field_slugs: layout.subtitleFields.map((f) => f.slug),
        status_field_slugs: layout.statusFields.map((f) => f.slug),
        quick_action_field_slugs: layout.quickActions.map((q) => q.field.slug),
        sidebar_groups: layout.sidebarGroups.map((g, i) => ({
            id: g.id || `group-${i}`,
            label: g.label,
            icon_key: matchIconKey(g.icon),
            field_slugs: g.fields.map((f) => f.slug),
            collapsed_by_default: g.collapsedByDefault,
        })),
        show_stats: layout.rightRail.some((b) => b.kind === 'stats'),
        related_field_slugs: layout.rightRail
            .filter((b): b is { id: string; kind: 'related'; field: FieldEntity } => b.kind === 'related')
            .map((b) => b.field.slug),
    };
}

function matchIconKey(icon: IconName): string {
    const found = SIDEBAR_ICON_OPTIONS.find((o) => o.icon === icon);
    return found?.key ?? 'database';
}

/**
 * Resuelve un `CustomTemplateConfig` contra los fields actuales de la
 * lista. Tolerante a slugs faltantes (si el user borró un campo, lo
 * skipeamos), tolerante a kinds no-aplicables (un slug que apunta a un
 * field tipo `relation` no debería estar en `quick_action_field_slugs`,
 * pero si sucede lo ignoramos sin crashear).
 */
export function resolveCustomTemplate(
    config: CustomTemplateConfig,
    fields: FieldEntity[],
): ResolvedLayout {
    const bySlug = new Map(fields.map((f) => [f.slug, f]));
    const used = new Set<number>();

    const lookup = (slug: string): FieldEntity | null => {
        const f = bySlug.get(slug);
        if (! f || used.has(f.id)) return null;
        used.add(f.id);
        return f;
    };

    const titleField = config.title_field_slug ? lookup(config.title_field_slug) : null;
    const subtitleFields = config.subtitle_field_slugs
        .map((s) => lookup(s))
        .filter((f): f is FieldEntity => f !== null);
    const statusFields = config.status_field_slugs
        .map((s) => lookup(s))
        .filter((f): f is FieldEntity => f !== null);

    const quickActions: QuickActionEntry[] = [];
    for (const slug of config.quick_action_field_slugs) {
        const f = lookup(slug);
        if (! f) continue;
        const kind = f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'phone';
        quickActions.push({ field: f, kind });
    }

    const sidebarGroups: SidebarGroup[] = config.sidebar_groups.map((g) => ({
        id: g.id,
        label: g.label,
        icon: iconForKey(g.icon_key),
        fields: g.field_slugs
            .map((s) => lookup(s))
            .filter((f): f is FieldEntity => f !== null),
        collapsedByDefault: g.collapsed_by_default,
    }));

    const rightRail: RightRailBlock[] = [];
    if (config.show_stats) {
        rightRail.push({ id: 'stats', kind: 'stats' });
    }
    for (const slug of config.related_field_slugs) {
        const f = bySlug.get(slug);
        if (f && f.type === 'relation') {
            rightRail.push({ id: `related-${f.id}`, kind: 'related', field: f });
        }
    }

    const leftover = fields
        .filter((f) => ! used.has(f.id) && f.type !== 'relation')
        .sort((a, b) => a.position - b.position);

    return {
        titleField,
        subtitleFields,
        statusFields,
        quickActions,
        sidebarGroups,
        rightRail,
        leftover,
    };
}

/**
 * Resolver unificado consumido por `RecordCrmLayout` y la preview del
 * editor. Si la lista tiene `crm_template_id === 'custom'` y un
 * `crm_template_custom` válido, usa ese; sino cae a la built-in.
 */
export function getResolvedLayout(
    settings: { crm_template_id?: string; crm_template_custom?: unknown },
    fields: FieldEntity[],
): ResolvedLayout {
    if (settings.crm_template_id === CUSTOM_TEMPLATE_ID && isCustomConfig(settings.crm_template_custom)) {
        return resolveCustomTemplate(settings.crm_template_custom, fields);
    }
    return getTemplate(settings.crm_template_id).resolve(fields);
}

function isCustomConfig(v: unknown): v is CustomTemplateConfig {
    return Boolean(
        v
            && typeof v === 'object'
            && Array.isArray((v as CustomTemplateConfig).subtitle_field_slugs)
            && Array.isArray((v as CustomTemplateConfig).sidebar_groups),
    );
}
