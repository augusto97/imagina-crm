import {
    Activity,
    BarChart3,
    FileText,
    Hash,
    MousePointerClick,
    Network,
    Paperclip,
    PieChart,
    Play,
    StickyNote,
    Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { CustomTemplateConfigV2, V2BlockType } from '@/lib/crmTemplates';

interface BlockPalettePanelProps {
    config: CustomTemplateConfigV2;
    onAdd: (type: V2BlockType) => void;
}

interface PaletteItem {
    type: V2BlockType;
    label: string;
    description: string;
    icon: LucideIcon;
    singleton?: boolean;
}

interface PaletteCategory {
    id: string;
    label: string;
    items: PaletteItem[];
}

/**
 * Paleta de bloques del editor de plantilla CRM (columna izquierda,
 * Fase 11.A+). En la 11.A los bloques se agregan con click. En 11.B
 * se agrega drag-from-palette al canvas central.
 *
 * Los bloques singleton (`timeline`, `stats`) se deshabilitan
 * automáticamente cuando ya existe uno en el canvas.
 */
export function BlockPalettePanel({ config, onAdd }: BlockPalettePanelProps): JSX.Element {
    const existingTypes = new Set(config.blocks.map((b) => b.type));
    const categories = buildCategories();

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col">
            <header className="imcrm-flex imcrm-flex-col imcrm-gap-0.5 imcrm-border-b imcrm-border-border imcrm-px-4 imcrm-py-3">
                <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                    {__('Paleta')}
                </p>
                <h3 className="imcrm-text-sm imcrm-font-semibold imcrm-tracking-tight">
                    {__('Bloques')}
                </h3>
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {__('Click para agregar al canvas. Drag llega pronto.')}
                </p>
            </header>

            <div className="imcrm-flex-1 imcrm-overflow-y-auto imcrm-px-3 imcrm-py-3">
                {categories.map((cat) => (
                    <section key={cat.id} className="imcrm-mb-4 last:imcrm-mb-0">
                        <p className="imcrm-mb-2 imcrm-px-1 imcrm-text-[10px] imcrm-font-semibold imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                            {cat.label}
                        </p>
                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            {cat.items.map((item) => {
                                const disabled = !! item.singleton && existingTypes.has(item.type);
                                return (
                                    <PaletteCard
                                        key={item.type}
                                        item={item}
                                        disabled={disabled}
                                        onClick={() => onAdd(item.type)}
                                    />
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

function PaletteCard({
    item,
    disabled,
    onClick,
}: {
    item: PaletteItem;
    disabled: boolean;
    onClick: () => void;
}): JSX.Element {
    const Icon = item.icon;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={disabled ? __('Ya hay uno en el canvas') : item.description}
            className={cn(
                'imcrm-group imcrm-flex imcrm-w-full imcrm-items-start imcrm-gap-2.5 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-2.5 imcrm-py-2 imcrm-text-left imcrm-transition-colors',
                ! disabled && 'hover:imcrm-border-primary/30 hover:imcrm-bg-accent/50',
                disabled && 'imcrm-cursor-not-allowed imcrm-opacity-50',
            )}
        >
            <span
                className={cn(
                    'imcrm-flex imcrm-h-7 imcrm-w-7 imcrm-shrink-0 imcrm-items-center imcrm-justify-center imcrm-rounded imcrm-bg-muted imcrm-text-muted-foreground',
                    ! disabled && 'group-hover:imcrm-bg-primary/10 group-hover:imcrm-text-primary',
                )}
            >
                <Icon className="imcrm-h-3.5 imcrm-w-3.5" />
            </span>
            <span className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col imcrm-gap-0.5">
                <span className="imcrm-truncate imcrm-text-xs imcrm-font-medium">{item.label}</span>
                <span className="imcrm-line-clamp-2 imcrm-text-[10.5px] imcrm-leading-tight imcrm-text-muted-foreground">
                    {item.description}
                </span>
            </span>
        </button>
    );
}

function buildCategories(): PaletteCategory[] {
    return [
    {
        id: 'data',
        label: __('Datos'),
        items: [
            {
                type: 'properties_group',
                label: __('Grupo de propiedades'),
                description: __('Agrupa N campos del record con un nombre e icono.'),
                icon: Tag,
            },
            {
                type: 'related',
                label: __('Records relacionados'),
                description: __('Lista de records conectados vía relation field.'),
                icon: Network,
            },
            {
                type: 'files',
                label: __('Archivos'),
                description: __('Archivos adjuntos del record (file fields).'),
                icon: Paperclip,
            },
        ],
    },
    {
        id: 'visualization',
        label: __('Visualización'),
        items: [
            {
                type: 'kpi',
                label: __('KPI'),
                description: __('Número grande con label y meta opcional.'),
                icon: Hash,
            },
            {
                type: 'chart',
                label: __('Gráfico'),
                description: __('Distribución de relacionados por field destino.'),
                icon: PieChart,
            },
            {
                type: 'stats',
                label: __('Resumen'),
                description: __('Días, # comentarios, # cambios. 1 solo por panel.'),
                icon: BarChart3,
                singleton: true,
            },
            {
                type: 'timeline',
                label: __('Timeline'),
                description: __('Feed de actividad y comentarios. 1 solo por panel.'),
                icon: Activity,
                singleton: true,
            },
        ],
    },
    {
        id: 'content',
        label: __('Contenido'),
        items: [
            {
                type: 'notes',
                label: __('Notas'),
                description: __('Texto custom static por lista. Recordatorios al operador.'),
                icon: StickyNote,
            },
            {
                type: 'markdown',
                label: __('Markdown'),
                description: __('Texto rich con headings, listas, negrita, links.'),
                icon: FileText,
            },
            {
                type: 'embed',
                label: __('Embed externo'),
                description: __('iframe: YouTube, Vimeo, Maps, Loom, Figma, Calendly.'),
                icon: Play,
            },
        ],
    },
    {
        id: 'actions',
        label: __('Acciones'),
        items: [
            {
                type: 'action_button',
                label: __('Botón de acción'),
                description: __('URL externa, mailto, tel o copiar al clipboard.'),
                icon: MousePointerClick,
            },
        ],
    },
    ];
}
