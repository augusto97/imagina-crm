import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
    Activity,
    BarChart3,
    Copy,
    Eye,
    FileText,
    Hash,
    Heading,
    LayoutTemplate,
    MessageSquare,
    Minus,
    MousePointerClick,
    Network,
    Paperclip,
    Pencil,
    PieChart,
    Play,
    RotateCcw,
    Save,
    StickyNote,
    Tag,
    Target,
    Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
    CRM_TEMPLATES,
    type CustomTemplateConfigV2,
    type V2Block,
    type V2BlockType,
} from '@/lib/crmTemplates';

import { INDUSTRY_PRESETS, type PresetId } from './presets/industryPresets';

interface EditorCommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: CustomTemplateConfigV2;
    selectedBlockIds: string[];
    preview: boolean;
    onAddBlock: (type: V2BlockType) => void;
    onSelectBlock: (id: string) => void;
    onDeleteSelected: () => void;
    onDuplicateSelected: () => void;
    onTogglePreview: () => void;
    onSave: () => void;
    onResetFromBuiltin: (id: string) => void;
    onApplyPreset: (id: PresetId) => void;
}

interface Command {
    id: string;
    label: string;
    description?: string;
    icon: LucideIcon;
    keys?: string;
    section: string;
    keywords?: string;
    action: () => void;
    disabled?: boolean;
}

/**
 * Command palette del editor de plantilla CRM (Fase 14.A).
 *
 * Activado con Cmd/Ctrl+K. Centraliza acciones del editor que
 * antes vivían dispersas (paleta, dropdown, atajos, inspector):
 *
 *   - Agregar bloque de cualquier tipo (sin scroll por la paleta).
 *   - Saltar a un bloque del canvas por nombre.
 *   - Comandos rápidos: Guardar, Toggle Preview, Restaurar.
 *   - Acciones sobre selección: Duplicar, Eliminar.
 *
 * UX: input con foco automático, navegación ↑↓ + Enter, Esc cierra.
 * Match fuzzy simple por substring en label + keywords.
 */
