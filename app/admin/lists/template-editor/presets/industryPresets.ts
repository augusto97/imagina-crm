import type { CustomTemplateConfigV2, V2Block, V2BlockType } from '@/lib/crmTemplates';
import type { FieldEntity } from '@/types/field';

/**
 * Industry presets del editor de plantilla CRM (Fase 14.C).
 *
 * Cada preset es una colección de bloques pre-armados orientada a
 * un caso de uso típico (eCommerce, agencia, salud, real estate).
 * No reemplaza el config existente — se appendean al final del
 * canvas. El admin puede después ajustarlos al campo concreto de
 * su lista.
 *
 * Diseño:
 * - Los presets son funciones puras `(fields) => V2Block[]` sin
 *   posiciones ni IDs (los asigna `applyPreset`).
 * - Cada preset es defensivo respecto a fields que pueden no
 *   existir: si no hay un field email, no agrega un grupo de
 *   email; el preset queda con menos bloques pero no se rompe.
 * - Los bloques agregados son básicos (heading, properties_group,
 *   notes) — el admin los rellena/ajusta después.
 *
 * Trade-off vs built-in template completa: los presets no sobre-
 * escriben el header del template ni reemplazan blocks existentes;
 * solo suman. Para un "fresh start" desde una industry, el admin
 * primero usa "Restaurar desde plantilla auto" y después aplica
 * el preset.
 */

export type PresetId = 'ecommerce' | 'agency' | 'health' | 'realestate';

export interface IndustryPreset {
    id: PresetId;
    name: string;
    description: string;
    /**
     * Devuelve los bloques a appendear. `fields` puede usarse para
     * adaptar el preset al schema concreto de la lista (ej. detectar
     * si hay un field email y solo entonces agregar un grupo de
     * contacto).
     */
    build: (fields: FieldEntity[]) => Array<Omit<V2Block, 'id' | 'x' | 'y'>>;
}

// --- helpers shared ----------------------------------------------------------

function hasField(fields: FieldEntity[], predicate: (f: FieldEntity) => boolean): boolean {
    return fields.some(predicate);
}

function fieldSlugsOfType(fields: FieldEntity[], types: string[]): string[] {
    return fields.filter((f) => types.includes(f.type)).map((f) => f.slug);
}

function pickFieldSlug(fields: FieldEntity[], predicate: (f: FieldEntity) => boolean): string | null {
    const f = fields.find(predicate);
    return f?.slug ?? null;
}

function makeHeading(text: string, level: 2 | 3 | 4 = 3, w = 12): Omit<V2Block, 'id' | 'x' | 'y'> {
    return { w, h: 2, type: 'heading', config: { text, level } };
}

function makeGroup(label: string, iconKey: string, fieldSlugs: string[], w = 6, h = 4): Omit<V2Block, 'id' | 'x' | 'y'> {
    return {
        w, h, type: 'properties_group',
        config: { label, icon_key: iconKey, field_slugs: fieldSlugs, collapsed_by_default: false },
    };
}

function makeKpi(fieldSlug: string, label: string, format: 'number' | 'currency' | 'percent' = 'number', w = 3, h = 3): Omit<V2Block, 'id' | 'x' | 'y'> {
    return {
        w, h, type: 'kpi',
        config: { field_slug: fieldSlug, label, format },
    };
}

function makeNotes(title: string, content: string, w = 4, h = 3): Omit<V2Block, 'id' | 'x' | 'y'> {
    return { w, h, type: 'notes', config: { title, content } };
}

function makeDivider(label?: string, w = 12): Omit<V2Block, 'id' | 'x' | 'y'> {
    return { w, h: 1, type: 'divider', config: label ? { label } : {} };
}

function makeBlock<T extends V2BlockType>(type: T, w: number, h: number, config: unknown): Omit<V2Block, 'id' | 'x' | 'y'> {
    return { w, h, type, config } as Omit<V2Block, 'id' | 'x' | 'y'>;
}

// --- presets -----------------------------------------------------------------

