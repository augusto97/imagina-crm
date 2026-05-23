import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getBootData } from '@/lib/boot';
import { __ } from '@/lib/i18n';
import type { FilterTree } from '@/types/record';

interface ExportButtonProps {
    listSlug: string;
    /** Filtros activos — se aplican al export (mismo subset que la vista). */
    filterTree?: FilterTree;
    /** Si pasas IDs, sólo se exportan esos campos en ese orden. */
    fieldIds?: number[];
    disabled?: boolean;
}

/**
 * Botón "Exportar CSV" en la toolbar de Records. Hace `fetch` con
 * nonce + cookies (mismo auth que el resto del SPA), recibe el CSV
 * stream, lo envuelve en un Blob y dispara el download nativo del
 * browser. No usa `window.open` con la URL del REST porque:
 *  - Los cookies + nonce van mejor con fetch en navegadores modernos.
 *  - El browser respeta el `Content-Disposition: attachment` que
 *    setea `ExportController` y guarda con el nombre correcto.
 *
 * El backend hace hard cap a 50 000 filas (ver `CsvExporter::MAX_ROWS`)
 * — listas más grandes deberían filtrarse antes de exportar.
 */
export function ExportButton({
    listSlug,
    filterTree,
    fieldIds,
    disabled,
}: ExportButtonProps): JSX.Element {
    const [busy, setBusy] = useState(false);

    const run = async (): Promise<void> => {
        setBusy(true);
        try {
            const boot = getBootData();
            const params = new URLSearchParams();
            if (filterTree && filterTree.children.length > 0) {
                params.set('filter_tree', JSON.stringify(filterTree));
            }
            if (fieldIds && fieldIds.length > 0) {
                params.set('fields', fieldIds.join(','));
            }
            const base = boot.restRoot.replace(/\/$/, '');
            const url = `${base}/lists/${listSlug}/export${params.toString() ? `?${params}` : ''}`;

            const res = await fetch(url, {
                method: 'GET',
                headers: { 'X-WP-Nonce': boot.restNonce },
                credentials: 'same-origin',
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const blob = await res.blob();
            // Extraer filename del Content-Disposition; fallback al slug.
            const cd = res.headers.get('Content-Disposition') ?? '';
            const match = cd.match(/filename="?([^";]+)"?/i);
            const filename = match?.[1] ?? `${listSlug}.csv`;

            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
        } catch {
            // Errores raros (ej. red caída): no rompemos la UI.
            // eslint-disable-next-line no-alert
            alert(__('No se pudo exportar. Vuelve a intentarlo.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Button
            variant="outline"
            onClick={run}
            disabled={disabled || busy}
            className="imcrm-gap-2"
        >
            {busy ? (
                <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
            ) : (
                <Download className="imcrm-h-4 imcrm-w-4" />
            )}
            {__('Exportar')}
        </Button>
    );
}
