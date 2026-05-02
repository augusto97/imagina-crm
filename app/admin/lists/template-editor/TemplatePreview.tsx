import { Activity as ActivityIcon, Send } from 'lucide-react';

import { RecordHeader } from '@/admin/records/crm/RecordHeader';
import { PropertiesSidebar } from '@/admin/records/crm/PropertiesSidebar';
import { RightRail } from '@/admin/records/crm/RightRail';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ResolvedLayout } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';
import type { RecordEntity } from '@/types/record';

interface TemplatePreviewProps {
    listId: number;
    fields: FieldEntity[];
    layout: ResolvedLayout;
    sampleRecord: RecordEntity | null;
}

/**
 * Preview en vivo del layout CRM resultante de la configuración del
 * editor. Reusa los mismos componentes que `RecordCrmLayout` (header
 * + sidebar + right rail) pero con un sample record y handlers no-op.
 *
 * La timeline se reemplaza por un placeholder visual — montar la
 * real dispararía mutaciones de comments contra el record sample, lo
 * que sería confuso. El placeholder muestra que ahí va el feed.
 */
export function TemplatePreview({
    listId,
    fields,
    layout,
    sampleRecord,
}: TemplatePreviewProps): JSX.Element {
    const record = sampleRecord ?? mockRecord(fields);

    return (
        <div className="imcrm-pointer-events-none imcrm-flex imcrm-flex-col imcrm-gap-4 imcrm-opacity-95">
            <RecordHeader
                record={record}
                layout={layout}
                onSave={noop}
                onDelete={noop}
                canSave={false}
                saving={false}
                deleting={false}
            />

            <div
                className={cn(
                    'imcrm-grid imcrm-grid-cols-1 imcrm-gap-4',
                    layout.rightRail.length > 0
                        ? 'lg:imcrm-grid-cols-[280px_minmax(0,1fr)_280px]'
                        : 'lg:imcrm-grid-cols-[320px_minmax(0,1fr)]',
                )}
            >
                <PropertiesSidebar
                    layout={layout}
                    values={record.fields}
                    onChange={noop}
                />
                <TimelinePlaceholder />
                <RightRail listId={listId} record={record} layout={layout} />
            </div>
        </div>
    );
}

function TimelinePlaceholder(): JSX.Element {
    return (
        <section className="imcrm-flex imcrm-flex-col imcrm-gap-4 imcrm-rounded-xl imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-5">
            <header className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-font-semibold">
                <ActivityIcon className="imcrm-h-4 imcrm-w-4 imcrm-text-primary" />
                {__('Actividad del registro')}
                <span className="imcrm-text-xs imcrm-font-normal imcrm-text-muted-foreground">
                    {__('(preview — sin interacción)')}
                </span>
            </header>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                <div className="imcrm-flex imcrm-gap-1 imcrm-text-xs imcrm-text-muted-foreground">
                    <span className="imcrm-rounded imcrm-bg-muted imcrm-px-2 imcrm-py-0.5">{__('Nota')}</span>
                    <span className="imcrm-rounded imcrm-bg-muted imcrm-px-2 imcrm-py-0.5">{__('Llamada')}</span>
                    <span className="imcrm-rounded imcrm-bg-muted imcrm-px-2 imcrm-py-0.5">{__('Email')}</span>
                    <span className="imcrm-rounded imcrm-bg-muted imcrm-px-2 imcrm-py-0.5">{__('Reunión')}</span>
                </div>
                <Textarea rows={3} disabled placeholder={__('Composer multi-modo (preview)…')} />
                <div className="imcrm-flex imcrm-justify-end">
                    <Button size="sm" disabled className="imcrm-gap-1.5">
                        <Send className="imcrm-h-3 imcrm-w-3" />
                        {__('Publicar')}
                    </Button>
                </div>
            </div>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-3 imcrm-border-t imcrm-border-border imcrm-pt-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="imcrm-flex imcrm-gap-3">
                        <div className="imcrm-h-8 imcrm-w-8 imcrm-shrink-0 imcrm-rounded-full imcrm-bg-muted" />
                        <div className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-gap-1">
                            <div className="imcrm-h-3 imcrm-w-32 imcrm-rounded imcrm-bg-muted" />
                            <div className="imcrm-h-12 imcrm-rounded-lg imcrm-bg-muted/40" />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function noop(): void {
    /* preview is read-only */
}

/**
 * Si la lista no tiene records aún, generamos un mock con valores
 * sintéticos por tipo. Suficiente para que el editor muestre algo
 * más útil que campos vacíos.
 */
function mockRecord(fields: FieldEntity[]): RecordEntity {
    const sampleByType: Record<string, unknown> = {
        text:        'Ejemplo',
        long_text:   'Texto de ejemplo más largo para mostrar cómo se ve el campo en la vista CRM.',
        email:       'cliente@ejemplo.com',
        url:         'https://ejemplo.com',
        number:      42,
        currency:    1500,
        date:        new Date().toISOString().slice(0, 10),
        datetime:    new Date().toISOString().slice(0, 19),
        checkbox:    true,
        select:      '',
        multi_select: [],
        user:        0,
        file:        0,
    };

    const fieldsBlob: Record<string, unknown> = {};
    for (const f of fields) {
        if (f.type === 'relation') continue;
        // select/multi_select: usamos la primera opción si existe.
        if (f.type === 'select') {
            const opts = (f.config as { options?: Array<{ value: string }> }).options;
            fieldsBlob[f.slug] = Array.isArray(opts) && opts[0] ? opts[0].value : '';
        } else if (f.type === 'multi_select') {
            const opts = (f.config as { options?: Array<{ value: string }> }).options;
            fieldsBlob[f.slug] = Array.isArray(opts) && opts[0] ? [opts[0].value] : [];
        } else {
            fieldsBlob[f.slug] = sampleByType[f.type] ?? '';
        }
    }

    return {
        id: 0,
        fields: fieldsBlob,
        relations: {},
        created_by: 0,
        created_at: new Date().toISOString().replace('Z', '').replace('T', ' '),
        updated_at: new Date().toISOString().replace('Z', '').replace('T', ' '),
    };
}