const ecommerce: IndustryPreset = {
    id: 'ecommerce',
    name: 'eCommerce',
    description: 'Cliente con métricas de compra, historial de pedidos y notas.',
    build: (fields) => {
        const blocks: Array<Omit<V2Block, 'id' | 'x' | 'y'>> = [];

        blocks.push(makeHeading('Información del cliente', 2));

        const contactSlugs: string[] = [
            ...fieldSlugsOfType(fields, ['email']).slice(0, 1),
            ...fieldSlugsOfType(fields, ['url']).slice(0, 1),
            ...fields.filter((f) => f.type === 'text' && /phone|tel/i.test(f.slug + f.label)).slice(0, 1).map((f) => f.slug),
        ];
        if (contactSlugs.length > 0) {
            blocks.push(makeGroup('Contacto', 'mail', contactSlugs, 6, 4));
        }

        const addressSlugs = fields
            .filter((f) => f.type === 'text' && /(direccion|address|ciudad|city|pais|country|cp|zip)/i.test(f.slug + f.label))
            .slice(0, 5)
            .map((f) => f.slug);
        if (addressSlugs.length > 0) {
            blocks.push(makeGroup('Dirección de envío', 'building', addressSlugs, 6, 4));
        }

        blocks.push(makeHeading('Métricas de compra', 3));

        const currencyFields = fields.filter((f) => f.type === 'currency');
        if (currencyFields[0]) {
            blocks.push(makeKpi(currencyFields[0].slug, 'Total comprado', 'currency', 4, 3));
        }
        const numberFields = fields.filter((f) => f.type === 'number');
        if (numberFields[0]) {
            blocks.push(makeKpi(numberFields[0].slug, 'Pedidos', 'number', 4, 3));
        }

        // Pedidos como relation, si existe.
        const ordersRel = pickFieldSlug(fields, (f) => f.type === 'relation' && /pedido|order|venta/i.test(f.slug + f.label));
        if (ordersRel) {
            blocks.push(makeBlock('related', 8, 6, { field_slug: ordersRel }));
        }

        blocks.push(makeNotes(
            'Recordatorios para el operador',
            'Validar dirección de envío antes de confirmar pedidos grandes.\nOfrecer cupón si el cliente compra por +3era vez.',
            4,
            3,
        ));

        return blocks;
    },
};

const agency: IndustryPreset = {
    id: 'agency',
    name: 'Agencia',
    description: 'Clientes con proyectos activos, facturación y comentarios internos.',
    build: (fields) => {
        const blocks: Array<Omit<V2Block, 'id' | 'x' | 'y'>> = [];

        blocks.push(makeHeading('Datos del cliente', 2));

        const contactSlugs = [
            ...fieldSlugsOfType(fields, ['email']).slice(0, 1),
            ...fieldSlugsOfType(fields, ['url']).slice(0, 1),
        ];
        const companyField = pickFieldSlug(fields, (f) => f.type === 'text' && /empresa|company|razon|razón/i.test(f.slug + f.label));
        if (companyField) contactSlugs.unshift(companyField);
        if (contactSlugs.length > 0) {
            blocks.push(makeGroup('Contacto', 'building', contactSlugs, 6, 4));
        }

        const billingSlugs = fields
            .filter((f) => /factur|billing|tax|cuit|nif|rut/i.test(f.slug + f.label))
            .slice(0, 4)
            .map((f) => f.slug);
        if (billingSlugs.length > 0) {
            blocks.push(makeGroup('Facturación', 'dollar', billingSlugs, 6, 4));
        }

        blocks.push(makeDivider('Proyectos'));

        const projectsRel = pickFieldSlug(fields, (f) => f.type === 'relation' && /proyecto|project|cuenta/i.test(f.slug + f.label));
        if (projectsRel) {
            blocks.push(makeBlock('related', 12, 6, { field_slug: projectsRel }));
        }

        const monthlyValueField = pickFieldSlug(fields, (f) => f.type === 'currency' && /mensual|monthly|mrr|recurring/i.test(f.slug + f.label));
        if (monthlyValueField) {
            blocks.push(makeKpi(monthlyValueField, 'MRR', 'currency', 4, 3));
        }

        blocks.push(makeBlock('comments_thread', 8, 8, { title: 'Notas internas del equipo' }));

        return blocks;
    },
};

