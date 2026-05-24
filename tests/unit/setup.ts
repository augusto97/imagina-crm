/**
 * Setup global para tests Vitest del admin SPA (Fase 13.A).
 *
 * - Mockea `@wordpress/i18n` para que `__()` y compañía devuelvan
 *   el string fuente sin necesitar de un runtime WP. La librería
 *   real depende de `window.wp.i18n` que no existe en jsdom.
 * - Cualquier otro global de WP que las units necesiten se mockea
 *   acá.
 */
import { vi } from 'vitest';

vi.mock('@wordpress/i18n', () => ({
    __: (text: string) => text,
    _x: (text: string) => text,
    _n: (single: string, plural: string, count: number) =>
        count === 1 ? single : plural,
    sprintf: (template: string, ...args: unknown[]) => {
        // Implementación mínima: reemplaza %s y %d en orden.
        let i = 0;
        return template.replace(/%[sd]/g, () => {
            const next = args[i++];
            return next === undefined ? '' : String(next);
        });
    },
}));
