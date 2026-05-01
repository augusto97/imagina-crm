import { ExternalLink, Mail, Phone, Save, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
    categorizeField,
    colorFromString,
    initialsFromValue,
    pickPrimaryField,
} from '@/lib/recordCategorize';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

interface RecordHeaderProps {
    record: RecordEntity;
    fields: FieldEntity[];
    onSave: () => void;
    onDelete: () => void;
    canSave: boolean;
    saving: boolean;
    deleting: boolean;
}

/**
 * Header del layout CRM. Muestra avatar (iniciales del primary
 * field), título grande, badges de estado auto-detectados desde
 * fields tipo `select`/`multi_select` con pocas opciones, y quick
 * actions (mailto, tel:, abrir URL) según los campos de contacto
 * presentes en el record.
 */
export function RecordHeader({
    record,
    fields,
    onSave,
    onDelete,
    canSave,
    saving,
    deleting,
}: RecordHeaderProps): JSX.Element {
    const primary = pickPrimaryField(fields);
    const primaryValue =
        primary && typeof record.fields[primary.slug] === 'string'
            ? (record.fields[primary.slug] as string)
            : '';
    const title =
        primaryValue !== ''
            ? primaryValue
            : sprintf(/* translators: %d id */ __('Registro #%d'), record.id);

    const initials = initialsFromValue(primaryValue || String(record.id));
    const avatarColor = colorFromString(primaryValue || String(record.id));

    // Status badges: select / multi_select / checkbox con ≤8 opciones.
    const statusFields = fields.filter((f) => {
        const cat = categorizeField(f);
        return cat.category === 'status';
    });

    // Quick actions: email, phone, url presentes con valor.
    type QuickActionItem = {
        field: FieldEntity;
        kind: NonNullable<ReturnType<typeof categorizeField>['contactKind']>;
        value: string;
    };
    const contactQuickActions: QuickActionItem[] = [];
    for (const f of fields) {
        const cat = categorizeField(f);
        if (cat.category !== 'contact' || ! cat.contactKind) continue;
        const v = record.fields[f.slug];
        if (typeof v !== 'string' || v === '') continue;
        contactQuickActions.push({ field: f, kind: cat.contactKind, value: v });
    }

    return (
        <header className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-rounded-xl imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-5">
            <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-4">
                <div className="imcrm-flex imcrm-min-w-0 imcrm-items-start imcrm-gap-4">
                    <div
                        aria-hidden
                        className="imcrm-flex imcrm-h-14 imcrm-w-14 imcrm-shrink-0 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-text-base imcrm-font-semibold imcrm-text-white imcrm-shadow-imcrm-sm"
                        style={{ backgroundColor: avatarColor }}
                    >
                        {initials}
                    </div>
                    <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-col imcrm-gap-1">
                        <h1 className="imcrm-flex imcrm-flex-wrap imcrm-items-center imcrm-gap-2 imcrm-text-2xl imcrm-font-semibold imcrm-tracking-tight">
                            <span className="imcrm-truncate">{title}</span>
                            <Badge variant="outline" className="imcrm-font-mono imcrm-text-xs">
                                #{record.id}
                            </Badge>
                        </h1>
                        <p className="imcrm-text-xs imcrm-text-muted-foreground">
                            {sprintf(
                                /* translators: %s: localized creation date */
                                __('Creado %s'),
                                record.created_at
                                    ? new Date(record.created_at + 'Z').toLocaleString()
                                    : '—',
                            )}
                        </p>
                    </div>
                </div>

                <div className="imcrm-flex imcrm-shrink-0 imcrm-gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="imcrm-gap-2 imcrm-text-destructive hover:imcrm-text-destructive"
                        onClick={onDelete}
                        disabled={deleting}
                    >
                        <Trash2 className="imcrm-h-4 imcrm-w-4" />
                        {__('Eliminar')}
                    </Button>
                    <Button onClick={onSave} disabled={!canSave || saving} size="sm" className="imcrm-gap-2">
                        <Save className="imcrm-h-4 imcrm-w-4" />
                        {saving ? __('Guardando…') : __('Guardar')}
                    </Button>
                </div>
            </div>

            {(statusFields.length > 0 || contactQuickActions.length > 0) && (
                <div className="imcrm-flex imcrm-flex-wrap imcrm-items-center imcrm-gap-2 imcrm-pt-1">
                    {statusFields.map((f) => (
                        <StatusPill key={f.id} field={f} value={record.fields[f.slug]} />
                    ))}
                    {statusFields.length > 0 && contactQuickActions.length > 0 && (
                        <span aria-hidden className="imcrm-mx-1 imcrm-h-4 imcrm-w-px imcrm-bg-border" />
                    )}
                    {contactQuickActions.map((a) => (
                        <QuickAction key={a.field.id} kind={a.kind} value={a.value} label={a.field.label} />
                    ))}
                </div>
            )}
        </header>
    );
}

