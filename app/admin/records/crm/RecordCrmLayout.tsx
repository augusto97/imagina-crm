import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useUpdateRecord } from '@/hooks/useRecords';
import { ApiError } from '@/lib/api';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';
import type { ListSummary } from '@/types/list';
import type { RecordEntity } from '@/types/record';

import { PropertiesSidebar } from './PropertiesSidebar';
import { RecordHeader } from './RecordHeader';
import { RecordTimeline } from './RecordTimeline';

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
 * Estructura:
 *   ┌────────────────────────────────────────────────────────┐
 *   │ Header: avatar + título + status badges + acciones      │
 *   ├──────────────────┬─────────────────────────────────────┤
 *   │  Sidebar izq.    │   Timeline                           │
 *   │  (props          │   (composer + comments + activity   │
 *   │   colapsables)   │    merged feed)                      │
 *   └──────────────────┴─────────────────────────────────────┘
 *
 * El form lineal del layout classic queda reemplazado por
 * `PropertiesSidebar` con grupos auto-categorizados.
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
                fields={fields}
                onSave={() => void handleSave()}
                onDelete={onDelete}
                canSave={dirty}
                saving={update.isPending}
                deleting={deleting}
            />

            <div className="imcrm-grid imcrm-grid-cols-1 imcrm-gap-4 lg:imcrm-grid-cols-[360px_1fr]">
                <PropertiesSidebar
                    fields={fields}
                    values={values}
                    onChange={setValues}
                    fieldErrors={fieldErrors}
                />
                <RecordTimeline
                    listId={list.id}
                    recordId={record.id}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                />
            </div>
        </div>
    );
}
