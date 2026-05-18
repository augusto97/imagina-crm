/**
 * Tipos del shape `settings.portal` y `settings.portal_template`
 * (Fase 9). Espejo del PHP `PortalConfig` y `PortalTemplate`.
 */

export interface PortalSettings {
    enabled: boolean;
    owner_field_id: number | null;
    default_template_id: number | null;
}

export const PORTAL_DEFAULTS: PortalSettings = {
    enabled: false,
    owner_field_id: null,
    default_template_id: null,
};

export type PortalBlockType =
    | 'client_data'
    | 'related_records_table'
    | 'static_text'
    | 'editable_form'
    | 'external_link'
    | 'kpi_widget'
    | 'activity_timeline'
    | 'download_files';

export const PORTAL_BLOCK_TYPES: Array<{ value: PortalBlockType; label: string }> = [
    { value: 'static_text', label: 'Texto / HTML' },
    { value: 'client_data', label: 'Datos del cliente' },
    { value: 'editable_form', label: 'Formulario editable' },
    { value: 'related_records_table', label: 'Tabla de registros relacionados' },
    { value: 'kpi_widget', label: 'KPI / métrica' },
    { value: 'external_link', label: 'Enlace externo (CTA)' },
    { value: 'activity_timeline', label: 'Timeline de actividad' },
    { value: 'download_files', label: 'Archivos descargables' },
];

export interface PortalTemplateBlock {
    type: PortalBlockType;
    config: Record<string, unknown>;
}

export interface PortalTemplate {
    blocks: PortalTemplateBlock[];
}