function StatusPill({ field, value }: { field: FieldEntity; value: unknown }): JSX.Element | null {
    if (value === null || value === undefined || value === '') return null;
    const config = field.config as { options?: Array<{ value: string; label: string; color?: string }> };
    const options = Array.isArray(config.options) ? config.options : [];

    if (field.type === 'checkbox') {
        const v = value === true || value === '1' || value === 1;
        return (
            <Badge variant={v ? 'success' : 'secondary'}>
                <span className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wide">
                    {field.label}:
                </span>
                <span className="imcrm-ml-1 imcrm-font-semibold">
                    {v ? __('Sí') : __('No')}
                </span>
            </Badge>
        );
    }

    if (field.type === 'multi_select' && Array.isArray(value)) {
        return (
            <span className="imcrm-flex imcrm-flex-wrap imcrm-gap-1">
                {value.map((v) => {
                    const opt = options.find((o) => o.value === v);
                    return (
                        <Badge key={String(v)} variant="default" style={opt?.color ? styleFromColor(opt.color) : undefined}>
                            {opt?.label ?? String(v)}
                        </Badge>
                    );
                })}
            </span>
        );
    }

    const opt = options.find((o) => o.value === value);
    return (
        <Badge variant="default" style={opt?.color ? styleFromColor(opt.color) : undefined}>
            <span className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wide">
                {field.label}:
            </span>
            <span className="imcrm-ml-1 imcrm-font-semibold">{opt?.label ?? String(value)}</span>
        </Badge>
    );
}

function styleFromColor(color: string): React.CSSProperties {
    return {
        backgroundColor: color + '1a', // ~10% opacity hex
        borderColor: color + '40',
        color,
    };
}

function QuickAction({
    kind,
    value,
    label,
}: {
    kind: string;
    value: string;
    label: string;
}): JSX.Element {
    const Icon = kind === 'email' ? Mail : kind === 'phone' ? Phone : ExternalLink;
    const href =
        kind === 'email'
            ? `mailto:${value}`
            : kind === 'phone'
              ? `tel:${value.replace(/[^\d+]/g, '')}`
              : value.startsWith('http')
                ? value
                : `https://${value}`;
    return (
        <a
            href={href}
            target={kind === 'url' ? '_blank' : undefined}
            rel={kind === 'url' ? 'noopener noreferrer' : undefined}
            title={`${label}: ${value}`}
            className={cn(
                'imcrm-inline-flex imcrm-h-7 imcrm-items-center imcrm-gap-1.5 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-background imcrm-px-2.5 imcrm-text-xs imcrm-font-medium imcrm-text-foreground imcrm-transition-colors',
                'hover:imcrm-border-primary/40 hover:imcrm-bg-primary/5 hover:imcrm-text-primary',
            )}
        >
            <Icon className="imcrm-h-3 imcrm-w-3" aria-hidden />
            <span className="imcrm-max-w-[180px] imcrm-truncate">{value}</span>
        </a>
    );
}
