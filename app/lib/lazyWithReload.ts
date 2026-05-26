import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Wrapper de `React.lazy` que detecta el caso clásico de SPA deploy:
 *
 *   El navegador tenía cargado el bundle viejo (build N). El admin
 *   actualiza el plugin a build N+1 — los chunks viejos ya no existen
 *   en el server porque Vite usa content-hashing en los filenames. Al
 *   navegar a una ruta lazy-loaded, el dynamic import falla con
 *   `Failed to fetch dynamically imported module: <chunk>-<hash>.js`
 *   y React queda con pantalla en blanco.
 *
 * Solución: si el import falla con un error que matchea ese patrón,
 * recargamos la página automáticamente. La recarga trae el HTML
 * fresco que apunta a los chunks del build N+1, y la navegación sigue
 * normalmente sin que el usuario tenga que entender qué pasó.
 *
 * Sólo recargamos UNA vez por session (guardado en sessionStorage)
 * para evitar loop infinito si el problema es otro (chunk realmente
 * inexistente por bug de build, no por deploy stale).
 */

const RELOADED_KEY = 'imcrm:reloaded-after-chunk-fail';

function isChunkLoadError(err: unknown): boolean {
    if (! err) return false;
    const msg = err instanceof Error ? err.message : String(err);
    // Vite, Webpack y la mayoría de bundlers emiten errores parecidos:
    //   "Failed to fetch dynamically imported module"
    //   "Loading chunk N failed"
    //   "Loading CSS chunk N failed"
    //   "Importing a module script failed"
    return (
        msg.includes('Failed to fetch dynamically imported module')
        || msg.includes('Loading chunk')
        || msg.includes('Importing a module script failed')
        || /chunk\s+\S+\s+failed/i.test(msg)
    );
}

/**
 * Reemplazo drop-in de `React.lazy`. Si el dynamic import falla por
 * un chunk faltante (deploy stale), recarga la página automáticamente.
 *
 * Uso:
 *   const Page = lazyWithReload(() => import('./Page').then(m => ({ default: m.Page })));
 */
// `ComponentType<any>` aquí es a propósito — es la misma firma que
// `React.lazy` para que el drop-in replacement sea transparente con
// componentes que tienen props específicos (CalendarView, KanbanView,
// etc.). Si usaramos `unknown` el wrapper requeriría props compatibles
// con `unknown`, lo cual rompe el contrato real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
    return lazy(() =>
        factory().catch((err: unknown) => {
            if (isChunkLoadError(err)) {
                try {
                    const already = window.sessionStorage.getItem(RELOADED_KEY);
                    if (already !== '1') {
                        window.sessionStorage.setItem(RELOADED_KEY, '1');
                        window.location.reload();
                        // Devolvemos una promesa que nunca resuelve — el
                        // reload ya va en camino, no queremos que React
                        // muestre el error boundary mientras tanto.
                        return new Promise(() => undefined) as Promise<{ default: T }>;
                    }
                } catch {
                    // sessionStorage puede estar bloqueado (private mode,
                    // cookies disabled). En ese caso recargamos igual —
                    // peor escenario el user ve el error y refresh manual.
                    window.location.reload();
                    return new Promise(() => undefined) as Promise<{ default: T }>;
                }
            }
            // No es un chunk error, o ya recargamos antes en esta session.
            // Propagamos el error para que el error boundary lo muestre.
            throw err;
        }),
    );
}
