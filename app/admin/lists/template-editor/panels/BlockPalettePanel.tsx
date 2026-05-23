import { useState } from 'react';
import {
    Activity,
    BarChart3,
    FileText,
    GripVertical,
    Hash,
    MousePointerClick,
    Network,
    Paperclip,
    PieChart,
    Play,
    Search,
    StickyNote,
    Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { CustomTemplateConfigV2, V2BlockType } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';

import { setDragPayload } from '../utils/dragPayload';

interface BlockPalettePanelProps {
    config: CustomTemplateConfigV2;
    fields: FieldEntity[];
    onAddBlock: (type: V2BlockType) => void;
    onAddFieldAsGroup: (slug: string) => void;
}

type Tab = 'blocks' | 'fields';

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
 * Paleta del editor de plantilla CRM (columna izquierda).
 *
 * Fase 11.A: cards de bloques con click-to-add agrupadas por
 * categoría.
 *
 * Fase 11.B: agrega tabs Bloques/Campos, drag-from-palette al
 * canvas via HTML5 DnD nativo, y filtro de búsqueda en cada tab.
 *
 * El drag y el click coexisten — el click es atajo rápido cuando
 * no importa la posición exacta del bloque.
 */
export function BlockPalettePanel({
    config,
    fields,
    onAddBlock,
    onAddFieldAsGroup,
}: BlockPalettePanelProps): JSX.Element {
    const [tab, setTab] = useState<Tab>('blocks');
    const [filter, setFilter] = useState('');

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col">
            <header className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-border-b imcrm-border-border imcrm-px-3 imcrm-py-3">
                <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                    {__('Paleta')}
                </p>
                <div className="imcrm-flex imcrm-gap-1 imcrm-rounded-md imcrm-bg-muted imcrm-p-0.5">
                    <TabButton active={tab === 'blocks'} onClick={() => setTab('blocks')}>
                        {__('Bloques')}
                    </TabButton>
                    <TabButton active={tab === 'fields'} onClick={() => setTab('fields')}>
                        {__('Campos')}
                    </TabButton>
                </div>
                <div className="imcrm-relative">
                    <Search className="imcrm-pointer-events-none imcrm-absolute imcrm-left-2 imcrm-top-1/2 imcrm-h-3 imcrm-w-3 imcrm--translate-y-1/2 imcrm-text-muted-foreground" />
                    <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder={tab === 'blocks' ? __('Buscar bloque…') : __('Buscar campo…')}
                        className="imcrm-h-7 imcrm-w-full imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-pl-7 imcrm-pr-2 imcrm-text-xs imcrm-placeholder:text-muted-foreground focus:imcrm-outline-none focus:imcrm-ring-1 focus:imcrm-ring-primary"
                    />
                </div>
                <p className="imcrm-text-[10.5px] imcrm-leading-snug imcrm-text-muted-foreground">
                    {__('Click o arrastrá al canvas.')}
                </p>
            </header>

            <div className="imcrm-flex-1 imcrm-overflow-y-auto imcrm-px-3 imcrm-py-3">
                {tab === 'blocks' ? (
                    <BlocksTab
                        config={config}
                        filter={filter}
                        onAdd={onAddBlock}
                    />
                ) : (
                    <FieldsTab
                        fields={fields}
                        filter={filter}
                        onAdd={onAddFieldAsGroup}
                    />
                )}
            </div>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'imcrm-flex-1 imcrm-rounded imcrm-px-2 imcrm-py-1 imcrm-text-xs imcrm-font-medium imcrm-transition-colors',
                active
                    ? 'imcrm-bg-card imcrm-text-foreground imcrm-shadow-imcrm-sm'
                    : 'imcrm-text-muted-foreground hover:imcrm-text-foreground',
            )}
        >
            {children}
        </button>
    );
}

// --- Tab Bloques -------------------------------------------------------------

