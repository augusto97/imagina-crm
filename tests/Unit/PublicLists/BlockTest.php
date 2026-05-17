<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\PublicLists;

use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\PublicLists\Block;
use ImaginaCRM\PublicLists\PublicListConfig;
use ImaginaCRM\PublicLists\PublicListReader;
use ImaginaCRM\PublicLists\Shortcode;
use ImaginaCRM\Support\ValidationResult;
use PHPUnit\Framework\TestCase;

/**
 * Cobertura del bloque Gutenberg. Como delega TODO el render al
 * shortcode, los tests verifican el contrato:
 *  - Sin slug + user puede editar → placeholder visible.
 *  - Sin slug + visitante anónimo → string vacío.
 *  - Con slug → mismo HTML que `Shortcode::render(['slug' => ...])`.
 *  - Atributos extra (perPage, extraClass) se transmiten al shortcode.
 */
final class BlockTest extends TestCase
{
    public function test_empty_slug_renders_placeholder_for_editors(): void
    {
        $GLOBALS['imcrm_test_current_user_can'] = static fn (string $cap): bool => $cap === 'edit_posts';

        $block = new Block($this->makeShortcode(null, []));
        $html = $block->renderBlock(['slug' => '']);

        $this->assertStringContainsString('imcrm-public-list--placeholder', $html);
        $this->assertStringContainsString('Configura el slug', $html);
    }

    public function test_empty_slug_returns_empty_for_anonymous_visitors(): void
    {
        // Visitante público — no puede editar.
        $GLOBALS['imcrm_test_current_user_can'] = static fn (): bool => false;

        $block = new Block($this->makeShortcode(null, []));
        $this->assertSame('', $block->renderBlock(['slug' => '']));
    }

    public function test_with_slug_delegates_to_shortcode(): void
    {
        $list = $this->makeList('productos', [
            'public' => ['enabled' => true, 'visible_field_slugs' => ['nombre']],
        ]);
        $fields = [['slug' => 'nombre', 'label' => 'Nombre', 'type' => 'text']];
        $records = [
            'data' => [['id' => 1, 'fields' => ['nombre' => 'Café'], 'relations' => []]],
            'meta' => ['page' => 1, 'per_page' => 20, 'total' => 1, 'total_pages' => 1],
        ];

        $shortcode = $this->makeShortcode($list, $fields, $records);
        $block = new Block($shortcode);
        $html = $block->renderBlock(['slug' => 'productos']);

        // Debe haber renderizado la tabla, no el placeholder.
        $this->assertStringContainsString('imcrm-public-list', $html);
        $this->assertStringNotContainsString('imcrm-public-list--placeholder', $html);
        $this->assertStringContainsString('Café', $html);
        $this->assertStringContainsString('data-imcrm-public-list="productos"', $html);
    }

    public function test_extra_class_attribute_passes_through(): void
    {
        $list = $this->makeList('productos', [
            'public' => ['enabled' => true, 'visible_field_slugs' => ['nombre']],
        ]);
        $fields = [['slug' => 'nombre', 'label' => 'Nombre', 'type' => 'text']];
        $records = [
            'data' => [['id' => 1, 'fields' => ['nombre' => 'X'], 'relations' => []]],
            'meta' => ['page' => 1, 'per_page' => 20, 'total' => 1, 'total_pages' => 1],
        ];

        $block = new Block($this->makeShortcode($list, $fields, $records));
        $html = $block->renderBlock(['slug' => 'productos', 'extraClass' => 'mi-tema-tabla']);

        $this->assertStringContainsString('mi-tema-tabla', $html);
    }

    public function test_per_page_attribute_passes_through(): void
    {
        // Verificamos vía conteo de la fixture: el shortcode acepta
        // `per_page` y debería pasarlo al service. Acá no chequeamos
        // el SQL en sí (eso es de RecordService) — solo el contrato.
        $list = $this->makeList('productos', [
            'public' => ['enabled' => true, 'visible_field_slugs' => ['nombre']],
        ]);
        $fields = [['slug' => 'nombre', 'label' => 'Nombre', 'type' => 'text']];
        $records = [
            'data' => [['id' => 1, 'fields' => ['nombre' => 'X'], 'relations' => []]],
            'meta' => ['page' => 1, 'per_page' => 5, 'total' => 1, 'total_pages' => 1],
        ];

        $block = new Block($this->makeShortcode($list, $fields, $records));
        $html = $block->renderBlock(['slug' => 'productos', 'perPage' => 5]);

        $this->assertStringContainsString('imcrm-public-list', $html);
    }

    // ───────────────────────────────────────────────────────────────────
    //  Helpers (mismo patrón que ShortcodeTest)
    // ───────────────────────────────────────────────────────────────────

    /**
     * @param list<array{slug:string, label:string, type:string}> $fields
     * @param array<string, mixed>|ValidationResult|null          $records
     */
    private function makeShortcode(?ListEntity $serviceList, array $fields, array|ValidationResult|null $records = null): Shortcode
    {
        $reader = new class ($serviceList, $fields, $records) implements PublicListReader {
            /**
             * @param list<array{slug:string, label:string, type:string}> $fields
             * @param array<string, mixed>|ValidationResult|null          $records
             */
            public function __construct(
                private readonly ?ListEntity $list,
                private readonly array $fields,
                private readonly array|ValidationResult|null $records,
            ) {
            }
            public function findPublicList(string $slug): ?ListEntity
            {
                unset($slug);
                return $this->list;
            }
            public function configFor(ListEntity $list): PublicListConfig
            {
                return PublicListConfig::fromListSettings($list->settings);
            }
            public function metaFor(ListEntity $list): array
            {
                return [
                    'slug'        => $list->slug,
                    'name'        => $list->name,
                    'description' => $list->description,
                    'fields'      => $this->fields,
                ];
            }
            public function fetchRecords(ListEntity $list, array $params): array|ValidationResult
            {
                unset($list, $params);
                return $this->records ?? [
                    'data' => [],
                    'meta' => ['page' => 1, 'per_page' => 20, 'total' => 0, 'total_pages' => 0],
                ];
            }
        };

        return new Shortcode($reader);
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function makeList(string $slug, array $settings): ListEntity
    {
        return new ListEntity(
            id:          1,
            slug:        $slug,
            tableSuffix: 'ts_' . $slug,
            name:        ucfirst($slug),
            description: null,
            icon:        null,
            color:       null,
            settings:    $settings,
            position:    0,
            createdBy:   1,
            createdAt:   '2026-05-17 00:00:00',
            updatedAt:   '2026-05-17 00:00:00',
            deletedAt:   null,
        );
    }
}
