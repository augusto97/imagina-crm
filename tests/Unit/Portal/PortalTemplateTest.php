<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Portal;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Portal\PortalTemplate;
use PHPUnit\Framework\TestCase;

/**
 * Cobertura del template del portal: parsing del JSON persistido +
 * default generado para listas sin template configurado.
 */
final class PortalTemplateTest extends TestCase
{
    public function test_empty_when_no_portal_template_key(): void
    {
        $tpl = PortalTemplate::fromListSettings([]);
        $this->assertTrue($tpl->isEmpty());
    }

    public function test_empty_when_blocks_missing(): void
    {
        $tpl = PortalTemplate::fromListSettings([
            'portal_template' => ['other_key' => 'value'],
        ]);
        $this->assertTrue($tpl->isEmpty());
    }

    public function test_parses_valid_blocks(): void
    {
        $tpl = PortalTemplate::fromListSettings([
            'portal_template' => [
                'blocks' => [
                    ['type' => 'client_data', 'config' => ['visible_field_slugs' => ['nombre']]],
                    ['type' => 'related_records_table', 'config' => ['list_slug' => 'facturas']],
                ],
            ],
        ]);
        $this->assertFalse($tpl->isEmpty());
        $this->assertCount(2, $tpl->toArray());
        $this->assertSame('client_data', $tpl->toArray()[0]['type']);
        $this->assertSame(['nombre'], $tpl->toArray()[0]['config']['visible_field_slugs']);
    }

    public function test_drops_unknown_block_types(): void
    {
        // Defensa contra mis-config futura: si llega un block type que
        // este release no conoce, lo ignoramos silenciosamente.
        $tpl = PortalTemplate::fromListSettings([
            'portal_template' => [
                'blocks' => [
                    ['type' => 'client_data', 'config' => []],
                    ['type' => 'unknown_future_block', 'config' => []],
                    ['type' => 'static_text', 'config' => ['html' => '<p>x</p>']],
                ],
            ],
        ]);
        $blocks = $tpl->toArray();
        $this->assertCount(2, $blocks);
        $this->assertSame('client_data', $blocks[0]['type']);
        $this->assertSame('static_text', $blocks[1]['type']);
    }

    public function test_drops_non_array_block_entries(): void
    {
        $tpl = PortalTemplate::fromListSettings([
            'portal_template' => [
                'blocks' => [
                    'not-an-array',
                    ['type' => 'client_data', 'config' => []],
                    null,
                ],
            ],
        ]);
        $this->assertCount(1, $tpl->toArray());
    }

    public function test_default_for_includes_static_intro_and_client_data(): void
    {
        $fields = [
            $this->makeField(1, 'nombre', 'text'),
            $this->makeField(2, 'email', 'email'),
        ];
        $tpl = PortalTemplate::defaultFor($fields);
        $blocks = $tpl->toArray();

        $this->assertCount(2, $blocks);
        $this->assertSame('static_text', $blocks[0]['type']);
        $this->assertSame('client_data', $blocks[1]['type']);
        $this->assertSame(['nombre', 'email'], $blocks[1]['config']['visible_field_slugs']);
    }

    public function test_default_skips_relation_fields(): void
    {
        // Los relations en la lista de portal apuntan a OTRAS listas
        // (ej. Facturas), no son datos del cliente per se. El default
        // no los incluye en `client_data` — el admin debe agregar
        // bloques `related_records_table` explícitamente si quiere
        // exponerlos.
        $fields = [
            $this->makeField(1, 'nombre', 'text'),
            $this->makeField(2, 'facturas', 'relation'),
        ];
        $tpl = PortalTemplate::defaultFor($fields);
        $clientDataBlock = $tpl->toArray()[1];
        $this->assertSame(['nombre'], $clientDataBlock['config']['visible_field_slugs']);
    }