function BlocksTab({
    config,
    filter,
    onAdd,
}: {
    config: CustomTemplateConfigV2;
    filter: string;
    onAdd: (type: V2BlockType) => void;
}): JSX.Element {
    const existingTypes = new Set(config.blocks.map((b) => b.type));
    const categories = buildCategories();
    const needle = filter.trim().toLowerCase();

    const matches = (item: PaletteItem): boolean =>
        ! needle
        || item.label.toLowerCase().includes(needle)
        || item.description.toLowerCase().includes(needle);

    const filtered = categories
        .map((cat) => ({ ...cat, items: cat.items.filter(matches) }))
        .filter((cat) => cat.items.length > 0);

    if (filtered.length === 0) {
        return (
            <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-3 imcrm-py-6 imcrm-text-center imcrm-text-xs imcrm-text-muted-foreground">
                {__('No hay bloques que coincidan con la búsqueda.')}
            </p>
        );
    }

    return (
        <>
            {filtered.map((cat) => (
                <section key={cat.id} className="imcrm-mb-4 last:imcrm-mb-0">
                    <p className="imcrm-mb-2 imcrm-px-1 imcrm-text-[10px] imcrm-font-semibold imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                        {cat.label}
                    </p>
                    <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                        {cat.items.map((item) => {
                            const disabled = !! item.singleton && existingTypes.has(item.type);
                            return (
                                <BlockPaletteCard
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
        </>
    );
}

function BlockPaletteCard({
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
        <div
            draggable={! disabled}
            onDragStart={(e) => {
                if (disabled) {
                    e.preventDefault();
                    return;
                }
                setDragPayload(e, { kind: 'block-type', type: item.type });
            }}
            onClick={() => {
                if (! disabled) onClick();
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            title={disabled ? __('Ya hay uno en el canvas') : item.description}
            className={cn(
                'imcrm-group imcrm-flex imcrm-w-full imcrm-items-start imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-2 imcrm-py-2 imcrm-text-left imcrm-transition-colors',
                ! disabled && 'imcrm-cursor-grab hover:imcrm-border-primary/30 hover:imcrm-bg-accent/50 active:imcrm-cursor-grabbing',
                disabled && 'imcrm-cursor-not-allowed imcrm-opacity-50',
            )}
        >
            <GripVertical
                className={cn(
                    'imcrm-mt-0.5 imcrm-h-3 imcrm-w-3 imcrm-shrink-0 imcrm-text-muted-foreground/50',
                    ! disabled && 'group-hover:imcrm-text-muted-foreground',
                )}
                aria-hidden
            />
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
        </div>
    );
}

// --- Tab Campos --------------------------------------------------------------

function FieldsTab({
    fields,
    filter,
    onAdd,
}: {
    fields: FieldEntity[];
    filter: string;
    onAdd: (slug: string) => void;
}): JSX.Element {
    const needle = filter.trim().toLowerCase();
    const usable = fields.filter((f) => f.type !== 'relation');
    const matches = (f: FieldEntity): boolean =>
        ! needle
        || f.label.toLowerCase().includes(needle)
        || f.slug.toLowerCase().includes(needle)
        || f.type.toLowerCase().includes(needle);

    const filtered = usable.filter(matches);

    if (usable.length === 0) {
        return (
            <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-3 imcrm-py-6 imcrm-text-center imcrm-text-xs imcrm-text-muted-foreground">
                {__('Esta lista no tiene campos disponibles. Creá uno desde el List Builder.')}
            </p>
        );
    }

    if (filtered.length === 0) {
        return (
            <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-3 imcrm-py-6 imcrm-text-center imcrm-text-xs imcrm-text-muted-foreground">
                {__('No hay campos que coincidan con la búsqueda.')}
            </p>
        );
    }

    return (
        <>
            <p className="imcrm-mb-2 imcrm-px-1 imcrm-text-[10.5px] imcrm-leading-snug imcrm-text-muted-foreground">
                {__('Soltar al canvas crea un grupo de propiedades con ese campo.')}
            </p>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                {filtered.map((field) => (
                    <FieldPaletteCard
                        key={field.id}
                        field={field}
                        onClick={() => onAdd(field.slug)}
                    />
                ))}
            </div>
        </>
    );
}

function FieldPaletteCard({
    field,
    onClick,
}: {
    field: FieldEntity;
    onClick: () => void;
}): JSX.Element {
    return (
        <div
            draggable
            onDragStart={(e) => setDragPayload(e, { kind: 'field', slug: field.slug })}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            title={`${field.label} (${field.type})`}
            className="imcrm-group imcrm-flex imcrm-w-full imcrm-cursor-grab imcrm-items-center imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-2 imcrm-py-1.5 imcrm-text-left imcrm-transition-colors hover:imcrm-border-primary/30 hover:imcrm-bg-accent/50 active:imcrm-cursor-grabbing"
        >
            <GripVertical
                className="imcrm-h-3 imcrm-w-3 imcrm-shrink-0 imcrm-text-muted-foreground/50 group-hover:imcrm-text-muted-foreground"
                aria-hidden
            />
            <span className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col">
                <span className="imcrm-truncate imcrm-text-xs imcrm-font-medium">{field.label}</span>
                <span className="imcrm-truncate imcrm-text-[10px] imcrm-text-muted-foreground">
                    {field.slug} · {field.type}
                </span>
            </span>
        </div>
    );
}

// --- Categorías --------------------------------------------------------------

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
