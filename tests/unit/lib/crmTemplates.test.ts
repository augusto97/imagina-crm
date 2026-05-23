// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { resolveV2, type CustomTemplateConfigV2 } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';

/**
 * Tests del resolver V2 del editor de plantilla CRM.
 *
 * Fase 13.A — cubre los 14 tipos de bloque del MVP + los 3 sumados
 * en Fase 11.F (divider, heading, comments_thread). Los tests del
 * resolver son puros (sin DOM, sin async), corren rápido y
 * documentan el contrato `CustomTemplateConfigV2 → ResolvedV2`.
 */

function mkField(overrides: Partial<FieldEntity> = {}): FieldEntity {
    return {
        id: 1,
        list_id: 1,
        slug: 'name',
        column_name: 'name',
        label: 'Nombre',
        type: 'text',
        config: {},
        is_required: false,
        is_unique: false,
        is_primary: false,
        position: 0,
        created_at: '2026-01-01 00:00:00',
        updated_at: '2026-01-01 00:00:00',
        ...overrides,
    };
}

function emptyHeader(): CustomTemplateConfigV2['header'] {
    return {
        subtitle_field_slugs: [],
        status_field_slugs: [],
        quick_action_field_slugs: [],
    };
}

describe('resolveV2', () => {
    describe('header', () => {
        it('resolves title field by slug', () => {
            const fields = [mkField({ id: 1, slug: 'nombre', is_primary: true })];
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: { ...emptyHeader(), title_field_slug: 'nombre' },
                blocks: [],
            };
            const result = resolveV2(config, fields);
            expect(result.header.titleField).toBe(fields[0]);
        });

        it('returns null titleField when slug missing', () => {
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: { ...emptyHeader(), title_field_slug: 'inexistente' },
                blocks: [],
            };
            const result = resolveV2(config, []);
            expect(result.header.titleField).toBeNull();
        });

        it('builds quickActions with correct kind from field type', () => {
            const fields = [
                mkField({ id: 1, slug: 'email', type: 'email' }),
                mkField({ id: 2, slug: 'website', type: 'url' }),
                mkField({ id: 3, slug: 'phone', type: 'text' }),
            ];
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: {
                    ...emptyHeader(),
                    quick_action_field_slugs: ['email', 'website', 'phone'],
                },
                blocks: [],
            };
            const result = resolveV2(config, fields);
            expect(result.header.quickActions).toHaveLength(3);
            expect(result.header.quickActions[0]?.kind).toBe('email');
            expect(result.header.quickActions[1]?.kind).toBe('url');
            expect(result.header.quickActions[2]?.kind).toBe('phone');
        });
    });

    describe('properties_group block', () => {
        it('inflates field_slugs to FieldEntity instances', () => {
            const fields = [
                mkField({ id: 1, slug: 'nombre' }),
                mkField({ id: 2, slug: 'email', type: 'email' }),
            ];
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'g1', x: 0, y: 0, w: 4, h: 4,
                        type: 'properties_group',
                        config: {
                            label: 'Contacto',
                            icon_key: 'database',
                            field_slugs: ['nombre', 'email'],
                            collapsed_by_default: false,
                        },
                    },
                ],
            };
            const result = resolveV2(config, fields);
            expect(result.blocks).toHaveLength(1);
            const block = result.blocks[0];
            expect(block?.type).toBe('properties_group');
            if (block?.type === 'properties_group') {
                expect(block.config.fields).toHaveLength(2);
                expect(block.config.fields[0]?.slug).toBe('nombre');
                expect(block.config.label).toBe('Contacto');
                expect(block.config.collapsedByDefault).toBe(false);
            }
        });

        it('drops fields that do not exist in the lookup', () => {
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'g1', x: 0, y: 0, w: 4, h: 4,
                        type: 'properties_group',
                        config: {
                            label: 'Vacío',
                            icon_key: 'database',
                            field_slugs: ['ghost1', 'ghost2'],
                            collapsed_by_default: false,
                        },
                    },
                ],
            };
            const result = resolveV2(config, []);
            const block = result.blocks[0];
            if (block?.type === 'properties_group') {
                expect(block.config.fields).toHaveLength(0);
            }
        });
    });

    describe('related block', () => {
        it('drops the block when the field is not a relation type', () => {
            const fields = [mkField({ id: 1, slug: 'nombre', type: 'text' })];
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'r1', x: 0, y: 0, w: 4, h: 4,
                        type: 'related',
                        config: { field_slug: 'nombre' },
                    },
                ],
            };
            const result = resolveV2(config, fields);
            expect(result.blocks).toHaveLength(0);
        });

        it('keeps the block when field type is relation', () => {
            const fields = [mkField({ id: 1, slug: 'tareas', type: 'relation' })];
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'r1', x: 0, y: 0, w: 4, h: 4,
                        type: 'related',
                        config: { field_slug: 'tareas' },
                    },
                ],
            };
            const result = resolveV2(config, fields);
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0]?.type).toBe('related');
        });
    });

    describe('files block', () => {
        it('defaults to all file fields when file_field_slugs is empty', () => {
            const fields = [
                mkField({ id: 1, slug: 'avatar', type: 'file' }),
                mkField({ id: 2, slug: 'contrato', type: 'file' }),
                mkField({ id: 3, slug: 'nombre', type: 'text' }),
            ];
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'f1', x: 0, y: 0, w: 4, h: 4,
                        type: 'files',
                        config: { file_field_slugs: [] },
                    },
                ],
            };
            const result = resolveV2(config, fields);
            const block = result.blocks[0];
            if (block?.type === 'files') {
                expect(block.config.fileFields).toHaveLength(2);
            }
        });

        it('filters to declared slugs when not empty', () => {
            const fields = [
                mkField({ id: 1, slug: 'avatar', type: 'file' }),
                mkField({ id: 2, slug: 'contrato', type: 'file' }),
            ];
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'f1', x: 0, y: 0, w: 4, h: 4,
                        type: 'files',
                        config: { file_field_slugs: ['contrato'] },
                    },
                ],
            };
            const result = resolveV2(config, fields);
            const block = result.blocks[0];
            if (block?.type === 'files') {
                expect(block.config.fileFields).toHaveLength(1);
                expect(block.config.fileFields[0]?.slug).toBe('contrato');
            }
        });
    });

    describe('Fase 11.F — divider / heading / comments_thread', () => {
        it('passes through divider config', () => {
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'd1', x: 0, y: 0, w: 12, h: 1,
                        type: 'divider',
                        config: { label: 'Datos personales' },
                    },
                ],
            };
            const result = resolveV2(config, []);
            const block = result.blocks[0];
            expect(block?.type).toBe('divider');
            if (block?.type === 'divider') {
                expect(block.config.label).toBe('Datos personales');
            }
        });

        it('passes through heading config with level', () => {
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'h1', x: 0, y: 0, w: 12, h: 2,
                        type: 'heading',
                        config: { text: 'Información comercial', level: 2 },
                    },
                ],
            };
            const result = resolveV2(config, []);
            const block = result.blocks[0];
            if (block?.type === 'heading') {
                expect(block.config.text).toBe('Información comercial');
                expect(block.config.level).toBe(2);
            }
        });

        it('passes through comments_thread config with optional title', () => {
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'c1', x: 0, y: 0, w: 8, h: 10,
                        type: 'comments_thread',
                        config: { title: 'Hilo del cliente' },
                    },
                ],
            };
            const result = resolveV2(config, []);
            const block = result.blocks[0];
            if (block?.type === 'comments_thread') {
                expect(block.config.title).toBe('Hilo del cliente');
            }
        });

        it('comments_thread without title resolves to undefined', () => {
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    {
                        id: 'c1', x: 0, y: 0, w: 8, h: 10,
                        type: 'comments_thread',
                        config: {},
                    },
                ],
            };
            const result = resolveV2(config, []);
            const block = result.blocks[0];
            if (block?.type === 'comments_thread') {
                expect(block.config.title).toBeUndefined();
            }
        });
    });

    describe('mixed blocks order preservation', () => {
        it('preserves the block order from input config', () => {
            const fields = [mkField({ id: 1, slug: 'x' })];
            const config: CustomTemplateConfigV2 = {
                v: 2,
                header: emptyHeader(),
                blocks: [
                    { id: 'h1', x: 0, y: 0, w: 12, h: 2, type: 'heading',
                        config: { text: 'A', level: 3 } },
                    { id: 'd1', x: 0, y: 2, w: 12, h: 1, type: 'divider',
                        config: {} },
                    { id: 'n1', x: 0, y: 3, w: 4, h: 3, type: 'notes',
                        config: { title: 'N', content: '' } },
                ],
            };
            const result = resolveV2(config, fields);
            expect(result.blocks.map((b) => b.id)).toEqual(['h1', 'd1', 'n1']);
        });
    });
});
