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
 *
 * Fase 11.B: acepta `position` opcional `{ x, y }` para soportar
 * drop-from-palette. Si no se provee, posiciona al final.
 */
export function createBlock(
    type: V2BlockType,
    fields: FieldEntity[],
    existing: V2Block[],
    position?: { x: number; y: number },
): V2Block | null {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fallbackY = existing.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const base = {
        id,
        x: position?.x ?? 0,
        y: position?.y ?? fallbackY,
        w: 4,
        h: 4,
    };

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
    if (type === 'divider') {
        return { ...base, w: 12, h: 1, type, config: { label: '' } };
    }
    if (type === 'heading') {
        return { ...base, w: 12, h: 2, type, config: { text: __('Sección'), level: 3 } };
    }
    if (type === 'comments_thread') {
        return { ...base, w: 8, h: 10, type, config: {} };
    }
    return null;
}

/**
 * Append helper que mantiene el contrato de `CustomTemplateConfigV2`.
 * Si `type` requiere un field que no existe, retorna `null` y el
 * caller decide qué hacer.
 *
 * Fase 11.B: acepta `position` opcional para drop-from-palette.
 */
export function appendBlock(
    config: CustomTemplateConfigV2,
    type: V2BlockType,
    fields: FieldEntity[],
    position?: { x: number; y: number },
): { config: CustomTemplateConfigV2; addedId: string } | null {
    const block = createBlock(type, fields, config.blocks, position);
    if (! block) return null;
    return {
        config: { ...config, blocks: [...config.blocks, block] },
        addedId: block.id,
    };
}

/**
 * Crea un `properties_group` que contiene un único field
 * pre-seleccionado. Usado al hacer drop de un field desde la tab
 * "Campos" sobre el canvas (Fase 11.B).
 *
 * El label del grupo arranca como el label del field (más útil
 * que "Grupo nuevo" como default cuando hay un único field).
 */
export function appendFieldAsGroup(
    config: CustomTemplateConfigV2,
    field: FieldEntity,
    position?: { x: number; y: number },
): { config: CustomTemplateConfigV2; addedId: string } {
    const id = `properties_group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fallbackY = config.blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const block: V2Block = {
        id,
        x: position?.x ?? 0,
        y: position?.y ?? fallbackY,
        w: 4,
        h: 3,
        type: 'properties_group',
        config: {
            label: field.label,
            icon_key: 'database',
            field_slugs: [field.slug],
            collapsed_by_default: false,
        },
    };
    return {
        config: { ...config, blocks: [...config.blocks, block] },
        addedId: block.id,
    };
}
