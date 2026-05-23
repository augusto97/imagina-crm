import type { CustomTemplateConfigV2, V2Block, V2BlockType } from '@/lib/crmTemplates';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';

/**
 * Crea un bloque nuevo con defaults razonables y posición al final
 * del canvas. Antes vivía dentro de `GridEditor.tsx` (Fase 11.0).
 * Desde Fase 11.A se comparte entre GridEditor y la paleta de bloques
 * (`BlockPalettePanel`), por eso vive como helper standalone.
 *
 * Para los tipos que necesitan un field para tener sentido
 * (`related`), retorna `null` si no hay candidato disponible — el
 * caller decide qué hacer (típicamente: mostrar toast).
 */
export function createBlock(
    type: V2BlockType,
    fields: FieldEntity[],
    existing: V2Block[],
): V2Block | null {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const maxY = existing.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const base = { id, x: 0, y: maxY, w: 4, h: 4 };

    if (type === 'properties_group') {
        return { ...base, type, config: { label: __('Grupo nuevo'), icon_key: 'database', field_slugs: [], collapsed_by_default: false } };
    }
    if (type === 'timeline') {
        return { ...base, w: 8, h: 12, type, config: {} };
    }
    if (type === 'stats') {
        return { ...base, w: 4, h: 4, type, config: {} };
    }
    if (type === 'notes') {
        return { ...base, w: 4, h: 3, type, config: { title: __('Nota'), content: '' } };
    }
    if (type === 'related') {
        const firstRelation = fields.find((f) => f.type === 'relation');
        if (! firstRelation) return null;
        return { ...base, w: 4, h: 4, type, config: { field_slug: firstRelation.slug } };
    }
    if (type === 'kpi') {
        const firstNumeric = fields.find((f) => f.type === 'currency' || f.type === 'number');
        return {
            ...base,
            w: 3, h: 3,
            type,
            config: {
                field_slug: firstNumeric?.slug ?? '',
                format: firstNumeric?.type === 'currency' ? 'currency' : 'number',
            },
        };
    }
    if (type === 'chart') {
        const firstRelation = fields.find((f) => f.type === 'relation');
        return {
            ...base,
            w: 5, h: 5,
            type,
            config: {
                relation_field_slug: firstRelation?.slug ?? '',
                group_by_field_slug: '',
            },
        };
    }
    if (type === 'files') {
        return { ...base, w: 4, h: 5, type, config: { file_field_slugs: [] } };
    }
    if (type === 'embed') {
        return { ...base, w: 6, h: 6, type, config: { source: 'literal', url: '' } };
    }
    if (type === 'action_button') {
        return {
            ...base,
            w: 3, h: 2,
            type,
            config: { label: __('Acción'), action_type: 'url', target: '' },
        };
    }
    if (type === 'markdown') {
        return { ...base, w: 4, h: 4, type, config: { title: __('Notas'), content: '' } };
    }
    return null;
}

/**
 * Append helper que mantiene el contrato de `CustomTemplateConfigV2`.
 * Si `type` requiere un field que no existe, retorna `null` y el
 * caller decide qué hacer.
 */
export function appendBlock(
    config: CustomTemplateConfigV2,
    type: V2BlockType,
    fields: FieldEntity[],
): { config: CustomTemplateConfigV2; addedId: string } | null {
    const block = createBlock(type, fields, config.blocks);
    if (! block) return null;
    return {
        config: { ...config, blocks: [...config.blocks, block] },
        addedId: block.id,
    };
}
