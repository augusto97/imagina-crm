/**
 * Tipos del cliente para el módulo de Automatizaciones (CLAUDE.md §15 Fase 2).
 * Espejan las shapes que devuelve `/imagina-crm/v1/lists/{list}/automations`,
 * `/automations/{id}/runs`, `/triggers` y `/actions`.
 */

export type TriggerSlug = 'record_created' | 'record_updated' | string;

export type ActionSlug = 'update_field' | 'call_webhook' | string;

export interface TriggerConfig {
    field_filters?: Record<string, unknown>;
    changed_fields?: string[];
    [key: string]: unknown;
}

export interface ActionSpec {
    type: ActionSlug;
    config: Record<string, unknown>;
    /**
     * Condición opcional `[slug => valor_esperado]`. Si se define y la
     * evaluación contra el registro del trigger falla, la acción se omite
     * con `status: 'skipped'`. Misma shape que `TriggerConfig.field_filters`.
     */
    condition?: Record<string, unknown>;
}

/**
 * Shape canónica del config de una acción `if_else`. El backend valida
 * recursivamente — `then_actions` y `else_actions` aceptan cualquier
 * acción válida (incluyendo otro `if_else`, hasta `MAX_IF_ELSE_DEPTH`
 * niveles).
 */
export interface IfElseActionConfig {
    condition: Record<string, unknown>;
    then_actions: ActionSpec[];
    else_actions: ActionSpec[];
    [key: string]: unknown;
}

export interface AutomationEntity {
    id: number;
    list_id: number;
    name: string;
    description: string | null;
    trigger_type: TriggerSlug;
    trigger_config: TriggerConfig;
    actions: ActionSpec[];
    is_active: boolean;
    created_by: number;
    created_at: string;
    updated_at: string;
}

export interface CreateAutomationInput {
    name: string;
    description?: string | null;
    trigger_type: TriggerSlug;
    trigger_config?: TriggerConfig;
    actions: ActionSpec[];
    is_active?: boolean;
}

export interface UpdateAutomationInput {
    name?: string;
    description?: string | null;
    trigger_type?: TriggerSlug;
    trigger_config?: TriggerConfig;
    actions?: ActionSpec[];
    is_active?: boolean;
}

export interface TriggerMeta {
    slug: TriggerSlug;
    label: string;
    event: string;
    config_schema: Record<string, Record<string, unknown>>;
}

export interface ActionMeta {
    slug: ActionSlug;
    label: string;
    config_schema: Record<string, Record<string, unknown>>;
}

export type AutomationRunStatus = 'pending' | 'running' | 'success' | 'failed';

export type ActionLogStatus = 'success' | 'failed' | 'skipped';

export interface ActionLogEntry {
    action: string;
    status: ActionLogStatus;
    message: string | null;
    details: Record<string, unknown>;
}

export interface AutomationRunEntity {
    id: number;
    automation_id: number;
    list_id: number;
    record_id: number | null;
    status: AutomationRunStatus;
    trigger_context: Record<string, unknown> | null;
    actions_log: ActionLogEntry[];
    error: string | null;
    retries: number;
    started_at: string | null;
    finished_at: string | null;
    created_at: string | null;
}
