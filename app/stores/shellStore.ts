import { useEffect, useSyncExternalStore } from 'react';

/**
 * State global del shell del admin: ahora solo `fullscreen`. Si en
 * adelante hace falta más estado UI (sidebar collapsed, theme, etc.),
 * se agrega acá.
 *
 * No usamos zustand para esto — es un boolean con un listener; la
 * implementación con `useSyncExternalStore` es ~30 líneas y no
 * agrega bundle. Persistencia en `localStorage` para que el modo
 * sobreviva al reload.
 */

const STORAGE_KEY = 'imcrm.shell.fullscreen';
const HTML_CLASS  = 'imcrm-fullscreen-mode';

const listeners = new Set<() => void>();
let fullscreen = readInitial();

function readInitial(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function emit(): void {
    for (const l of listeners) l();
}

function applyDom(value: boolean): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle(HTML_CLASS, value);
}

// Aplica el estado inicial al DOM antes del primer render para evitar
// flash del wp-admin chrome.
if (typeof document !== 'undefined') {
    applyDom(fullscreen);
}

export function setFullscreen(next: boolean): void {
    if (next === fullscreen) return;
    fullscreen = next;
    try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
        // Fail silently — localStorage puede estar deshabilitado.
    }
    applyDom(next);
    emit();
}

export function toggleFullscreen(): void {
    setFullscreen(! fullscreen);
}

export function useFullscreen(): boolean {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => {
                listeners.delete(cb);
            };
        },
        () => fullscreen,
        () => false,
    );
}

/**
 * Hook auxiliar: liga la tecla `Escape` para salir del modo fullscreen.
 * Lo monta el AdminShell en el layout raíz.
 */
export function useFullscreenEscapeKey(): void {
    useEffect(() => {
        const handler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape' && fullscreen) {
                setFullscreen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
}
