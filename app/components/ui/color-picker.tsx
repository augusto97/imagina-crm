import { Check } from 'lucide-react';

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Paleta curada de colores para opciones de select / multi_select.
 * Inspirada en ClickUp / Linear: 12 colores saturados pero no
 * primarios, cubren el rango cromático sin chocar con la marca.
 *
 * Cada uno es un nombre estable que se persiste con la opción
 * (`config.options[i].color`) y se resuelve a HSL via la variable CSS
 * `--imcrm-opt-{name}` definida en globals.css. Esto permite cambiar
 * los tonos centralmente y heredar dark mode automáticamente.
 */
export type OptionColor =
    | 'gray'
    | 'rose'
    | 'orange'
    | 'amber'
    | 'yellow'
    | 'lime'
    | 'green'
    | 'teal'
    | 'cyan'
    | 'blue'
    | 'violet'
    | 'pink';

export const OPTION_COLORS: OptionColor[] = [
    'gray',
    'rose',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'teal',
    'cyan',
    'blue',
    'violet',
    'pink',
];

const LABELS: Record<OptionColor, string> = {
    gray:   'Gris',
    rose:   'Rosa',
    orange: 'Naranja',
    amber:  'Ámbar',
    yellow: 'Amarillo',
    lime:   'Lima',
    green:  'Verde',
    teal:   'Teal',
    cyan:   'Cyan',
    blue:   'Azul',
    violet: 'Violeta',
    pink:   'Magenta',
};

/**
 * Devuelve el HSL del color via la CSS var. Útil para style inline
 * (ej. background del chip).
 */
export function colorVar(color: OptionColor | undefined | null): string | undefined {
    if (!color) return undefined;
    return `hsl(var(--imcrm-opt-${color}))`;
}

/**
 * Estilos inline para un chip "soft" (bg al 14% + border al 30% +
 * text fuerte) usando el color elegido por el usuario. Sin color =
 * undefined (el caller cae a la variante neutral).
 */
export function chipSoftStyle(color: OptionColor | undefined | null): React.CSSProperties | undefined {
    if (!color) return undefined;
    const c = `var(--imcrm-opt-${color})`;
    return {
        backgroundColor: `hsl(${c} / 0.14)`,
        borderColor:     `hsl(${c} / 0.32)`,
        color:           `hsl(${c})`,
    };
}

interface ColorPickerProps {
    value: OptionColor | null | undefined;
    onChange: (next: OptionColor | null) => void;
    className?: string;
    /** Si `true`, no muestra la opción "sin color" (limpiar). */
    requireColor?: boolean;
}

/**
 * Botón compacto que muestra el color actual (o un placeholder si no
 * hay) y abre un popover con la paleta curada para que el usuario
 * elija. Estilo ClickUp: grid 6×2 de swatches.
 */
export function ColorPicker({
    value,
    onChange,
    className,
    requireColor,
}: ColorPickerProps): JSX.Element {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={__('Elegir color')}
                    title={value ? LABELS[value] : __('Sin color')}
                    className={cn(
                        'imcrm-flex imcrm-h-9 imcrm-w-9 imcrm-shrink-0 imcrm-items-center imcrm-justify-center imcrm-rounded-lg imcrm-border imcrm-border-input imcrm-bg-card imcrm-shadow-imcrm-sm imcrm-transition-colors hover:imcrm-border-primary',
                        className,
                    )}
                >
                    {value ? (
                        <span
                            className="imcrm-h-4 imcrm-w-4 imcrm-rounded-full"
                            style={{ backgroundColor: colorVar(value) }}
                            aria-hidden
                        />
                    ) : (
                        <span
                            className="imcrm-h-4 imcrm-w-4 imcrm-rounded-full imcrm-border imcrm-border-dashed imcrm-border-muted-foreground/50"
                            aria-hidden
                        />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="imcrm-w-auto imcrm-p-2">
                <div className="imcrm-grid imcrm-grid-cols-6 imcrm-gap-1.5">
                    {OPTION_COLORS.map((color) => {
                        const selected = value === color;
                        return (
                            <button
                                key={color}
                                type="button"
                                onClick={() => onChange(color)}
                                aria-label={LABELS[color]}
                                title={LABELS[color]}
                                className={cn(
                                    'imcrm-flex imcrm-h-7 imcrm-w-7 imcrm-items-center imcrm-justify-center imcrm-rounded-md imcrm-transition-transform hover:imcrm-scale-110',
                                    selected && 'imcrm-ring-2 imcrm-ring-offset-2 imcrm-ring-offset-card',
                                )}
                                style={{
                                    backgroundColor: colorVar(color),
                                    boxShadow: selected ? `0 0 0 2px hsl(var(--imcrm-opt-${color}))` : undefined,
                                }}
                            >
                                {selected && (
                                    <Check className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-white" />
                                )}
                            </button>
                        );
                    })}
                </div>
                {!requireColor && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="imcrm-mt-2 imcrm-flex imcrm-w-full imcrm-items-center imcrm-justify-center imcrm-gap-1.5 imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-2 imcrm-py-1 imcrm-text-[12px] imcrm-text-muted-foreground hover:imcrm-bg-accent hover:imcrm-text-foreground"
                    >
                        {__('Sin color')}
                    </button>
                )}
            </PopoverContent>
        </Popover>
    );
}
