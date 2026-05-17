<?php
declare(strict_types=1);

namespace ImaginaCRM\Portal;

use ImaginaCRM\Fields\FieldEntity;

/**
 * Value object inmutable que representa el template del portal del
 * cliente (Fase 9 — 3.C).
 *
 * Almacenamiento: `wp_imcrm_lists.settings.portal_template` (JSON).
 * Mismo patrón que el `crm_panel_template` ya existente — sin nuevas
 * tablas, todo en settings.
 *
 * Shape persistido (ejemplo):
 * ```
 * {
 *   "portal_template": {
 *     "blocks": [
 *       {
 *         "type": "client_data",
 *         "config": {
 *           "visible_field_slugs": ["nombre", "email", "telefono"]
 *         }
 *       },
 *       {
 *         "type": "related_records_table",
 *         "config": {
 *           "list_slug": "facturas",
 *           "visible_field_slugs": ["fecha", "monto", "estado"],
 *           "title": "Mis facturas"
 *         }
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * **Default automático**: cuando una lista de portal NO tiene template
 * configurado, `defaultFor()` genera uno con un único bloque
 * `client_data` mostrando todos los fields del record cliente. Eso
 * garantiza que el portal "funciona out-of-the-box" desde el momento
 * en que un cliente se asocia, sin requerir que el admin diseñe el
 * template primero.
 *
 * Tipos de bloque soportados en 3.C (más en 3.D-3.E):
 *  - `client_data` — datos del record cliente (subset de fields).
 *  - `related_records_table` — tabla de records de otra lista
 *    relacionada al cliente.
 *  - `static_text` — bloque HTML estático (mensaje de bienvenida,
 *    instrucciones).
 *
 * Tipos futuros (3.E):
 *  - `editable_form` — form para que el cliente actualice campos.
 *  - `kpi_widget`, `chart_widget` — métricas.
 *  - `activity_timeline`, `comments_thread`.
 */
final class PortalTemplate
{
    public const VALID_BLOCK_TYPES = [
        'client_data',
        'related_records_table',
        'static_text',
        // Fase 9 — 3.E
        'editable_form',
        'external_link',
        'kpi_widget',
        // Fase 9 — pulidos
        'activity_timeline',
        'download_files',
    ];

    /**
     * @param list<array{type: string, config: array<string, mixed>}> $blocks
     */
    private function __construct(
        public readonly array $blocks,
    ) {
    }

    /**
     * @param array<string, mixed> $settings
     */
    public static function fromListSettings(array $settings): self
    {
        $raw = $settings['portal_template'] ?? null;
        if (! is_array($raw)) {
            return self::empty();
        }
        $rawBlocks = $raw['blocks'] ?? null;
        if (! is_array($rawBlocks)) {
            return self::empty();
        }

        $blocks = [];
        foreach ($rawBlocks as $block) {
            if (! is_array($block)) {
                continue;
            }
            $type = isset($block['type']) && is_string($block['type']) ? $block['type'] : '';
            if (! in_array($type, self::VALID_BLOCK_TYPES, true)) {
                continue;
            }
            $config = isset($block['config']) && is_array($block['config']) ? $block['config'] : [];
            $blocks[] = ['type' => $type, 'config' => $config];
        }

        return new self($blocks);
    }

    public static function empty(): self
    {
        return new self([]);
    }

    /**
     * Genera un template default usable para una lista de portal sin
     * `portal_template` configurado. Muestra TODOS los fields del
     * record cliente excepto los `relation` (que requieren resolución
     * separada en el bloque correspondiente).
     *
     * @param list<FieldEntity> $portalListFields
     */
    public static function defaultFor(array $portalListFields): self
    {
        $visibleSlugs = [];
        foreach ($portalListFields as $field) {
            if ($field->deletedAt !== null) {
                continue;
            }
            if ($field->type === 'relation') {
                continue;
            }
            $visibleSlugs[] = $field->slug;
        }

        return new self([
            [
                'type'   => 'static_text',
                'config' => [
                    'html' => '<p>Bienvenido a tu portal. Aquí encontrarás tu información y los registros vinculados a tu cuenta.</p>',
                ],
            ],
            [
                'type'   => 'client_data',
                'config' => [
                    'visible_field_slugs' => $visibleSlugs,
                    'title'               => 'Mis datos',
                ],
            ],
        ]);
    }

    public function isEmpty(): bool
    {
        return $this->blocks === [];
    }

    /**
     * Whitelist de campos que el cliente puede editar via
     * `PATCH /portal/me`. Es la UNIÓN de los slugs declarados en TODOS
     * los bloques `editable_form` del template.
     *
     * Por seguridad, si un slug NO está en esta whitelist, el endpoint
     * lo rechaza con 403 (data tampering prevention).
     *
     * @return list<string>
     */
    public function editableFieldSlugs(): array
    {
        $out = [];
        foreach ($this->blocks as $block) {
            if ($block['type'] !== 'editable_form') {
                continue;
            }
            $slugs = $block['config']['editable_field_slugs'] ?? null;
            if (! is_array($slugs)) {
                continue;
            }
            foreach ($slugs as $slug) {
                if (is_string($slug) && $slug !== '') {
                    $out[] = $slug;
                }
            }
        }
        return array_values(array_unique($out));
    }

    /**
     * @return list<array{type: string, config: array<string, mixed>}>
     */
    public function toArray(): array
    {
        return $this->blocks;
    }
}
