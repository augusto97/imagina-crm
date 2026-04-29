import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ImportDialogProps {
    listId: number;
    listSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface PreviewResponse {
    headers: string[];
    sample: string[][];
    total_rows: number;
    suggested_mapping: Record<string, string>;
    fields: Array<{ id: number; slug: string; label: string; type: string }>;
}

interface RunResponse {
    imported: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
    truncated: boolean;
}

type Step = 'upload' | 'map' | 'done';

/**
 * Importa registros desde un CSV (export de ClickUp / Airtable / Excel
 * "Save as CSV" / Google Sheets) hacia una lista de Imagina CRM.
 *
 * Flujo en tres pasos:
 *  1. Upload — el usuario selecciona el archivo. Lo leemos como texto
 *     en el browser (FileReader, no upload binario) y POST a `/preview`.
 *  2. Map — backend devolvió cabeceras + muestra + sugerencia de
 *     mapping. El usuario ajusta `csv_column_idx → field_slug` y
 *     dispara el run.
 *  3. Done — summary con `imported / skipped / errors[]`.
 *
 * No subimos el CSV vía multipart por simplicidad — para CSVs típicos
 * (< 5 MB) el body inline es más fácil de manejar y suficiente.
 */
export function ImportDialog({
    listId,
    listSlug,
    open,
    onOpenChange,
}: ImportDialogProps): JSX.Element {
    const qc = useQueryClient();
    const [step, setStep] = useState<Step>('upload');
    const [csv, setCsv] = useState<string>('');
    const [fileName, setFileName] = useState<string>('');
    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [mapping, setMapping] = useState<Record<number, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<boolean>(false);
    const [result, setResult] = useState<RunResponse | null>(null);

    const reset = (): void => {
        setStep('upload');
        setCsv('');
        setFileName('');
        setPreview(null);
        setMapping({});
        setError(null);
        setResult(null);
    };

    const handleFile = (file: File): void => {
        setError(null);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = async () => {
            const text = typeof reader.result === 'string' ? reader.result : '';
            setCsv(text);
            setBusy(true);
            try {
                const res = await api.post<PreviewResponse>(
                    `/lists/${listSlug}/import/preview`,
                    { csv: text },
                );
                setPreview(res.data);
                setMapping(
                    Object.fromEntries(
                        Object.entries(res.data.suggested_mapping).map(([k, v]) => [Number(k), v]),
                    ),
                );
                setStep('map');
            } catch (err) {
                setError(err instanceof ApiError ? err.message : __('No se pudo leer el archivo.'));
            } finally {
                setBusy(false);
            }
        };
        reader.onerror = () => {
            setError(__('No se pudo leer el archivo.'));
        };
        // CSV es siempre texto plano; UTF-8 con fallback Latin-1 lo
        // maneja el backend (CsvParser).
        reader.readAsText(file, 'UTF-8');
    };

    const runImport = async (): Promise<void> => {
        if (preview === null) return;
        setBusy(true);
        setError(null);
        try {
            // Filtramos las columnas con slug vacío (= "no importar").
            const cleanMapping: Record<number, string> = {};
            for (const [k, v] of Object.entries(mapping)) {
                if (v && v !== '') cleanMapping[Number(k)] = v;
            }
            if (Object.keys(cleanMapping).length === 0) {
                setError(__('Mapea al menos una columna a un campo de la lista.'));
                setBusy(false);
                return;
            }
            const res = await api.post<RunResponse>(
                `/lists/${listSlug}/import/run`,
                { csv, mapping: cleanMapping },
            );
            setResult(res.data);
            setStep('done');
            // Invalida las queries de records para que la tabla se
            // refresque al cerrar el diálogo.
            await qc.invalidateQueries({ queryKey: ['records', listId] });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : __('Error al importar.'));
        } finally {
            setBusy(false);
        }
    };

    const close = (): void => {
        onOpenChange(false);
        // Pequeño delay para que el usuario no vea el reset durante el
        // close transition.
        setTimeout(reset, 200);
    };

    return (
        <Dialog.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={cn(
                        'imcrm-fixed imcrm-inset-0 imcrm-z-50 imcrm-bg-black/40 imcrm-backdrop-blur-sm',
                    )}
                />
                <Dialog.Content
                    className={cn(
                        'imcrm-fixed imcrm-left-1/2 imcrm-top-1/2 imcrm-z-50 imcrm-w-full imcrm-max-w-3xl',
                        'imcrm--translate-x-1/2 imcrm--translate-y-1/2',
                        'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-6 imcrm-shadow-imcrm-lg',
                        'imcrm-max-h-[90vh] imcrm-overflow-y-auto',
                    )}
                >
                    <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                        <Dialog.Title className="imcrm-text-base imcrm-font-semibold">
                            {__('Importar desde CSV')}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" aria-label={__('Cerrar')}>
                                <X className="imcrm-h-4 imcrm-w-4" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    <p className="imcrm-mt-1 imcrm-text-xs imcrm-text-muted-foreground">
                        {__('Acepta exports de ClickUp, Airtable, Excel (Guardar como CSV) y Google Sheets. Detecta delimiter (`,` / `;` / tab) y encoding automáticamente.')}
                    </p>

                    {error !== null && (
                        <div className="imcrm-mt-3 imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-px-3 imcrm-py-2 imcrm-text-xs imcrm-text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="imcrm-mt-4">
                        {step === 'upload' && (
                            <UploadStep busy={busy} onFile={handleFile} fileName={fileName} />
                        )}
                        {step === 'map' && preview !== null && (
                            <MapStep
                                preview={preview}
                                mapping={mapping}
                                onMappingChange={setMapping}
                            />
                        )}
                        {step === 'done' && result !== null && (
                            <DoneStep result={result} />
                        )}
                    </div>

                    <div className="imcrm-mt-5 imcrm-flex imcrm-justify-end imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-pt-4">
                        {step === 'map' && (
                            <>
                                <Button variant="outline" onClick={() => setStep('upload')}>
                                    {__('Atrás')}
                                </Button>
                                <Button onClick={runImport} disabled={busy} className="imcrm-gap-2">
                                    {busy && <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />}
                                    {__('Importar')}
                                </Button>
                            </>
                        )}
                        {step === 'done' && (
                            <Button onClick={close}>{__('Cerrar')}</Button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function UploadStep({
    busy,
    onFile,
    fileName,
}: {
    busy: boolean;
    onFile: (f: File) => void;
    fileName: string;
}): JSX.Element {
    return (
        <label
            className={cn(
                'imcrm-flex imcrm-cursor-pointer imcrm-flex-col imcrm-items-center imcrm-justify-center imcrm-gap-3 imcrm-rounded-md imcrm-border imcrm-border-dashed imcrm-border-border imcrm-bg-muted/20 imcrm-p-10 imcrm-text-center hover:imcrm-bg-muted/40',
                busy && 'imcrm-pointer-events-none imcrm-opacity-60',
            )}
        >
            <FileUp className="imcrm-h-8 imcrm-w-8 imcrm-text-muted-foreground" />
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
                <span className="imcrm-text-sm imcrm-font-medium imcrm-text-foreground">
                    {fileName !== '' ? fileName : __('Selecciona un archivo CSV')}
                </span>
                <span className="imcrm-text-xs imcrm-text-muted-foreground">
                    {__('Click o arrastra. Tamaño máximo recomendado: 5 MB / 5 000 filas.')}
                </span>
            </div>
            {busy && <Loader2 className="imcrm-h-5 imcrm-w-5 imcrm-animate-spin imcrm-text-muted-foreground" />}
            <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                }}
                className="imcrm-sr-only"
                disabled={busy}
            />
        </label>
    );
}

function MapStep({
    preview,
    mapping,
    onMappingChange,
}: {
    preview: PreviewResponse;
    mapping: Record<number, string>;
    onMappingChange: (next: Record<number, string>) => void;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-text-xs imcrm-text-muted-foreground">
                <span>
                    {preview.total_rows.toLocaleString()} {__('filas detectadas')} ·{' '}
                    {preview.headers.length} {__('columnas')}
                </span>
                <span>{__('Mapea cada columna del CSV a un campo de la lista. Deja "—" para ignorar.')}</span>
            </div>

            <div className="imcrm-overflow-auto imcrm-rounded-md imcrm-border imcrm-border-border">
                <table className="imcrm-w-full imcrm-text-xs">
                    <thead className="imcrm-bg-muted/30 imcrm-text-left imcrm-text-muted-foreground">
                        <tr>
                            <th className="imcrm-px-2 imcrm-py-2 imcrm-font-medium">{__('Columna CSV')}</th>
                            <th className="imcrm-px-2 imcrm-py-2 imcrm-font-medium">{__('Campo destino')}</th>
                            <th className="imcrm-px-2 imcrm-py-2 imcrm-font-medium">{__('Ejemplos')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {preview.headers.map((header, idx) => {
                            const examples = preview.sample
                                .slice(0, 3)
                                .map((r) => r[idx] ?? '')
                                .filter((v) => v !== '');
                            return (
                                <tr key={idx} className="imcrm-border-t imcrm-border-border">
                                    <td className="imcrm-px-2 imcrm-py-2 imcrm-font-medium imcrm-text-foreground">
                                        {header || `(${__('columna')} ${idx + 1})`}
                                    </td>
                                    <td className="imcrm-px-2 imcrm-py-2">
                                        <Select
                                            value={mapping[idx] ?? ''}
                                            onChange={(e) => {
                                                const next = { ...mapping };
                                                if (e.target.value === '') {
                                                    delete next[idx];
                                                } else {
                                                    next[idx] = e.target.value;
                                                }
                                                onMappingChange(next);
                                            }}
                                            className="imcrm-h-8"
                                        >
                                            <option value="">{__('— Ignorar —')}</option>
                                            {preview.fields.map((f) => (
                                                <option key={f.id} value={f.slug}>
                                                    {f.label} ({f.type})
                                                </option>
                                            ))}
                                        </Select>
                                    </td>
                                    <td className="imcrm-px-2 imcrm-py-2 imcrm-text-muted-foreground imcrm-truncate imcrm-max-w-xs">
                                        {examples.join(' · ') || '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="imcrm-text-[10px] imcrm-text-muted-foreground">
                {__('Las columnas no mapeadas se ignoran. Filas con errores de validación se reportan al final; el resto se importa igual.')}
            </p>
        </div>
    );
}

function DoneStep({ result }: { result: RunResponse }): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-success/40 imcrm-bg-success/10 imcrm-p-3 imcrm-text-sm imcrm-text-foreground">
                <CheckCircle2 className="imcrm-h-5 imcrm-w-5 imcrm-text-success" />
                <span>
                    {result.imported.toLocaleString()} {__('registros importados')}
                    {result.skipped > 0 && (
                        <>
                            {' · '}
                            <span className="imcrm-text-muted-foreground">
                                {result.skipped.toLocaleString()} {__('omitidos')}
                            </span>
                        </>
                    )}
                </span>
            </div>
            {result.truncated && (
                <p className="imcrm-text-xs imcrm-text-warning">
                    {__('Se procesaron las primeras 5 000 filas. Vuelve a ejecutar el import con el resto del archivo.')}
                </p>
            )}
            {result.errors.length > 0 && (
                <details className="imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3 imcrm-text-xs">
                    <summary className="imcrm-cursor-pointer imcrm-font-medium imcrm-text-destructive">
                        {result.errors.length.toLocaleString()} {__('filas con errores (click para ver detalles)')}
                    </summary>
                    <ul className="imcrm-mt-2 imcrm-flex imcrm-max-h-48 imcrm-flex-col imcrm-gap-1 imcrm-overflow-y-auto imcrm-text-muted-foreground">
                        {result.errors.slice(0, 50).map((e, i) => (
                            <li key={i} className="imcrm-tabular-nums">
                                <span className="imcrm-font-medium">{__('Fila')} {e.row}:</span> {e.message}
                            </li>
                        ))}
                        {result.errors.length > 50 && (
                            <li className="imcrm-italic">
                                +{result.errors.length - 50} {__('más')}
                            </li>
                        )}
                    </ul>
                </details>
            )}
        </div>
    );
}