export function EditorCommandPalette({
    open,
    onOpenChange,
    config,
    selectedBlockIds,
    preview,
    onAddBlock,
    onSelectBlock,
    onDeleteSelected,
    onDuplicateSelected,
    onTogglePreview,
    onSave,
    onResetFromBuiltin,
    onApplyPreset,
}: EditorCommandPaletteProps): JSX.Element {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const commands = useMemo<Command[]>(
        () => buildCommands({
            config,
            selectedBlockIds,
            preview,
            onAddBlock,
            onSelectBlock,
            onDeleteSelected,
            onDuplicateSelected,
            onTogglePreview,
            onSave,
            onResetFromBuiltin,
            onApplyPreset,
        }),
        [
            config,
            selectedBlockIds,
            preview,
            onAddBlock,
            onSelectBlock,
            onDeleteSelected,
            onDuplicateSelected,
            onTogglePreview,
            onSave,
            onResetFromBuiltin,
            onApplyPreset,
        ],
    );

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (! needle) return commands;
        return commands.filter((cmd) => {
            const haystack = (
                cmd.label
                + ' '
                + (cmd.description ?? '')
                + ' '
                + (cmd.keywords ?? '')
                + ' '
                + cmd.section
            ).toLowerCase();
            return haystack.includes(needle);
        });
    }, [commands, query]);

    // Reset state cuando abre/cierra.
    useEffect(() => {
        if (open) {
            setQuery('');
            setActiveIndex(0);
        }
    }, [open]);

    // Clamp activeIndex cuando cambia el filtro.
    useEffect(() => {
        if (activeIndex >= filtered.length) {
            setActiveIndex(Math.max(0, filtered.length - 1));
        }
    }, [filtered.length, activeIndex]);

    const runCommand = (cmd: Command): void => {
        if (cmd.disabled) return;
        onOpenChange(false);
        cmd.action();
    };

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const cmd = filtered[activeIndex];
            if (cmd) runCommand(cmd);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="imcrm-fixed imcrm-inset-0 imcrm-z-50 imcrm-bg-black/40 imcrm-backdrop-blur-sm" />
                <Dialog.Content
                    className={cn(
                        'imcrm-fixed imcrm-left-1/2 imcrm-top-[10vh] imcrm-z-50 imcrm-w-full imcrm-max-w-xl',
                        'imcrm--translate-x-1/2',
                        'imcrm-flex imcrm-flex-col imcrm-overflow-hidden imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-shadow-imcrm-lg',
                    )}
                    onKeyDown={handleKeyDown}
                >
                    <Dialog.Title className="imcrm-sr-only">{__('Comandos del editor')}</Dialog.Title>
                    <input
                        type="text"
                        autoFocus
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActiveIndex(0);
                        }}
                        placeholder={__('Buscar comando… (agregar, saltar a, guardar, preview)')}
                        className="imcrm-h-12 imcrm-w-full imcrm-border-b imcrm-border-border imcrm-bg-transparent imcrm-px-4 imcrm-text-sm imcrm-placeholder:text-muted-foreground focus:imcrm-outline-none"
                    />

                    <div
                        ref={listRef}
                        className="imcrm-max-h-[60vh] imcrm-overflow-y-auto imcrm-py-2"
                    >
                        {filtered.length === 0 ? (
                            <p className="imcrm-px-4 imcrm-py-6 imcrm-text-center imcrm-text-xs imcrm-text-muted-foreground">
                                {__('Sin comandos que coincidan.')}
                            </p>
                        ) : (
                            renderGrouped(filtered, activeIndex, runCommand, setActiveIndex)
                        )}
                    </div>

                    <footer className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-px-4 imcrm-py-2 imcrm-text-[10px] imcrm-text-muted-foreground">
                        <span className="imcrm-flex imcrm-items-center imcrm-gap-1">
                            <kbd className="imcrm-rounded imcrm-bg-muted imcrm-px-1 imcrm-py-0.5">↑↓</kbd>
                            {__('navegar')}
                        </span>
                        <span className="imcrm-flex imcrm-items-center imcrm-gap-1">
                            <kbd className="imcrm-rounded imcrm-bg-muted imcrm-px-1 imcrm-py-0.5">⏎</kbd>
                            {__('ejecutar')}
                        </span>
                        <span className="imcrm-flex imcrm-items-center imcrm-gap-1">
                            <kbd className="imcrm-rounded imcrm-bg-muted imcrm-px-1 imcrm-py-0.5">Esc</kbd>
                            {__('cerrar')}
                        </span>
                    </footer>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function renderGrouped(
    cmds: Command[],
    activeIndex: number,
    onRun: (cmd: Command) => void,
    onHover: (i: number) => void,
): JSX.Element {
    // Agrupamos preservando el orden de aparición.
    const sections = new Map<string, Command[]>();
    cmds.forEach((cmd) => {
        if (! sections.has(cmd.section)) sections.set(cmd.section, []);
        sections.get(cmd.section)!.push(cmd);
    });

    let globalIndex = -1;
    return (
        <>
            {Array.from(sections.entries()).map(([section, items]) => (
                <section key={section} className="imcrm-mb-2 last:imcrm-mb-0">
                    <p className="imcrm-px-4 imcrm-py-1 imcrm-text-[10px] imcrm-font-semibold imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                        {section}
                    </p>
                    {items.map((cmd) => {
                        globalIndex++;
                        const idx = globalIndex;
                        const Icon = cmd.icon;
                        const isActive = idx === activeIndex;
                        return (
                            <button
                                key={cmd.id}
                                type="button"
                                onClick={() => onRun(cmd)}
                                onMouseEnter={() => onHover(idx)}
                                disabled={cmd.disabled}
                                className={cn(
                                    'imcrm-flex imcrm-w-full imcrm-items-center imcrm-gap-3 imcrm-px-4 imcrm-py-2 imcrm-text-left imcrm-text-sm imcrm-transition-colors',
                                    isActive && ! cmd.disabled && 'imcrm-bg-accent',
                                    cmd.disabled && 'imcrm-cursor-not-allowed imcrm-opacity-50',
                                )}
                            >
                                <Icon className="imcrm-h-4 imcrm-w-4 imcrm-shrink-0 imcrm-text-muted-foreground" />
                                <span className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col">
                                    <span className="imcrm-truncate imcrm-font-medium">{cmd.label}</span>
                                    {cmd.description && (
                                        <span className="imcrm-truncate imcrm-text-[11px] imcrm-text-muted-foreground">
                                            {cmd.description}
                                        </span>
                                    )}
                                </span>
                                {cmd.keys && (
                                    <kbd className="imcrm-shrink-0 imcrm-rounded imcrm-bg-muted imcrm-px-1.5 imcrm-py-0.5 imcrm-font-mono imcrm-text-[10px]">
                                        {cmd.keys}
                                    </kbd>
                                )}
                            </button>
                        );
                    })}
                </section>
            ))}
        </>
    );
}

