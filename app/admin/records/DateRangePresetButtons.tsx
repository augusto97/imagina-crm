import { CalendarRange } from 'lucide-react';

import { __ } from '@/lib/i18n';

import {
    DATE_RANGE_PRESETS,
    computePresetRange,
    type DateRangePresetId,
} from './dateRangePresets';

interface DateRangePresetButtonsProps {
    fieldType: 'date' | 'datetime';
    /** Llamado con `from` y `to` ya formateados al field type. */
    onPick: (from: string, to: string) => void;
}

/**
 * Fila inline de presets ("Hoy", "Esta semana", etc.) que aparece
 * debajo de un row de filtro cuando el campo es date/datetime.
 *
 * "Personalizado" no se muestra acá — el usuario simplemente edita
 * los inputs `desde`/`hasta` manualmente cuando quiere un rango ad
 * hoc, así que el preset "custom" sería un no-op en este contexto.
 */
export function DateRangePresetButtons({
    fieldType,
    onPick,
}: DateRangePresetButtonsProps): JSX.Element {
    const presets = DATE_RANGE_PRESETS.filter((p) => p.id !== 'custom');

    const apply = (id: DateRangePresetId): void => {
        const range = computePresetRange(id, fieldType, new Date());
        if (range === null) return;
        onPick(range.from, range.to);
    };

    return (
        <div className="imcrm-flex imcrm-flex-wrap imcrm-items-center imcrm-gap-1">
            <span className="imcrm-flex imcrm-items-center imcrm-gap-1 imcrm-text-[10px] imcrm-text-muted-foreground">
                <CalendarRange className="imcrm-h-3 imcrm-w-3" />
                {__('Rangos rápidos:')}
            </span>
            {presets.map((p) => (
                <button
                    key={p.id}
                    type="button"
                    onClick={() => apply(p.id)}
                    className="imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-1.5 imcrm-py-0.5 imcrm-text-[10px] hover:imcrm-bg-accent"
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
}
