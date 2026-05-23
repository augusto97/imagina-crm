// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
    decodePayload,
    encodePayload,
    PALETTE_MIME,
    readDropPayload,
} from '@/admin/lists/template-editor/utils/dragPayload';

/**
 * Tests del payload de drag-from-palette del editor de plantilla
 * CRM (Fase 13.B). Cubre el roundtrip encode/decode + reading
 * del dataTransfer + validación contra payloads inválidos.
 */

describe('encodePayload / decodePayload', () => {
    it('round-trips a block-type payload', () => {
        const payload = { kind: 'block-type', type: 'kpi' as const };
        const encoded = encodePayload(payload);
        const decoded = decodePayload(encoded);
        expect(decoded).toEqual(payload);
    });

    it('round-trips a field payload', () => {
        const payload = { kind: 'field', slug: 'cliente_email' } as const;
        const encoded = encodePayload(payload);
        const decoded = decodePayload(encoded);
        expect(decoded).toEqual(payload);
    });

    it('returns null for malformed JSON', () => {
        expect(decodePayload('not-json')).toBeNull();
    });

    it('returns null for valid JSON with wrong shape', () => {
        expect(decodePayload('{"unrelated": true}')).toBeNull();
    });

    it('returns null for unknown kind discriminator', () => {
        expect(decodePayload('{"kind": "ghost", "type": "kpi"}')).toBeNull();
    });

    it('returns null for block-type without type string', () => {
        expect(decodePayload('{"kind": "block-type"}')).toBeNull();
        expect(decodePayload('{"kind": "block-type", "type": 42}')).toBeNull();
    });

    it('returns null for field without slug string', () => {
        expect(decodePayload('{"kind": "field"}')).toBeNull();
    });
});

describe('readDropPayload', () => {
    /**
     * Simula un DragEvent con DataTransfer. La API nativa no es
     * instanciable en node-environment, así que armamos un stub
     * mínimo con la interfaz que `readDropPayload` consume.
     */
    function mockEvent(types: Record<string, string>): DragEvent {
        return {
            dataTransfer: {
                getData: (mime: string) => types[mime] ?? '',
            } as unknown as DataTransfer,
        } as DragEvent;
    }

    it('reads from the custom MIME when present', () => {
        const payload = encodePayload({ kind: 'block-type', type: 'notes' });
        const event = mockEvent({ [PALETTE_MIME]: payload });
        expect(readDropPayload(event)).toEqual({ kind: 'block-type', type: 'notes' });
    });

    it('falls back to text/plain when custom MIME unavailable', () => {
        const payload = encodePayload({ kind: 'field', slug: 'foo' });
        const event = mockEvent({ 'text/plain': payload });
        expect(readDropPayload(event)).toEqual({ kind: 'field', slug: 'foo' });
    });

    it('returns null when neither MIME has data', () => {
        const event = mockEvent({});
        expect(readDropPayload(event)).toBeNull();
    });

    it('returns null when MIME has garbage', () => {
        const event = mockEvent({ [PALETTE_MIME]: 'random-string' });
        expect(readDropPayload(event)).toBeNull();
    });
});
