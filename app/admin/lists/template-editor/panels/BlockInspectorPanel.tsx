import { Copy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import type { V2Block } from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';

import {
    ActionButtonForm,
    ChartForm,
    CommentsThreadForm,
    DividerForm,
    EmbedForm,
    FilesForm,
    HeaderForm,
    HeadingForm,
    KpiForm,
    MarkdownForm,
    NotesForm,
    PropertiesGroupForm,
    RelatedForm,
    StatsForm,
} from '../forms/BlockForms';

interface BlockInspectorPanelProps {
    block: V2Block;
    fields: FieldEntity[];
    onUpdate: (patch: Partial<V2Block>) => void;
    onDelete: () => void;
    onDuplicate?: () => void;
}

/**
 * Panel persistente de inspección de bloque (columna derecha del
 * editor de plantilla CRM, Fase 11.A+). Reemplaza el `BlockConfigDialog`
 * modal del MVP previo. Switchea por `block.type` y rendera el form
 * apropiado.
 *
 * Los bloques sin opciones (`timeline`, `stats`) muestran un mensaje
 * informativo. La acción de eliminar también vive acá (botón al pie).
 */
export function BlockInspectorPanel({
    block,
    fields,
    onUpdate,
    onDelete,
    onDuplicate,
}: BlockInspectorPanelProps): JSX.Element {
    const confirm = useConfirm();

    const handleDelete = async (): Promise<void> => {
        const ok = await confirm({
            title: __('Eliminar bloque'),
            description: __('Lo podés volver a agregar después desde la paleta.'),
            destructive: true,
            confirmLabel: __('Eliminar'),
        });
        if (! ok) return;
        onDelete();
    };

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col">
            <header className="imcrm-flex imcrm-flex-col imcrm-gap-0.5 imcrm-border-b imcrm-border-border imcrm-px-4 imcrm-py-3">
                <p className="imcrm-text-[10px] imcrm-font-medium imcrm-uppercase imcrm-tracking-wider imcrm-text-muted-foreground">
                    {__('Bloque')}
                </p>
                <h3 className="imcrm-text-sm imcrm-font-semibold imcrm-tracking-tight">
                    {titleForType(block.type)}
                </h3>
                <p className="imcrm-text-[11px] imcrm-text-muted-foreground">
                    {descriptionForType(block.type)}
                </p>
            </header>

            <div className="imcrm-flex-1 imcrm-overflow-y-auto imcrm-px-4 imcrm-py-4">
                {block.type === 'header' && (
                    <HeaderForm
                        block={block}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'properties_group' && (
                    <PropertiesGroupForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'notes' && (
                    <NotesForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'related' && (
                    <RelatedForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'timeline' && (
                    <p className="imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-3 imcrm-py-4 imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Este bloque no tiene opciones configurables. Movelo o cambiá su tamaño con el grid.')}
                    </p>
                )}
                {block.type === 'stats' && (
                    <StatsForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'kpi' && (
                    <KpiForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'chart' && (
                    <ChartForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'files' && (
                    <FilesForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'embed' && (
                    <EmbedForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'action_button' && (
                    <ActionButtonForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'markdown' && (
                    <MarkdownForm
                        block={block}
                        fields={fields}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'divider' && (
                    <DividerForm
                        block={block}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'heading' && (
                    <HeadingForm
                        block={block}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
                {block.type === 'comments_thread' && (
                    <CommentsThreadForm
                        block={block}
                        onUpdate={(patch) => onUpdate(patch as Partial<V2Block>)}
                    />
                )}
            </div>

            <footer className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-px-4 imcrm-py-3">
                <span className="imcrm-truncate imcrm-text-[10px] imcrm-text-muted-foreground" title={block.id}>
                    {block.id}
                </span>
                <div className="imcrm-flex imcrm-gap-1.5">
                    {onDuplicate && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="imcrm-gap-1.5"
                            onClick={onDuplicate}
                        >
                            <Copy className="imcrm-h-3.5 imcrm-w-3.5" />
                            {__('Duplicar')}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="imcrm-gap-1.5 imcrm-text-destructive hover:imcrm-bg-destructive/10 hover:imcrm-text-destructive"
                        onClick={() => void handleDelete()}
                    >
                        <Trash2 className="imcrm-h-3.5 imcrm-w-3.5" />
                        {__('Eliminar')}
                    </Button>
                </div>
            </footer>
        </div>
    );
}

function titleForType(type: V2Block['type']): string {
    switch (type) {
        case 'header':           return __('Encabezado');
        case 'properties_group': return __('Grupo de propiedades');
        case 'notes':            return __('Notas');
        case 'related':          return __('Records relacionados');
        case 'timeline':         return __('Timeline');
        case 'stats':            return __('Resumen');
        case 'kpi':              return __('KPI');
        case 'chart':            return __('Gráfico');
        case 'files':            return __('Archivos');
        case 'embed':            return __('Embed externo');
        case 'action_button':    return __('Botón de acción');
        case 'markdown':         return __('Markdown');
        case 'divider':          return __('Divisor');
        case 'heading':          return __('Título de sección');
        case 'comments_thread':  return __('Hilo de comentarios');
    }
}

function descriptionForType(type: V2Block['type']): string {
    switch (type) {
        case 'header':           return __('Avatar, título, status pills y acciones del registro.');
        case 'properties_group': return __('Nombre, icono y campos de este grupo.');
        case 'notes':            return __('Texto custom static por lista.');
        case 'related':          return __('Relation field a renderear.');
        case 'timeline':         return __('Feed de actividad y comentarios.');
        case 'stats':            return __('Resumen del record (sin opciones).');
        case 'kpi':              return __('Número grande con label y meta.');
        case 'chart':            return __('Distribución de relacionados.');
        case 'files':            return __('Archivos adjuntos del record.');
        case 'embed':            return __('iframe externo (whitelist).');
        case 'action_button':    return __('URL, mailto, tel o copy.');
        case 'markdown':         return __('Texto rich con markdown ligero.');
        case 'divider':          return __('Línea horizontal con label opcional.');
        case 'heading':          return __('Título de sección con nivel jerárquico.');
        case 'comments_thread':  return __('Hilo de comentarios del record.');
    }
}
