import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import type { LayoutItem } from 'react-grid-layout';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useUpdateRecord } from '@/hooks/useRecords';
import { ApiError } from '@/lib/api';
import { getResolvedV2 } from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';
import type { ListSummary } from '@/types/list';
import type { RecordEntity } from '@/types/record';

import { BlockRenderer } from './BlockRenderer';
import { RecordHeader } from './RecordHeader';

const SizedGrid = WidthProvider(GridLayout);

interface RecordCrmLayoutProps {
    list: ListSummary;
    record: RecordEntity;
    fields: FieldEntity[];
    currentUserId: number;
    isAdmin: boolean;
    onDelete: () => void;
    deleting: boolean;
}

/**
 * Layout estilo CRM panel (HubSpot/Pipedrive). Activado opt-in
 * cuando la lista tiene `settings.record_layout === 'crm'`.
 *
 * 0.35.0: rendering basado en grid de 12 columnas usando
 * `react-grid-layout` en modo static (read-only). El header sigue
 * fijo arriba (full width); todo lo demás (properties groups,
 * timeline, stats, related, notes) son bloques en el grid con
 * posiciones declaradas por la plantilla activa (built-in o custom
 * del editor visual).
 *
 * El editor visual (`/lists/:slug/template-editor`) muestra el mismo
 * grid en modo `isDraggable + isResizable`, así "lo que ves al editar
 * es lo que ves en la ficha".
 */
export function RecordCrmLayout({
    list,
    record,
    fields,
    currentUserId,
    isAdmin,
    onDelete,
    deleting,
}: RecordCrmLayoutProps): JSX.Element {
    const update = useUpdateRecord(list.id);
    const toast = useToast();

    const initialValues = useMemo<Record<string, unknown>>(
        () => ({ ...record.fields, ...record.relations }),
        [record],
    );
    const [values, setValues] = useState<Record<string, unknown>>(initialValues);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setValues(initialValues);
        setFieldErrors({});
    }, [initialValues]);

    const resolved = useMemo(
        () => getResolvedV2(list.settings as Parameters<typeof getResolvedV2>[0], fields),
        [list.settings, fields],
    );

    // Header layout simple para alimentar al `<RecordHeader>` (sigue
    // consumiendo el `ResolvedLayout` V1; le pasamos un objeto
    // compat con sólo los slots de header poblados).
    const headerLayoutCompat = useMemo(
        () => ({
            titleField: resolved.header.titleField,
            subtitleFields: resolved.header.subtitleFields,
            statusFields: resolved.header.statusFields,
            quickActions: resolved.header.quickActions,
            sidebarGroups: [],
            rightRail: [],
            leftover: [],
        }),
        [resolved.header],
    );

    const gridLayout: LayoutItem[] = useMemo(
        () =>
            resolved.blocks.map((b) => ({
                i: b.id,
                x: b.x,
                y: b.y,
                w: b.w,
                h: b.h,
                static: true,
            })),
        [resolved.blocks],
    );

    const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);

    const handleSave = async (): Promise<void> => {
        setFieldErrors({});
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(values)) {
            if (JSON.stringify(v) !== JSON.stringify(initialValues[k])) {
                patch[k] = v;
            }
        }
        if (Object.keys(patch).length === 0) return;
        try {
            await update.mutateAsync({ id: record.id, values: patch });
            toast.success(__('Cambios guardados'));
        } catch (err) {
            if (err instanceof ApiError) {
                setFieldErrors(err.errors);
                toast.error(__('No se pudo guardar'), err.message);
            } else if (err instanceof Error) {
                toast.error(__('No se pudo guardar'), err.message);
            }
        }
    };

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-4">
            <Button asChild variant="ghost" size="sm" className="imcrm-gap-2 imcrm-self-start imcrm-text-muted-foreground">
                <Link to={`/lists/${list.slug}/records`}>
                    <ArrowLeft className="imcrm-h-4 imcrm-w-4" />
                    {list.name}
                </Link>
            </Button>

            <RecordHeader
                record={record}
                layout={headerLayoutCompat}
                onSave={() => void handleSave()}
                onDelete={onDelete}
                canSave={dirty}
                saving={update.isPending}
                deleting={deleting}
            />

            {resolved.blocks.length === 0 ? (
                <p className="imcrm-rounded-lg imcrm-border imcrm-border-dashed imcrm-border-border imcrm-px-4 imcrm-py-8 imcrm-text-center imcrm-text-sm imcrm-text-muted-foreground">
                    {__('La plantilla activa no tiene bloques. Editá la plantilla en "Editar lista → Apariencia del registro".')}
                </p>
            ) : (
                <SizedGrid
                    className="imcrm-record-grid"
                    cols={12}
                    rowHeight={48}
                    margin={[16, 16]}
                    containerPadding={[0, 0]}
                    layout={gridLayout}
                    isDraggable={false}
                    isResizable={false}
                    compactType="vertical"
                >
                    {resolved.blocks.map((b) => (
                        <div key={b.id} className="imcrm-record-block">
                            <BlockRenderer
                                block={b}
                                listId={list.id}
                                recordId={record.id}
                                currentUserId={currentUserId}
                                isAdmin={isAdmin}
                                values={values}
                                onChange={setValues}
                                fieldErrors={fieldErrors}
                                record={record}
                            />
                        </div>
                    ))}
                </SizedGrid>
            )}
        </div>
    );
}
