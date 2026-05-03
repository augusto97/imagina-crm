import { ExternalLink, Mail, Phone, Save, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { colorFromString, initialsFromValue } from '@/lib/recordCategorize';
import type { ResolvedLayout } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

interface RecordHeaderProps {
    record: RecordEntity;
    layout: ResolvedLayout;
    onSave: () => void;
    onDelete: () => void;
    canSave: boolean;
    saving: boolean;
    deleting: boolean;
}

/**
 * Header del layout CRM. Lee del `ResolvedLayout` (producido por la
 * plantilla seleccionada) en lugar de aplicar heurística propia. Así
 * cada plantilla controla qué campos van como status pills, quick
 * actions y subtítulo.
 */
export function RecordHeader({
    record,
    layout,
    onSave,
    onDelete,
    canSave,
    saving,
    deleting,
}: RecordHeaderProps): JSX.Element {
    const titleField = layout.titleField;
    const titleValue =
        titleField && typeof record.fields[titleField.slug] === 'string'
            ? (record.fields[titleField.slug] as string)
            : '';
    const title =
        titleValue !== ''
            ? titleValue
            : sprintf(/* translators: %d id */ __('Registro #%d'), record.id);

    const initials = initialsFromValue(titleValue || String(record.id));
    const avatarColor = colorFromString(titleValue || String(record.id));

    const subtitleParts = layout.subtitleFields
        .map((f) => formatFieldValue(f, record.fields[f.slug]))
        .filter((s): s is string => s !== null && s !== '');

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
                        {subtitleParts.length > 0 && (
                            <p className="imcrm-text-sm imcrm-text-muted-foreground">
                                {subtitleParts.join(' · ')}
                            </p>
                        )}
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

            {(layout.statusFields.length > 0 || layout.quickActions.length > 0) && (
                <div className="imcrm-flex imcrm-flex-wrap imcrm-items-center imcrm-gap-2 imcrm-pt-1">
                    {layout.statusFields.map((f) => (
                        <StatusPill key={f.id} field={f} value={record.fields[f.slug]} />
                    ))}
                    {layout.statusFields.length > 0 && layout.quickActions.length > 0 && (
                        <span aria-hidden className="imcrm-mx-1 imcrm-h-4 imcrm-w-px imcrm-bg-border" />
                    )}
                    {layout.quickActions.map(({ field, kind }) => {
                        const v = record.fields[field.slug];
                        if (typeof v !== 'string' || v === '') return null;
                        return (
                            <QuickAction key={field.id} kind={kind} value={v} label={field.label} />
                        );
                    })}
                </div>
            )}
        </header>
    );
}

function formatFieldValue(field: FieldEntity, value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (field.type === 'date' || field.type === 'datetime') {
        const d = new Date(field.type === 'date' ? String(value) : String(value) + 'Z');
        if (! Number.isNaN(d.getTime())) return d.toLocaleDateString();
    }
    return null;
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
                <span className="imcrm-ml-1 imcrm-font-semibold">{v ? __('Sí') : __('No')}</span>
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
        backgroundColor: color + '1a',
        borderColor: color + '40',
        color,
    };
}

function QuickAction({
    kind,
    value,
    label,
}: {
    kind: 'email' | 'phone' | 'url';
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
