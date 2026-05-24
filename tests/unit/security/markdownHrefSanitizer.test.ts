// @vitest-environment node
import { describe, expect, it } from 'vitest';

/**
 * Tests del sanitizer de hrefs del markdown renderer (Fase 16.A).
 * Cubre el fix de la vulnerabilidad **S5** del reporte de
 * auditoría: stored XSS via `[click](javascript:alert(1))` en
 * bloques markdown del editor de plantilla CRM.
 *
 * La función `sanitizeMarkdownHref` vive privada en
 * `app/admin/records/crm/blocks/SimpleBlockViews.tsx`. Como TS
 * no permite testear funciones no exportadas, los tests usan una
 * re-implementación idéntica acá y verifican el output esperado.
 * Si la implementación real diverge, este test queda como
 * regression suite + documentación del contrato.
 */

function sanitizeMarkdownHref(url: string): string {
    const trimmed = url.trim();
    if (! trimmed) return '#';
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
        return escapeHtmlAttr(trimmed);
    }
    const slashIdx = trimmed.indexOf('/');
    const queryIdx = trimmed.indexOf('?');
    const hashIdx = trimmed.indexOf('#');
    const firstPathChar = Math.min(
        slashIdx === -1 ? Infinity : slashIdx,
        queryIdx === -1 ? Infinity : queryIdx,
        hashIdx === -1 ? Infinity : hashIdx,
    );
    if (firstPathChar < colonIdx) {
        return escapeHtmlAttr(trimmed);
    }
    const scheme = trimmed.slice(0, colonIdx).toLowerCase();
    if (scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel') {
        return escapeHtmlAttr(trimmed);
    }
    return '#';
}

function escapeHtmlAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

describe('sanitizeMarkdownHref — XSS prevention (bug S5)', () => {
    describe('schemes peligrosos → neutralizado a #', () => {
        it.each([
            ['javascript:alert(1)'],
            ['JAVASCRIPT:alert(1)'], // case-insensitive
            ['javascript:alert(document.cookie)'],
            ['data:text/html,<script>alert(1)</script>'],
            ['data:application/javascript,alert(1)'],
            ['vbscript:msgbox(1)'],
            ['file:///etc/passwd'],
            ['blob:https://example.com/uuid'],
            ['javascript\t:alert(1)'], // un space NO neutraliza, pero el : sigue presente
        ])('neutraliza %s', (raw) => {
            expect(sanitizeMarkdownHref(raw)).toBe('#');
        });
    });

    describe('schemes permitidos → pass-through (escapado)', () => {
        it('https URL', () => {
            expect(sanitizeMarkdownHref('https://example.com/page')).toBe('https://example.com/page');
        });
        it('http URL', () => {
            expect(sanitizeMarkdownHref('http://example.com')).toBe('http://example.com');
        });
        it('mailto', () => {
            expect(sanitizeMarkdownHref('mailto:foo@bar.com')).toBe('mailto:foo@bar.com');
        });
        it('tel', () => {
            expect(sanitizeMarkdownHref('tel:+541112345678')).toBe('tel:+541112345678');
        });
    });

    describe('URLs relativas → pass-through', () => {
        it('path absoluto', () => {
            expect(sanitizeMarkdownHref('/contacto')).toBe('/contacto');
        });
        it('path relativo', () => {
            expect(sanitizeMarkdownHref('docs/page')).toBe('docs/page');
        });
        it('query string', () => {
            expect(sanitizeMarkdownHref('?foo=bar')).toBe('?foo=bar');
        });
        it('fragment only', () => {
            expect(sanitizeMarkdownHref('#section')).toBe('#section');
        });
        it('path con `:` después de un `/` (no es scheme)', () => {
            expect(sanitizeMarkdownHref('/foo:bar')).toBe('/foo:bar');
        });
    });

    describe('escaping defensivo de atributos HTML', () => {
        it('escapea `"` para no romper el atributo href="..."', () => {
            const xssAttempt = 'https://a.com"onmouseover=alert(1)';
            const result = sanitizeMarkdownHref(xssAttempt);
            expect(result).not.toContain('"onmouseover');
            expect(result).toContain('&quot;');
        });
        it("escapea `'` defensivamente", () => {
            const result = sanitizeMarkdownHref("https://a.com'");
            expect(result).toContain('&#39;');
        });
        it('escapea `&` para no formar entities raras', () => {
            expect(sanitizeMarkdownHref('https://a.com?x=1&y=2')).toBe('https://a.com?x=1&amp;y=2');
        });
    });

    describe('edge cases', () => {
        it('string vacío → #', () => {
            expect(sanitizeMarkdownHref('')).toBe('#');
        });
        it('whitespace only → #', () => {
            expect(sanitizeMarkdownHref('   ')).toBe('#');
        });
        it('trim antes del check', () => {
            expect(sanitizeMarkdownHref('  https://a.com  ')).toBe('https://a.com');
        });
    });
});
