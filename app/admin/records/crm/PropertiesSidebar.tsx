import { useState } from 'react';
import {
    Briefcase,
    ChevronDown,
    ChevronRight,
    CircleUser,
    Database,
    Mail,
    Tag,
} from 'lucide-react';

import { RecordFieldsForm } from '@/admin/records/RecordFieldsForm';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { groupFields, type FieldCategory } from '@/lib/recordCategorize';
import type { FieldEntity } from '@/types/field';

interface PropertiesSidebarProps {
    fields: FieldEntity[];
    values: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
    fieldErrors?: Record<string, string>;
}

interface GroupSpec {
    key: FieldCategory;
    label: string;
    icon: typeof Mail;
    /** Si true, arranca colapsado por default. */
    collapsedByDefault?: boolean;
}

const GROUPS: GroupSpec[] = [
    { key: 'contact', label: 'Contacto', icon: Mail },
    { key: 'status', label: 'Estado', icon: Tag },
    { key: 'key_data', label: 'Datos clave', icon: Briefcase },
    { key: 'assignment', label: 'Asignación', icon: CircleUser },
    { key: 'other', label: 'Otros', icon: Database, collapsedByDefault: true },
];

/**
 * Sidebar de propiedades del layout CRM. Muestra los fields del
 * record agrupados en bloques temáticos (Contacto, Estado, Datos
 * clave, Asignación, Otros) — cada bloque colapsable, con los
 * campos editables inline reusando `RecordFieldsForm`.
 *
 * Grupos sin campos NO renderean su card (UI limpia para listas que
 * no usan ese tipo).
 */
export function PropertiesSidebar({
    fields,
    values,
    onChange,
    fieldErrors,
}: PropertiesSidebarProps): JSX.Element {
    const groups = groupFields(fields);

    return (
        <aside className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            {GROUPS.map((g) => {
                const groupFieldsList = groups[g.key].map((c) => c.field);
                if (groupFieldsList.length === 0) return null;
                return (
                    <PropertyGroup
                        key={g.key}
                        spec={g}
                        fields={groupFieldsList}
                        values={values}
                        onChange={onChange}
                        fieldErrors={fieldErrors}
                    />
                );
            })}
        </aside>
    );
}

interface PropertyGroupProps {
    spec: GroupSpec;
    fields: FieldEntity[];
    values: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
    fieldErrors?: Record<string, string>;
}

function PropertyGroup({
    spec,
    fields,
    values,
    onChange,
    fieldErrors,
}: PropertyGroupProps): JSX.Element {
    const [open, setOpen] = useState(! spec.collapsedByDefault);
    const Icon = spec.icon;

    return (
        <section className="imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card">
            <button
                type="button"
                onClick={() => setOpen((v) => ! v)}
                aria-expanded={open}
                className={cn(
                    'imcrm-flex imcrm-w-full imcrm-items-center imcrm-gap-2 imcrm-px-4 imcrm-py-3 imcrm-text-left imcrm-text-sm imcrm-font-medium imcrm-transition-colors',
                    'hover:imcrm-bg-accent/40',
                )}
            >
                {open ? (
                    <ChevronDown className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                ) : (
                    <ChevronRight className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                )}
                <Icon className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                <span className="imcrm-flex-1">{__(spec.label)}</span>
                <span className="imcrm-text-xs imcrm-text-muted-foreground">{fields.length}</span>
            </button>

            {open && (
                <div className="imcrm-border-t imcrm-border-border imcrm-px-4 imcrm-py-3">
                    <RecordFieldsForm
                        fields={fields}
                        values={values}
                        onChange={onChange}
                        fieldErrors={fieldErrors}
                    />
                </div>
            )}
        </section>
    );
}