    public function test_default_skips_soft_deleted_fields(): void
    {
        $fields = [
            $this->makeField(1, 'nombre', 'text'),
            $this->makeField(2, 'old', 'text', deletedAt: '2026-04-01 00:00:00'),
            $this->makeField(3, 'email', 'email'),
        ];
        $tpl = PortalTemplate::defaultFor($fields);
        $this->assertSame(['nombre', 'email'], $tpl->toArray()[1]['config']['visible_field_slugs']);
    }

    public function test_empty_factory(): void
    {
        $tpl = PortalTemplate::empty();
        $this->assertTrue($tpl->isEmpty());
        $this->assertSame([], $tpl->toArray());
    }

    public function test_editable_field_slugs_returns_empty_without_editable_form_blocks(): void
    {
        // Sin bloques editable_form, NINGÚN campo es editable. Defensa
        // crítica — el endpoint PATCH /portal/me devuelve 403 en este
        // caso.
        $tpl = PortalTemplate::fromListSettings([
            'portal_template' => [
                'blocks' => [
                    ['type' => 'client_data', 'config' => ['visible_field_slugs' => ['nombre']]],
                ],
            ],
        ]);
        $this->assertSame([], $tpl->editableFieldSlugs());
    }

    public function test_editable_field_slugs_unions_across_blocks(): void
    {
        // Si el template tiene VARIOS bloques editable_form, la
        // whitelist es la unión deduplicada.
        $tpl = PortalTemplate::fromListSettings([
            'portal_template' => [
                'blocks' => [
                    ['type' => 'editable_form', 'config' => ['editable_field_slugs' => ['telefono', 'direccion']]],
                    ['type' => 'editable_form', 'config' => ['editable_field_slugs' => ['direccion', 'preferencias']]],
                ],
            ],
        ]);
        $slugs = $tpl->editableFieldSlugs();
        sort($slugs);
        $this->assertSame(['direccion', 'preferencias', 'telefono'], $slugs);
    }

    public function test_editable_field_slugs_filters_non_strings(): void
    {
        $tpl = PortalTemplate::fromListSettings([
            'portal_template' => [
                'blocks' => [
                    [
                        'type'   => 'editable_form',
                        'config' => ['editable_field_slugs' => ['telefono', 42, '', null, 'direccion']],
                    ],
                ],
            ],
        ]);
        $this->assertSame(['telefono', 'direccion'], $tpl->editableFieldSlugs());
    }

    public function test_new_block_types_accepted(): void
    {
        // Defensa: los 5 tipos nuevos de Fase 9 (editable_form,
        // external_link, kpi_widget en 3.E + activity_timeline,
        // download_files en pulidos) deben pasar el parser.
        $tpl = PortalTemplate::fromListSettings([
            'portal_template' => [
                'blocks' => [
                    ['type' => 'editable_form', 'config' => []],
                    ['type' => 'external_link', 'config' => ['href' => 'https://x.com']],
                    ['type' => 'kpi_widget', 'config' => ['list_slug' => 'facturas']],
                    ['type' => 'activity_timeline', 'config' => ['limit' => 30]],
                    ['type' => 'download_files', 'config' => ['field_slug' => 'archivo']],
                ],
            ],
        ]);
        $blocks = $tpl->toArray();
        $this->assertCount(5, $blocks);
        $this->assertSame('editable_form', $blocks[0]['type']);
        $this->assertSame('external_link', $blocks[1]['type']);
        $this->assertSame('kpi_widget', $blocks[2]['type']);
        $this->assertSame('activity_timeline', $blocks[3]['type']);
        $this->assertSame('download_files', $blocks[4]['type']);
    }

    private function makeField(int $id, string $slug, string $type, ?string $deletedAt = null): FieldEntity
    {
        return new FieldEntity(
            id:          $id,
            listId:      1,
            slug:        $slug,
            columnName:  'col_' . $slug,
            label:       ucfirst($slug),
            type:        $type,
            config:      [],
            isRequired:  false,
            isUnique:    false,
            isPrimary:   false,
            position:    0,
            createdAt:   '2026-05-17 00:00:00',
            updatedAt:   '2026-05-17 00:00:00',
            deletedAt:   $deletedAt,
        );
    }
}