function buildCommands({
    config,
    selectedBlockIds,
    preview,
    onAddBlock,
    onSelectBlock,
    onDeleteSelected,
    onDuplicateSelected,
    onTogglePreview,
    onSave,
    onResetFromBuiltin,
    onApplyPreset,
}: Omit<EditorCommandPaletteProps, 'open' | 'onOpenChange'>): Command[] {
    const cmds: Command[] = [];

    // Acciones generales del editor.
    cmds.push({
        id: 'save',
        label: __('Guardar plantilla'),
        icon: Save,
        section: __('Editor'),
        keys: '⌘S',
        keywords: 'save',
        action: onSave,
    });
    cmds.push({
        id: 'toggle-preview',
        label: preview ? __('Volver al editor') : __('Cambiar a preview'),
        icon: preview ? Pencil : Eye,
        section: __('Editor'),
        keys: '⌘P',
        action: onTogglePreview,
    });

    // Selección — solo si hay bloques seleccionados.
    if (selectedBlockIds.length > 0) {
        const count = selectedBlockIds.length;
        cmds.push({
            id: 'duplicate-selected',
            label: count === 1
                ? __('Duplicar bloque seleccionado')
                : __('Duplicar %d bloques seleccionados').replace('%d', String(count)),
            icon: Copy,
            section: __('Selección'),
            keys: '⌘D',
            action: onDuplicateSelected,
        });
        cmds.push({
            id: 'delete-selected',
            label: count === 1
                ? __('Eliminar bloque seleccionado')
                : __('Eliminar %d bloques seleccionados').replace('%d', String(count)),
            icon: Trash2,
            section: __('Selección'),
            keys: '⌫',
            action: onDeleteSelected,
        });
    }

    // Jump to block.
    for (const block of config.blocks) {
        cmds.push({
            id: `jump-${block.id}`,
            label: describeBlock(block),
            description: __('Saltar al bloque'),
            icon: Target,
            section: __('Bloques del canvas'),
            keywords: block.type,
            action: () => onSelectBlock(block.id),
        });
    }

    // Agregar bloque por tipo.
    const blockTypes: Array<{ type: V2BlockType; label: string; icon: LucideIcon; singleton?: boolean }> = [
        { type: 'properties_group', label: __('Agregar grupo de propiedades'), icon: Tag },
        { type: 'related', label: __('Agregar records relacionados'), icon: Network },
        { type: 'files', label: __('Agregar archivos'), icon: Paperclip },
        { type: 'kpi', label: __('Agregar KPI'), icon: Hash },
        { type: 'chart', label: __('Agregar gráfico'), icon: PieChart },
        { type: 'stats', label: __('Agregar resumen'), icon: BarChart3, singleton: true },
        { type: 'timeline', label: __('Agregar timeline'), icon: Activity, singleton: true },
        { type: 'heading', label: __('Agregar título de sección'), icon: Heading },
        { type: 'divider', label: __('Agregar divisor'), icon: Minus },
        { type: 'notes', label: __('Agregar notas'), icon: StickyNote },
        { type: 'markdown', label: __('Agregar markdown'), icon: FileText },
        { type: 'embed', label: __('Agregar embed externo'), icon: Play },
        { type: 'action_button', label: __('Agregar botón de acción'), icon: MousePointerClick },
        { type: 'comments_thread', label: __('Agregar hilo de comentarios'), icon: MessageSquare },
    ];
    const existingTypes = new Set(config.blocks.map((b) => b.type));
    for (const bt of blockTypes) {
        cmds.push({
            id: `add-${bt.type}`,
            label: bt.label,
            icon: bt.icon,
            section: __('Agregar bloque'),
            keywords: bt.type,
            action: () => onAddBlock(bt.type),
            disabled: !! bt.singleton && existingTypes.has(bt.type),
        });
    }

    // Industry presets (Fase 14.C).
    for (const preset of INDUSTRY_PRESETS) {
        cmds.push({
            id: `preset-${preset.id}`,
            label: __('Aplicar preset: %s').replace('%s', preset.name),
            description: preset.description,
            icon: LayoutTemplate,
            section: __('Industry presets'),
            keywords: 'preset industry ' + preset.id,
            action: () => onApplyPreset(preset.id),
        });
    }

    // Restaurar desde built-in.
    for (const tpl of CRM_TEMPLATES) {
        cmds.push({
            id: `restore-${tpl.id}`,
            label: __('Restaurar desde').replace('desde', '') + tpl.name,
            description: tpl.description,
            icon: RotateCcw,
            section: __('Restaurar plantilla'),
            keywords: 'restore restaurar template plantilla ' + tpl.id,
            action: () => onResetFromBuiltin(tpl.id),
        });
    }

    return cmds;
}

function describeBlock(block: V2Block): string {
    switch (block.type) {
        case 'properties_group':
            return block.config.label || __('Grupo de propiedades');
        case 'notes':
            return block.config.title || __('Notas');
        case 'markdown':
            return block.config.title || __('Markdown');
        case 'heading':
            return block.config.text || __('Título de sección');
        case 'divider':
            return block.config.label || __('Divisor');
        case 'comments_thread':
            return block.config.title || __('Hilo de comentarios');
        case 'related':
            return __('Records relacionados (%s)').replace('%s', block.config.field_slug || '?');
        case 'kpi':
            return block.config.label || __('KPI (%s)').replace('%s', block.config.field_slug || '?');
        case 'chart':
            return block.config.title || __('Gráfico (%s)').replace('%s', block.config.relation_field_slug || '?');
        case 'files':
            return block.config.title || __('Archivos');
        case 'embed':
            return block.config.title || __('Embed');
        case 'action_button':
            return block.config.label || __('Botón de acción');
        case 'timeline':
            return __('Timeline');
        case 'stats':
            return __('Resumen');
    }
}

