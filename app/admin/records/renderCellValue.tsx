import { chipSoftStyle, type OptionColor } from '@/components/ui/color-picker';
import type { FieldEntity } from '@/types/field';

import { extractFieldOptions, type FieldOption } from './fieldOptions';

/**
 * Render de un chip de opción (select / multi_select). Si la opción
 * tiene un `color` válido (uno de los OptionColor), usa la variante
 * tonal soft (bg/14 + border/32 + text-color); si no, cae a un chip
 * neutral con border hairline.
 */
function OptionChip({ opt, fallback }: { opt?: FieldOption; fallback: string }): JSX.Element {
    const color = opt?.color as OptionColor | undefined;
    const style = chipSoftStyle(color);
    return (
        <span
            className="imcrm-inline-flex imcrm-items-center imcrm-gap-1 imcrm-rounded-md imcrm-border imcrm-px-2 imcrm-py-0.5 imcrm-text-[12px] imcrm-font-medium imcrm-leading-tight imcrm-whitespace-nowrap"
            style={style ?? {
                backgroundColor: 'hsl(var(--imcrm-muted))',
                borderColor:     'hsl(var(--imcrm-border))',
                color:           'hsl(var(--imcrm-foreground))',
            }}
        >
            {color && (
                <span
                    aria-hidden
                    className="imcrm-h-1.5 imcrm-w-1.5 imcrm-shrink-0 imcrm-rounded-full imcrm-bg-current imcrm-opacity-90"
                />
            )}
            {opt?.label ?? fallback}
        </span>
    );
}

/**
 * Devuelve el render visual de un valor según el tipo de campo. Compartido
 * entre TableView (modo lectura) y EditableCell (cuando NO está en edit).
 */
export function renderCellValue(field: FieldEntity, value: unknown): React.ReactNode {
    if (value === null || value === undefined || value === '') {
        return <span className="imcrm-text-muted-foreground">—</span>;
    }

    if (field.type === 'checkbox') {
        return value ? '✓' : '—';
    }

    if (field.type === 'multi_select' && Array.isArray(value)) {
        const opts = extractFieldOptions(field);
        const map = new Map(opts.map((o) => [o.value, o]));
        return (
            <div className="imcrm-flex imcrm-flex-wrap imcrm-gap-1">
                {value.map((v, i) => (
                    <OptionChip key={i} opt={map.get(String(v))} fallback={String(v)} />
                ))}
            </div>
        );
    }

    if (field.type === 'select' && typeof value === 'string') {
        const opt = extractFieldOptions(field).find((o) => o.value === value);
        return <OptionChip opt={opt} fallback={value} />;
    }

    if (field.type === 'datetime' && typeof value === 'string') {
        try {
            return new Date(value + 'Z').toLocaleString();
        } catch {
            return value;
        }
    }

    if (field.type === 'currency' && typeof value === 'number') {
        return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }

    if (field.type === 'url' && typeof value === 'string') {
        return (
            <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="imcrm-text-primary hover:imcrm-underline"
                onClick={(e) => e.stopPropagation()}
            >
                {value}
            </a>
        );
    }

    return String(value);
}
