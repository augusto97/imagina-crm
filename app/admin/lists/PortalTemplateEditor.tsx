import { useState } from 'react';
import { ChevronDown, ChevronUp, Code, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { __ } from '@/lib/i18n';
import {
    PORTAL_BLOCK_TYPES,
    type PortalBlockType,
    type PortalTemplate,
    type PortalTemplateBlock,
} from '@/types/portal';

interface Props {
    template: PortalTemplate;
    onChange: (template: PortalTemplate) => void;
    /**
     * Toggle del modo "Avanzado (editar JSON crudo)" — útil para
     * usuarios power que quieren copy-paste templates entre listas.
     */
    advancedMode: boolean;
    onAdvancedToggle: (advanced: boolean) => void;
}

/**
 * Editor visual del template del portal (Fase 9 — pulido #3).
 *
 * Reemplaza al textarea JSON crudo + botones "Insertar ejemplo" del
 * `PortalConfigPanel`. Cada bloque del template se renderiza como
 * card colapsable con:
 *  - Header: badge del tipo + título + botones de acción
 *    (subir/bajar/eliminar).
 *  - Body expandido: form con inputs específicos para los campos
 *    más comunes de la config de ese tipo de bloque.
 *  - Para configs avanzadas: un textarea JSON inline (compromiso —
 *    el form no cubre todas las keys posibles).
 *
 * Botón "Agregar bloque" al final con dropdown de tipos disponibles.
 *
 * El usuario power puede activar "Modo avanzado" → ve el JSON crudo
 * del template completo (compromiso para copy-paste).
 */
export function PortalTemplateEditor({
    template,
    onChange,
    advancedMode,
    onAdvancedToggle,
}: Props): JSX.Element {
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [jsonDraft, setJsonDraft] = useState<string>(() => JSON.stringify(template, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);

    if (advancedMode) {
        return (
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                <div className="imcrm-flex imcrm-items-center imcrm-justify-between">
                    <p className="imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Modo avanzado: edita el JSON crudo del template. Útil para copy-paste entre listas.')}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            // Antes de salir del modo avanzado, aplicamos el JSON
                            // si es válido para no perder ediciones del usuario.
                            try {
                                const parsed = JSON.parse(jsonDraft) as PortalTemplate;
                                if (
                                    typeof parsed === 'object' &&
                                    parsed !== null &&
                                    Array.isArray(parsed.blocks)
                                ) {
                                    onChange(parsed);
                                    setJsonError(null);
                                }
                            } catch {
                                /* ignoramos; el usuario decidió salir, mantenemos lo último válido */
                            }
                            onAdvancedToggle(false);
                        }}
                    >
                        {__('← Vista de cards')}
                    </Button>
                </div>
                <Textarea
                    value={jsonDraft}
                    onChange={(e) => {
                        setJsonDraft(e.target.value);
                        try {
                            const parsed = JSON.parse(e.target.value) as PortalTemplate;
                            if (
                                typeof parsed === 'object' &&
                                parsed !== null &&
                                Array.isArray(parsed.blocks)
                            ) {
                                onChange(parsed);
                                setJsonError(null);
                            } else {
                                setJsonError(__('Debe ser { blocks: [...] }'));
                            }
                        } catch (err) {
                            setJsonError(
                                err instanceof Error ? `JSON inválido: ${err.message}` : 'JSON inválido',
                            );
                        }
                    }}
                    rows={16}
                    className="imcrm-font-mono imcrm-text-xs"
                />
                {jsonError !== null && (
                    <p className="imcrm-text-xs imcrm-text-destructive">{jsonError}</p>
                )}
            </div>
        );
    }

    const moveBlock = (from: number, to: number): void => {
        if (to < 0 || to >= template.blocks.length) return;
        const blocks = [...template.blocks];
        const [moved] = blocks.splice(from, 1);
        if (moved !== undefined) {
            blocks.splice(to, 0, moved);
        }
        onChange({ blocks });
        // Mantener expanded en la nueva posición.
        if (expandedIdx === from) setExpandedIdx(to);
        else if (expandedIdx === to) setExpandedIdx(from);
    };

    const deleteBlock = (idx: number): void => {
        const blocks = template.blocks.filter((_, i) => i !== idx);
        onChange({ blocks });
        if (expandedIdx === idx) setExpandedIdx(null);
    };

    const updateBlock = (idx: number, next: PortalTemplateBlock): void => {
        const blocks = template.blocks.map((b, i) => (i === idx ? next : b));
        onChange({ blocks });
    };

    const addBlock = (type: PortalBlockType): void => {
        const newBlock: PortalTemplateBlock = { type, config: defaultConfigFor(type) };
        onChange({ blocks: [...template.blocks, newBlock] });
        setExpandedIdx(template.blocks.length); // expandir el nuevo
        setShowAddMenu(false);
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
            <div className="imcrm-flex imcrm-items-center imcrm-justify-between">
                <p className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Arma el template con bloques. Cliquea en cada uno para configurarlo.')}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setJsonDraft(JSON.stringify(template, null, 2));
                        setJsonError(null);
                        onAdvancedToggle(true);
                    }}
                    className="imcrm-gap-1.5"
                >
                    <Code className="imcrm-h-3.5 imcrm-w-3.5" />
                    {__('Modo avanzado (JSON)')}
                </Button>
            </div>

            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                {template.blocks.length === 0 ? (
                    <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/30 imcrm-px-3 imcrm-py-6 imcrm-text-center imcrm-text-sm imcrm-text-muted-foreground">
                        {__('Sin bloques. Agrega uno con el botón de abajo para empezar.')}
                    </p>
                ) : (
                    template.blocks.map((block, idx) => (
                        <BlockCard
                            key={idx}
                            block={block}
                            expanded={expandedIdx === idx}
                            onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                            onMoveUp={() => moveBlock(idx, idx - 1)}
                            onMoveDown={() => moveBlock(idx, idx + 1)}
                            onDelete={() => deleteBlock(idx)}
                            onUpdate={(next) => updateBlock(idx, next)}
                            canMoveUp={idx > 0}
                            canMoveDown={idx < template.blocks.length - 1}
                        />
                    ))
                )}
            </div>

            <div className="imcrm-relative">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="imcrm-w-full imcrm-justify-center imcrm-gap-2"
                >
                    <Plus className="imcrm-h-4 imcrm-w-4" />
                    {__('Agregar bloque')}
                </Button>
                {showAddMenu && (
                    <div className="imcrm-absolute imcrm-z-10 imcrm-mt-1 imcrm-w-full imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-background imcrm-shadow-md">
                        {PORTAL_BLOCK_TYPES.map((bt) => (
                            <button
                                key={bt.value}
                                type="button"
                                onClick={() => addBlock(bt.value)}
                                className="imcrm-flex imcrm-w-full imcrm-items-center imcrm-justify-start imcrm-gap-2 imcrm-px-3 imcrm-py-2 imcrm-text-left imcrm-text-sm hover:imcrm-bg-muted"
                            >
                                <Plus className="imcrm-h-3.5 imcrm-w-3.5 imcrm-text-muted-foreground" />
                                {bt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface BlockCardProps {
    block: PortalTemplateBlock;
    expanded: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onToggle: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDelete: () => void;
    onUpdate: (next: PortalTemplateBlock) => void;
}

function BlockCard({
    block,
    expanded,
    canMoveUp,
    canMoveDown,
    onToggle,
    onMoveUp,
    onMoveDown,
    onDelete,
    onUpdate,
}: BlockCardProps): JSX.Element {
    const typeInfo = PORTAL_BLOCK_TYPES.find((bt) => bt.value === block.type);
    const label = typeInfo?.label ?? block.type;
    const title = (block.config.title as string | undefined) ?? null;

    return (
        <div className="imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card">
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-px-3 imcrm-py-2">
                <button
                    type="button"
                    onClick={onToggle}
                    className="imcrm-flex imcrm-flex-1 imcrm-min-w-0 imcrm-items-center imcrm-gap-2"
                >
                    {expanded ? (
                        <ChevronUp className="imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                    ) : (
                        <ChevronDown className="imcrm-h-4 imcrm-w-4 imcrm-text-muted-foreground" />
                    )}
                    <span className="imcrm-rounded imcrm-bg-muted imcrm-px-2 imcrm-py-0.5 imcrm-text-xs imcrm-font-mono imcrm-text-muted-foreground">
                        {block.type}
                    </span>
                    <span className="imcrm-truncate imcrm-text-sm imcrm-font-medium">
                        {title ?? label}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={onMoveUp}
                    disabled={!canMoveUp}
                    aria-label={__('Subir bloque')}
                    className="imcrm-rounded imcrm-p-1 hover:imcrm-bg-muted disabled:imcrm-opacity-30"
                >
                    <ChevronUp className="imcrm-h-3.5 imcrm-w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onMoveDown}
                    disabled={!canMoveDown}
                    aria-label={__('Bajar bloque')}
                    className="imcrm-rounded imcrm-p-1 hover:imcrm-bg-muted disabled:imcrm-opacity-30"
                >
                    <ChevronDown className="imcrm-h-3.5 imcrm-w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label={__('Eliminar bloque')}
                    className="imcrm-rounded imcrm-p-1 imcrm-text-destructive hover:imcrm-bg-destructive/10"
                >
                    <Trash2 className="imcrm-h-3.5 imcrm-w-3.5" />
                </button>
            </div>
            {expanded && (
                <div className="imcrm-border-t imcrm-border-border imcrm-px-3 imcrm-py-3">
                    <BlockConfigForm block={block} onUpdate={onUpdate} />
                </div>
            )}
        </div>
    );
}

/**
 * Form para editar el `config` de un bloque. Renderiza inputs
 * específicos para los campos más comunes de cada tipo. Para keys
 * exóticas que el form no cubre, hay un textarea JSON al final
 * ("Configuración avanzada").
 */
function BlockConfigForm({
    block,
    onUpdate,
}: {
    block: PortalTemplateBlock;
    onUpdate: (next: PortalTemplateBlock) => void;
}): JSX.Element {
    const setConfigKey = (key: string, value: unknown): void => {
        onUpdate({ ...block, config: { ...block.config, [key]: value } });
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-text-sm">
            <ConfigField label={__('Título')}>
                <Input
                    value={(block.config.title as string) ?? ''}
                    onChange={(e) => setConfigKey('title', e.target.value || undefined)}
                    placeholder={__('(opcional)')}
                />
            </ConfigField>

            {block.type === 'static_text' && (
                <ConfigField label={__('HTML')}>
                    <Textarea
                        value={(block.config.html as string) ?? ''}
                        onChange={(e) => setConfigKey('html', e.target.value)}
                        rows={4}
                        className="imcrm-font-mono imcrm-text-xs"
                    />
                </ConfigField>
            )}

            {block.type === 'client_data' && (
                <ConfigField
                    label={__('Slugs visibles')}
                    hint={__('Lista separada por comas: nombre, email, telefono')}
                >
                    <SlugsInput
                        value={(block.config.visible_field_slugs as string[]) ?? []}
                        onChange={(slugs) => setConfigKey('visible_field_slugs', slugs)}
                    />
                </ConfigField>
            )}

            {block.type === 'editable_form' && (
                <>
                    <ConfigField
                        label={__('Slugs editables')}
                        hint={__('Solo estos campos serán editables por el cliente.')}
                    >
                        <SlugsInput
                            value={(block.config.editable_field_slugs as string[]) ?? []}
                            onChange={(slugs) => setConfigKey('editable_field_slugs', slugs)}
                        />
                    </ConfigField>
                    <ConfigField label={__('Texto del botón')}>
                        <Input
                            value={(block.config.submit_label as string) ?? ''}
                            onChange={(e) => setConfigKey('submit_label', e.target.value || undefined)}
                            placeholder={__('Guardar')}
                        />
                    </ConfigField>
                </>
            )}

            {block.type === 'related_records_table' && (
                <>
                    <ConfigField label={__('Slug de la lista')}>
                        <Input
                            value={(block.config.list_slug as string) ?? ''}
                            onChange={(e) => setConfigKey('list_slug', e.target.value)}
                            placeholder={__('facturas')}
                        />
                    </ConfigField>
                    <ConfigField label={__('Slugs visibles')}>
                        <SlugsInput
                            value={(block.config.visible_field_slugs as string[]) ?? []}
                            onChange={(slugs) => setConfigKey('visible_field_slugs', slugs)}
                        />
                    </ConfigField>
                    <ConfigField label={__('Registros por página')}>
                        <Input
                            type="number"
                            min={1}
                            max={100}
                            value={(block.config.per_page as number) ?? 10}
                            onChange={(e) => setConfigKey('per_page', parseInt(e.target.value || '10', 10))}
                        />
                    </ConfigField>
                </>
            )}

            {block.type === 'kpi_widget' && (
                <>
                    <ConfigField label={__('Slug de la lista')}>
                        <Input
                            value={(block.config.list_slug as string) ?? ''}
                            onChange={(e) => setConfigKey('list_slug', e.target.value)}
                            placeholder={__('facturas')}
                        />
                    </ConfigField>
                    <ConfigField label={__('ID del campo (0 para count)')}>
                        <Input
                            type="number"
                            min={0}
                            value={(block.config.field_id as number) ?? 0}
                            onChange={(e) => setConfigKey('field_id', parseInt(e.target.value || '0', 10))}
                        />
                    </ConfigField>
                    <ConfigField label={__('Métrica')}>
                        <select
                            className="imcrm-h-9 imcrm-w-full imcrm-rounded-md imcrm-border imcrm-border-input imcrm-bg-background imcrm-px-3 imcrm-text-sm"
                            value={(block.config.metric as string) ?? 'count'}
                            onChange={(e) => setConfigKey('metric', e.target.value)}
                        >
                            <option value="count">count</option>
                            <option value="sum">sum</option>
                            <option value="avg">avg</option>
                            <option value="min">min</option>
                            <option value="max">max</option>
                        </select>
                    </ConfigField>
                    <ConfigField label={__('Prefijo / sufijo')} hint={__('Ej. "$" / " USD"')}>
                        <div className="imcrm-flex imcrm-gap-2">
                            <Input
                                value={(block.config.prefix as string) ?? ''}
                                onChange={(e) => setConfigKey('prefix', e.target.value || undefined)}
                                placeholder={__('Prefijo')}
                            />
                            <Input
                                value={(block.config.suffix as string) ?? ''}
                                onChange={(e) => setConfigKey('suffix', e.target.value || undefined)}
                                placeholder={__('Sufijo')}
                            />
                        </div>
                    </ConfigField>
                </>
            )}

            {block.type === 'external_link' && (
                <>
                    <ConfigField label={__('URL')}>
                        <Input
                            type="url"
                            value={(block.config.href as string) ?? ''}
                            onChange={(e) => setConfigKey('href', e.target.value)}
                            placeholder="https://example.com"
                        />
                    </ConfigField>
                    <ConfigField label={__('Texto del botón')}>
                        <Input
                            value={(block.config.label as string) ?? ''}
                            onChange={(e) => setConfigKey('label', e.target.value)}
                            placeholder={__('Visitar')}
                        />
                    </ConfigField>
                    <ConfigField label={__('Descripción')}>
                        <Input
                            value={(block.config.description as string) ?? ''}
                            onChange={(e) => setConfigKey('description', e.target.value || undefined)}
                            placeholder={__('(opcional)')}
                        />
                    </ConfigField>
                </>
            )}

            {block.type === 'activity_timeline' && (
                <ConfigField label={__('Límite de eventos')}>
                    <Input
                        type="number"
                        min={1}
                        max={200}
                        value={(block.config.limit as number) ?? 20}
                        onChange={(e) => setConfigKey('limit', parseInt(e.target.value || '20', 10))}
                    />
                </ConfigField>
            )}

            {block.type === 'download_files' && (
                <ConfigField
                    label={__('Slug del campo de archivo')}
                    hint={__('Field tipo `file` que guarda los attachment IDs.')}
                >
                    <Input
                        value={(block.config.field_slug as string) ?? ''}
                        onChange={(e) => setConfigKey('field_slug', e.target.value)}
                        placeholder={__('archivo_adjunto')}
                    />
                </ConfigField>
            )}
        </div>
    );
}

function ConfigField({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
            <label className="imcrm-text-xs imcrm-font-medium imcrm-text-muted-foreground">
                {label}
            </label>
            {children}
            {hint !== undefined && (
                <span className="imcrm-text-xs imcrm-text-muted-foreground/80">{hint}</span>
            )}
        </div>
    );
}

/**
 * Input para listas de slugs separadas por coma. Convierte de/a `string[]`
 * transparentemente.
 */
function SlugsInput({
    value,
    onChange,
}: {
    value: string[];
    onChange: (slugs: string[]) => void;
}): JSX.Element {
    return (
        <Input
            value={value.join(', ')}
            onChange={(e) => {
                const slugs = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s !== '');
                onChange(slugs);
            }}
            placeholder={__('nombre, email, telefono')}
        />
    );
}

/**
 * Config default cuando se agrega un nuevo bloque. Más conservador
 * que el `exampleConfigFor` del panel — el usuario completa con sus
 * datos.
 */
function defaultConfigFor(type: PortalBlockType): Record<string, unknown> {
    switch (type) {
        case 'static_text':
            return { title: 'Bienvenida', html: '<p>...</p>' };
        case 'client_data':
            return { title: 'Mis datos', visible_field_slugs: [] };
        case 'editable_form':
            return { title: 'Actualizar mis datos', editable_field_slugs: [], submit_label: 'Guardar' };
        case 'related_records_table':
            return { title: '', list_slug: '', visible_field_slugs: [], per_page: 10 };
        case 'kpi_widget':
            return { title: '', list_slug: '', field_id: 0, metric: 'count' };
        case 'external_link':
            return { title: '', href: '', label: 'Abrir', new_window: true };
        case 'activity_timeline':
            return { title: 'Actividad reciente', limit: 20 };
        case 'download_files':
            return { title: 'Archivos', field_slug: '' };
        default:
            return {};
    }
}
