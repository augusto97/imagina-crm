import type { FieldEntity } from '@/types/field';

import { extractFieldOptions } from './fieldOptions';

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
                {value.map((v, i) => {
                    const opt = map.get(String(v));
                    return (
                        <span
                            key={i}
                            className="imcrm-rounded-md imcrm-bg-secondary imcrm-px-1.5 imcrm-py-0.5 imcrm-text-xs"
                        >
                            {opt?.label ?? String(v)}
                        </span>
                    );
                })}
            </div>
        );
    }

    if (field.type === 'select' && typeof value === 'string') {
        const opt = extractFieldOptions(field).find((o) => o.value === value);
        return (
            <span className="imcrm-rounded-md imcrm-bg-secondary imcrm-px-1.5 imcrm-py-0.5 imcrm-text-xs">
                {opt?.label ?? value}
            </span>
        );
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
