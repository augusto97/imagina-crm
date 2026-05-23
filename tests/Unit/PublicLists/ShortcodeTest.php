<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\PublicLists;

use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\PublicLists\PublicListConfig;
use ImaginaCRM\PublicLists\PublicListReader;
use ImaginaCRM\PublicLists\Shortcode;
use ImaginaCRM\Support\ValidationResult;
use PHPUnit\Framework\TestCase;

/**
 * Smoke test del shortcode. Cobertura:
 *  - Slug vacío o no resoluble → string vacío (no rompe el render del tema).
 *  - Slug público con records → HTML con tabla, headers, marcas de
 *    hidratación.
 *  - Tipos especiales (email, url, checkbox, multi_select) renderizan
 *    el HTML esperado.
 *
 * No prueba seguridad de escape — los stubs `esc_*` del bootstrap solo
 * envuelven `htmlspecialchars`. El escape real de WP es más estricto y
 * se valida en tests integration (no en este suite).
 */
final class ShortcodeTest extends TestCase
{
    public function test_returns_empty_for_missing_slug(): void
    {
        $shortcode = $this->makeShortcode(serviceList: null, fields: []);
        $this->assertSame('', $shortcode->render([]));
        $this->assertSame('', $shortcode->render(['slug' => '']));
    }

    public function test_returns_empty_when_list_not_public(): void
    {
        $shortcode = $this->makeShortcode(serviceList: null, fields: []);
        $this->assertSame('', $shortcode->render(['slug' => 'no_existe']));
    }

    public function test_returns_empty_when_service_returns_validation_error(): void
    {
        $list = $this->makeList(1, 'rota', [
            'public' => ['enabled' => true, 'visible_field_slugs' => ['x']],
        ]);
        // Service simula un error de validación (ej. fixed_filter_tree
        // mis-configurado). El shortcode no debe romper la página del
        // tema: devuelve string vacío silencioso.
        $shortcode = $this->makeShortcode(
            serviceList: $list,
            fields: [['slug' => 'x', 'label' => 'X', 'type' => 'text']],
            records: ValidationResult::failWith('filter', 'mal config'),
        );
        $this->assertSame('', $shortcode->render(['slug' => 'rota']));
    }

    public function test_renders_table_with_visible_columns(): void
    {
        $list = $this->makeList(1, 'productos', [
            'public' => [
                'enabled'             => true,
                'visible_field_slugs' => ['nombre', 'precio'],
                'per_page'            => 10,
            ],
        ]);
        // metaFor() solo devuelve las visibles — `oculto` no aparece.
        $fields = [
            ['slug' => 'nombre', 'label' => 'Nombre', 'type' => 'text'],
            ['slug' => 'precio', 'label' => 'Precio', 'type' => 'currency'],
        ];

        $records = [
            'data' => [
                ['id' => 10, 'fields' => ['nombre' => 'Café', 'precio' => '12.50'], 'relations' => []],
                ['id' => 11, 'fields' => ['nombre' => 'Té', 'precio' => '8.00'], 'relations' => []],
            ],
            'meta' => ['page' => 1, 'per_page' => 10, 'total' => 2, 'total_pages' => 1],
        ];

        $shortcode = $this->makeShortcode(serviceList: $list, fields: $fields, records: $records);
        $html = $shortcode->render(['slug' => 'productos']);

        $this->assertStringContainsString('data-imcrm-public-list="productos"', $html);
        $this->assertStringContainsString('<table class="imcrm-public-list__table"', $html);
        // Header labels visibles (con `\s*` el assertion tolera la
        // indentación PHP que mete WS entre `>` y el texto).
        $this->assertMatchesRegularExpression('/<th[^>]*>\s*Nombre\s*<\/th>/', $html);
        $this->assertMatchesRegularExpression('/<th[^>]*>\s*Precio\s*<\/th>/', $html);
        $this->assertStringContainsString('Café', $html);
        $this->assertStringContainsString('12.50', $html);
    }

