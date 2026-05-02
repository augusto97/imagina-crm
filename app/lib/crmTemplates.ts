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

export function getTemplate(id: string | undefined): CrmTemplate {
    return CRM_TEMPLATES.find((t) => t.id === id) ?? autoTemplate;
}

/** Icon helper para el sidebar "Otros" (siempre fallback al final). */
export const OTHER_GROUP_ICON: IconName = Database;
