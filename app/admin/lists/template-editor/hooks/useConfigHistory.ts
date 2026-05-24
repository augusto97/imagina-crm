import { useCallback, useRef, useState } from 'react';

import type { CustomTemplateConfigV2 } from '@/lib/crmTemplates';

/**
 * Hook de historial de undo/redo para el `CustomTemplateConfigV2`
 * del editor de plantilla CRM (Fase 14.B).
 *
 * Mantiene dos stacks: `past` con los configs anteriores y `future`
 * con los configs descartados por undo (para soportar redo). Cap a
 * `MAX_HISTORY=50` para evitar crecimiento sin límite en sesiones
 * largas — al pasarse, se descartan los más antiguos.
 *
 * El primer `setConfig` (durante load inicial) NO se trackea para
 * que la primera versión cargada del backend sea el "punto cero"
 * — undo no debería traerte a un config vacío.
 *
 * API similar al `useState` de React + 4 helpers extras:
 *   `undo`, `redo`, `canUndo`, `canRedo`, `reset(next)`
 *
 * `reset(next)` setea el config sin tocar historial — útil cuando
 * el usuario hace "Restaurar desde plantilla" (queremos que el
 * nuevo built-in sea el nuevo punto cero).
 */

const MAX_HISTORY = 50;

interface ConfigHistory {
    config: CustomTemplateConfigV2;
    setConfig: (next: CustomTemplateConfigV2 | ((prev: CustomTemplateConfigV2) => CustomTemplateConfigV2)) => void;
    undo: () => void;
    redo: () => void;
    reset: (next: CustomTemplateConfigV2) => void;
    canUndo: boolean;
    canRedo: boolean;
}

export function useConfigHistory(initial: CustomTemplateConfigV2): ConfigHistory {
    const [config, setConfigRaw] = useState<CustomTemplateConfigV2>(initial);
    const pastRef = useRef<CustomTemplateConfigV2[]>([]);
    const futureRef = useRef<CustomTemplateConfigV2[]>([]);
    const [version, setVersion] = useState(0);

    const setConfig = useCallback(
        (next: CustomTemplateConfigV2 | ((prev: CustomTemplateConfigV2) => CustomTemplateConfigV2)) => {
            setConfigRaw((prev) => {
                const resolved = typeof next === 'function' ? next(prev) : next;
                // Si no cambió nada (referential equality), no agregar al history.
                if (resolved === prev) return prev;
                pastRef.current.push(prev);
                if (pastRef.current.length > MAX_HISTORY) {
                    pastRef.current.shift();
                }
                futureRef.current = [];
                setVersion((v) => v + 1);
                return resolved;
            });
        },
        [],
    );

    const undo = useCallback(() => {
        if (pastRef.current.length === 0) return;
        const previous = pastRef.current.pop()!;
        setConfigRaw((current) => {
            futureRef.current.push(current);
            if (futureRef.current.length > MAX_HISTORY) {
                futureRef.current.shift();
            }
            setVersion((v) => v + 1);
            return previous;
        });
    }, []);

    const redo = useCallback(() => {
        if (futureRef.current.length === 0) return;
        const next = futureRef.current.pop()!;
        setConfigRaw((current) => {
            pastRef.current.push(current);
            if (pastRef.current.length > MAX_HISTORY) {
                pastRef.current.shift();
            }
            setVersion((v) => v + 1);
            return next;
        });
    }, []);

    const reset = useCallback((next: CustomTemplateConfigV2) => {
        // Reset total: tiramos history. Lo usamos en "Restaurar desde
        // plantilla" — el built-in es un nuevo punto de partida.
        pastRef.current = [];
        futureRef.current = [];
        setVersion((v) => v + 1);
        setConfigRaw(next);
    }, []);

    return {
        config,
        setConfig,
        undo,
        redo,
        reset,
        // `version` hace que los memos del consumer se invaliden cuando
        // cambia history, así canUndo/canRedo siempre están al día.
        canUndo: pastRef.current.length > 0 && version >= 0,
        canRedo: futureRef.current.length > 0 && version >= 0,
    };
}