    public function test_email_and_url_fields_become_links(): void
    {
        $list = $this->makeList(1, 'contactos', [
            'public' => ['enabled' => true, 'visible_field_slugs' => ['email', 'web']],
        ]);
        $fields = [
            ['slug' => 'email', 'label' => 'Email', 'type' => 'email'],
            ['slug' => 'web', 'label' => 'Web', 'type' => 'url'],
        ];
        $records = [
            'data' => [['id' => 1, 'fields' => ['email' => 'foo@bar.com', 'web' => 'https://example.com'], 'relations' => []]],
            'meta' => ['page' => 1, 'per_page' => 20, 'total' => 1, 'total_pages' => 1],
        ];

        $shortcode = $this->makeShortcode(serviceList: $list, fields: $fields, records: $records);
        $html = $shortcode->render(['slug' => 'contactos']);

        $this->assertStringContainsString('mailto:foo@bar.com', $html);
        $this->assertStringContainsString('href="https://example.com"', $html);
    }

    public function test_checkbox_renders_check_or_cross(): void
    {
        $list = $this->makeList(1, 'tareas', [
            'public' => ['enabled' => true, 'visible_field_slugs' => ['hecho']],
        ]);
        $fields = [['slug' => 'hecho', 'label' => 'Hecho', 'type' => 'checkbox']];
        $records = [
            'data' => [
                ['id' => 1, 'fields' => ['hecho' => true], 'relations' => []],
                ['id' => 2, 'fields' => ['hecho' => false], 'relations' => []],
            ],
            'meta' => ['page' => 1, 'per_page' => 20, 'total' => 2, 'total_pages' => 1],
        ];

        $shortcode = $this->makeShortcode(serviceList: $list, fields: $fields, records: $records);
        $html = $shortcode->render(['slug' => 'tareas']);

        $this->assertStringContainsString('✓', $html);
        $this->assertStringContainsString('✗', $html);
    }

    public function test_empty_records_renders_placeholder(): void
    {
        $list = $this->makeList(1, 'vacia', [
            'public' => ['enabled' => true, 'visible_field_slugs' => ['nombre']],
        ]);
        $fields = [['slug' => 'nombre', 'label' => 'Nombre', 'type' => 'text']];
        $records = [
            'data' => [],
            'meta' => ['page' => 1, 'per_page' => 20, 'total' => 0, 'total_pages' => 0],
        ];

        $shortcode = $this->makeShortcode(serviceList: $list, fields: $fields, records: $records);
        $html = $shortcode->render(['slug' => 'vacia']);

        $this->assertStringContainsString('imcrm-public-list__empty', $html);
        $this->assertStringNotContainsString('<table', $html);
    }

    public function test_data_attributes_carry_initial_state_for_hydration(): void
    {
        // Fase 8 — 2.C consumirá data-imcrm-config y data-imcrm-initial
        // para hidratar el div con React. Verificamos que ambos están
        // presentes con JSON serializable.
        $list = $this->makeList(1, 'productos', [
            'public' => ['enabled' => true, 'visible_field_slugs' => ['nombre']],
        ]);
        $fields = [['slug' => 'nombre', 'label' => 'Nombre', 'type' => 'text']];
        $records = [
            'data' => [['id' => 1, 'fields' => ['nombre' => 'X'], 'relations' => []]],
            'meta' => ['page' => 1, 'per_page' => 20, 'total' => 1, 'total_pages' => 1],
        ];

        $shortcode = $this->makeShortcode(serviceList: $list, fields: $fields, records: $records);
        $html = $shortcode->render(['slug' => 'productos']);

        $this->assertMatchesRegularExpression('/data-imcrm-config="[^"]+"/', $html);
        $this->assertMatchesRegularExpression('/data-imcrm-initial="[^"]+"/', $html);
    }

    // ───────────────────────────────────────────────────────────────────
    //  Helpers
    // ───────────────────────────────────────────────────────────────────

    /**
     * Construye un Shortcode con un fake del PublicListReader. Si
     * `serviceList` es null, el fake simula "lista no pública" y
     * `fetchRecords` no se llama.
     *
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
    private function makeList(int $id, string $slug, array $settings): ListEntity
    {
        return new ListEntity(
            id:          $id,
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
