/**
 * Helpers TS de slugify y validación. Mantenemos paridad con
 * `ImaginaCRM\Lists\SlugManager::slugify()` y `validateFormat()`.
 */

export const SLUG_REGEX = /^[a-z][a-z0-9_]{0,62}$/;
export const MAX_SLUG_LENGTH = 63;

const ACCENT_MAP: Record<string, string> = {
    á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a',
    é: 'e', è: 'e', ê: 'e', ë: 'e',
    í: 'i', ì: 'i', î: 'i', ï: 'i',
    ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o',
    ú: 'u', ù: 'u', û: 'u', ü: 'u',
    ñ: 'n', ç: 'c',
    Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ñ: 'N',
};

function removeAccents(input: string): string {
    return input.replace(/[áàâäãéèêëíìîïóòôöõúùûüñçÁÉÍÓÚÑ]/g, (c) => ACCENT_MAP[c] ?? c);
}

export function slugify(input: string, maxLength: number = MAX_SLUG_LENGTH): string {
    let s = removeAccents(input).toLowerCase();
    s = s.replace(/[^a-z0-9]+/g, '_');
    s = s.replace(/^_+|_+$/g, '');

    if (s === '') return '';

    if (!/^[a-z]/.test(s)) {
        s = `l_${s}`;
    }

    if (s.length > maxLength) {
        s = s.slice(0, maxLength).replace(/_+$/g, '');
    }

    return s;
}

export interface SlugValidationResult {
    ok: boolean;
    message?: string;
}

export function validateSlugFormat(slug: string): SlugValidationResult {
    if (!slug) return { ok: false, message: 'El slug no puede estar vacío.' };
    if (slug.length > MAX_SLUG_LENGTH) {
        return { ok: false, message: `Máximo ${MAX_SLUG_LENGTH} caracteres.` };
    }
    if (!SLUG_REGEX.test(slug)) {
        return {
            ok: false,
            message: 'Usa snake_case: minúsculas, números y guiones bajos. Debe empezar por letra.',
        };
    }
    return { ok: true };
}
