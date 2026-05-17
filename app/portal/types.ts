/**
 * Tipos compartidos del bundle del portal del cliente (Fase 9 — 3.D).
 *
 * Espejan los shapes que emite el `PortalController` y `PortalShortcode`
 * server-side. Estables — cambios deben coordinarse con el PHP.
 */

export interface PortalBootData {
    rest_root: string;
    rest_nonce: string;
    list_slug: string;
    user_id: number;
    record_id: number;
}

export interface PortalRecord {
    id: number;
    fields: Record<string, unknown>;
    relations: Record<string, unknown>;
}

export interface PortalListMeta {
    id: number;
    slug: string;
    name: string;
}

export interface PortalUserMeta {
    id: number;
    display_name: string;
    email: string;
}

export type PortalBlock =
    | { type: 'static_text'; config: { html?: string; title?: string } }
    | {
          type: 'client_data';
          config: {
              visible_field_slugs?: string[];
              title?: string;
          };
      }
    | {
          type: 'related_records_table';
          config: {
              list_slug?: string;
              visible_field_slugs?: string[];
              title?: string;
              per_page?: number;
          };
      };

export interface PortalMeResponse {
    data: {
        list: PortalListMeta;
        record: PortalRecord;
        user: PortalUserMeta;
        template: { blocks: PortalBlock[] };
    };
}

export interface PortalRecordsResponse {
    data: PortalRecord[];
    meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}
