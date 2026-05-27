// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { appendBlock, appendFieldAsGroup, createBlock } from '@/admin/lists/template-editor/utils/createBlock';
import type { CustomTemplateConfigV2 } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';

/**
 * Tests de las factories de bloques del editor de plantilla CRM
 * (Fase 13.B). Cubren defaults de cada tipo + posicionamiento al
 * final del canvas + drops desde la paleta con posición explícita.
 */

function mkField(overrides: Partial<FieldEntity> = {}): FieldEntity {
    return {
        id: 1,
        list_id: 1,
        slug: 'nombre',
        column_name: 'nombre',
        label: 'Nombre',
        type: 'text',
        config: {},
        is_required: false,
        is_unique: false,
        is_primary: false,
        is_indexed: false,
        position: 0,
        created_at: '2026-01-01 00:00:00',
        updated_at: '2026-01-01 00:00:00',
        ...overrides,
    };
}

function emptyConfig(): CustomTemplateConfigV2 {
    return {
        v: 2,
        header: {
            subtitle_field_slugs: [],
            status_field_slugs: [],
            quick_action_field_slugs: [],
        },
        blocks: [],
    };
}

describe('createBlock', () => {
    it('returns null for related when no relation field exists', () => {
        const block = createBlock('related', [], []);
        expect(block).toBeNull();
    });

    it('returns a related block when at least one relation field exists', () => {
        const fields = [mkField({ id: 1, slug: 'tareas', type: 'relation' })];
        const block = createBlock('related', fields, []);
        expect(block).not.toBeNull();
        expect(block?.type).toBe('related');
        if (block?.type === 'related') {
            expect(block.config.field_slug).toBe('tareas');
        }
    });

    it('positions new block in a new row (max(y)+1) by default', () => {
        // 0.57.23 — `y` es índice de fila (0, 1, 2...), no row-offset.
        // El append crea fila nueva = max(y) + 1.
        const existing = [
            { id: 'a', x: 0, y: 0, w: 4, h: 0, type: 'notes' as const, config: { title: 'A', content: '' } },
            { id: 'b', x: 1, y: 0, w: 4, h: 0, type: 'notes' as const, config: { title: 'B', content: '' } },
        ];
        const block = createBlock('notes', [], existing);
        expect(block?.y).toBe(1);
        expect(block?.x).toBe(0);
    });

    it('respects an explicit position when provided', () => {
        const block = createBlock('notes', [], [], { x: 7, y: 3 });
        expect(block?.x).toBe(7);
        expect(block?.y).toBe(3);
    });

    it('generates unique IDs across calls', () => {
        const a = createBlock('notes', [], []);
        const b = createBlock('notes', [], []);
        expect(a?.id).not.toBe(b?.id);
    });

    it('returns correct default config for kpi block', () => {
        const fields = [mkField({ id: 1, slug: 'monto', type: 'currency' })];
        const block = createBlock('kpi', fields, []);
        if (block?.type === 'kpi') {
            expect(block.config.field_slug).toBe('monto');
            expect(block.config.format).toBe('currency');
        }
    });

    it('returns kpi with number format when first numeric is "number" type', () => {
        const fields = [mkField({ id: 1, slug: 'cantidad', type: 'number' })];
        const block = createBlock('kpi', fields, []);
        if (block?.type === 'kpi') {
            expect(block.config.format).toBe('number');
        }
    });

    it('returns sensible defaults for divider, heading, comments_thread (Fase 11.F)', () => {
        const divider = createBlock('divider', [], []);
        expect(divider?.type).toBe('divider');
        expect(divider?.w).toBe(12);
        expect(divider?.h).toBe(1);

        const heading = createBlock('heading', [], []);
        expect(heading?.type).toBe('heading');
        if (heading?.type === 'heading') {
            expect(heading.config.level).toBe(3);
        }

        const comments = createBlock('comments_thread', [], []);
        expect(comments?.type).toBe('comments_thread');
        expect(comments?.w).toBe(8);
    });
});

describe('appendBlock', () => {
    it('appends to the config blocks array', () => {
        const config = emptyConfig();
        const result = appendBlock(config, 'notes', []);
        expect(result).not.toBeNull();
        if (result) {
            expect(result.config.blocks).toHaveLength(1);
            expect(result.addedId).toBe(result.config.blocks[0]?.id);
        }
    });

    it('does not mutate the input config', () => {
        const config = emptyConfig();
        const before = config.blocks.length;
        appendBlock(config, 'notes', []);
        expect(config.blocks.length).toBe(before);
    });

    it('returns null when block factory returns null (e.g. related without relation field)', () => {
        const result = appendBlock(emptyConfig(), 'related', []);
        expect(result).toBeNull();
    });
});

describe('appendFieldAsGroup', () => {
    it('creates a properties_group with the field slug + label as group label', () => {
        const field = mkField({ id: 1, slug: 'telefono', label: 'Teléfono', type: 'text' });
        const result = appendFieldAsGroup(emptyConfig(), field);
        expect(result.config.blocks).toHaveLength(1);
        const block = result.config.blocks[0];
        if (block?.type === 'properties_group') {
            expect(block.config.field_slugs).toEqual(['telefono']);
            expect(block.config.label).toBe('Teléfono');
        }
    });

    it('uses position when provided', () => {
        const field = mkField({ slug: 'x', label: 'X' });
        const result = appendFieldAsGroup(emptyConfig(), field, { x: 5, y: 2 });
        const block = result.config.blocks[0];
        expect(block?.x).toBe(5);
        expect(block?.y).toBe(2);
    });
});