const health: IndustryPreset = {
    id: 'health',
    name: 'Salud',
    description: 'Ficha de paciente: datos básicos, historia clínica y citas.',
    build: (fields) => {
        const blocks: Array<Omit<V2Block, 'id' | 'x' | 'y'>> = [];

        blocks.push(makeHeading('Ficha del paciente', 2));

        const basicSlugs = [
            ...fields.filter((f) => /dni|documento|cedula|cédula|passport/i.test(f.slug + f.label)).slice(0, 1).map((f) => f.slug),
            ...fields.filter((f) => /nacim|birth|edad|age/i.test(f.slug + f.label)).slice(0, 1).map((f) => f.slug),
            ...fields.filter((f) => /genero|género|sexo/i.test(f.slug + f.label)).slice(0, 1).map((f) => f.slug),
        ];
        if (basicSlugs.length > 0) {
            blocks.push(makeGroup('Datos personales', 'user', basicSlugs, 6, 4));
        }

        const contactSlugs = [
            ...fieldSlugsOfType(fields, ['email']).slice(0, 1),
            ...fields.filter((f) => f.type === 'text' && /phone|tel|whatsapp/i.test(f.slug + f.label)).slice(0, 1).map((f) => f.slug),
        ];
        if (contactSlugs.length > 0) {
            blocks.push(makeGroup('Contacto', 'mail', contactSlugs, 6, 4));
        }

        blocks.push(makeHeading('Historia clínica', 3));

        const longTextFields = fields.filter((f) => f.type === 'long_text').slice(0, 3).map((f) => f.slug);
        if (longTextFields.length > 0) {
            blocks.push(makeGroup('Antecedentes', 'sticky_note', longTextFields, 12, 6));
        }

        // Citas como relation, si existe.
        const appointmentsRel = pickFieldSlug(fields, (f) => f.type === 'relation' && /cita|appointment|consulta|turno/i.test(f.slug + f.label));
        if (appointmentsRel) {
            blocks.push(makeBlock('related', 12, 5, { field_slug: appointmentsRel }));
        }

        blocks.push(makeNotes(
            'Alertas',
            'Confirmar alergias en cada visita.\nVerificar consentimiento informado al primer turno.',
            6,
            3,
        ));

        return blocks;
    },
};

const realestate: IndustryPreset = {
    id: 'realestate',
    name: 'Inmobiliaria',
    description: 'Propiedad con galería, ubicación, precio y leads interesados.',
    build: (fields) => {
        const blocks: Array<Omit<V2Block, 'id' | 'x' | 'y'>> = [];

        blocks.push(makeHeading('Información de la propiedad', 2));

        const propertySlugs = fields
            .filter((f) => /(tipo|type|dormitorios|bedrooms|baños|bathrooms|m2|metros|area)/i.test(f.slug + f.label))
            .slice(0, 6)
            .map((f) => f.slug);
        if (propertySlugs.length > 0) {
            blocks.push(makeGroup('Características', 'building', propertySlugs, 8, 5));
        }

        const priceField = pickFieldSlug(fields, (f) => f.type === 'currency' || /precio|price|valor/i.test(f.slug + f.label));
        if (priceField) {
            blocks.push(makeKpi(priceField, 'Precio publicado', 'currency', 4, 3));
        }

        const addressSlugs = fields
            .filter((f) => /direccion|address|ciudad|city|barrio|neighborhood|pais|country|cp|zip/i.test(f.slug + f.label))
            .slice(0, 4)
            .map((f) => f.slug);
        if (addressSlugs.length > 0) {
            blocks.push(makeGroup('Ubicación', 'building', addressSlugs, 6, 4));
        }

        // Galería: cualquier file field.
        if (hasField(fields, (f) => f.type === 'file')) {
            blocks.push(makeBlock('files', 12, 5, { file_field_slugs: [] }));
        }

        blocks.push(makeDivider('Leads interesados'));

        const leadsRel = pickFieldSlug(fields, (f) => f.type === 'relation' && /lead|interes|contact/i.test(f.slug + f.label));
        if (leadsRel) {
            blocks.push(makeBlock('related', 12, 5, { field_slug: leadsRel }));
        }

        return blocks;
    },
};

export const INDUSTRY_PRESETS: IndustryPreset[] = [ecommerce, agency, health, realestate];

/**
 * Aplica un preset al config actual: appendea los bloques al final
 * del canvas con offset vertical acumulado para que sean visibles
 * de inmediato. NO reemplaza nada del config existente.
 *
 * Genera IDs únicos para cada bloque, posiciona x=0 para columnas
 * full-width o respeta el `w` del preset para layouts side-by-side
 * (toma el siguiente x libre en la fila actual hasta llenar cols=12).
 */
export function applyPreset(
    config: CustomTemplateConfigV2,
    preset: IndustryPreset,
    fields: FieldEntity[],
): CustomTemplateConfigV2 {
    const built = preset.build(fields);
    if (built.length === 0) return config;

    const startY = config.blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    const COLS = 12;

    let currentX = 0;
    let currentRowY = startY;
    let currentRowH = 0;

    const newBlocks: V2Block[] = built.map((b, i) => {
        if (currentX + b.w > COLS) {
            // Wrap: pasamos a la fila siguiente.
            currentRowY += currentRowH;
            currentX = 0;
            currentRowH = 0;
        }
        const block: V2Block = {
            ...b,
            id: `${b.type}-preset-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
            x: currentX,
            y: currentRowY,
        } as V2Block;
        currentX += b.w;
        currentRowH = Math.max(currentRowH, b.h);
        return block;
    });

    return { ...config, blocks: [...config.blocks, ...newBlocks] };
}
