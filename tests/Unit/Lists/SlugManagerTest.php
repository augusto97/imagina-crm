<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Lists;

use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\Database;
use ImaginaCRM\Support\SlugContext;
use ImaginaCRM\Tests\Unit\Stubs\FakeWpdb;
use PHPUnit\Framework\TestCase;

/**
 * Cobertura de las partes puras de `SlugManager` (no tocan BD):
 * `validateFormat()`, `isReserved()`, `slugify()`.
 *
 * Los métodos que sí consultan BD (`validate`, `generateUnique`, `rename`,
 * `resolveCurrentSlug`, `getHistory`) se verifican en el suite de
 * integración con un MySQL real — se añadirán en commits posteriores.
 */
final class SlugManagerTest extends TestCase
{
    private SlugManager $slugs;

    protected function setUp(): void
    {
        $this->slugs = new SlugManager(new Database(new FakeWpdb()));
    }

    /**
     * @dataProvider validSlugsProvider
     */
    public function test_validateFormat_accepts_valid_slugs(string $slug): void
    {
        $result = $this->slugs->validateFormat($slug);
        $this->assertTrue(
            $result->isValid(),
            sprintf('Expected "%s" to be valid; got: %s', $slug, (string) $result->firstError())
        );
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function validSlugsProvider(): array
    {
        return [
            'single letter'   => ['a'],
            'snake case'      => ['clientes_anuales'],
            'with digits'     => ['proyecto_2026'],
            'all letters'     => ['inventario'],
            'underscore mid'  => ['ventas_b2b'],
            'long but valid'  => [str_repeat('a', SlugManager::MAX_SLUG_LENGTH)],
        ];
    }

    /**
     * @dataProvider invalidSlugsProvider
     */
    public function test_validateFormat_rejects_invalid_slugs(string $slug): void
    {
        $this->assertFalse($this->slugs->validateFormat($slug)->isValid());
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function invalidSlugsProvider(): array
    {
        return [
            'empty'              => [''],
            'starts with digit'  => ['1clients'],
            'starts with under'  => ['_foo'],
            'uppercase'          => ['Clientes'],
            'with hyphen'        => ['mi-lista'],
            'with space'         => ['mi lista'],
            'with accent'        => ['mañana'],
            'too long'           => [str_repeat('a', SlugManager::MAX_SLUG_LENGTH + 1)],
        ];
    }

    public function test_isReserved_blocks_list_reserved_slugs(): void
    {
        foreach (SlugManager::RESERVED_LIST_SLUGS as $reserved) {
            $this->assertTrue(
                $this->slugs->isReserved($reserved, SlugContext::List_),
                "Expected list slug '{$reserved}' to be reserved."
            );
        }
    }

    public function test_isReserved_blocks_field_reserved_slugs(): void
    {
        foreach (SlugManager::RESERVED_FIELD_SLUGS as $reserved) {
            $this->assertTrue(
                $this->slugs->isReserved($reserved, SlugContext::Field),
                "Expected field slug '{$reserved}' to be reserved."
            );
        }
    }

    public function test_isReserved_blocks_mysql_keywords_in_both_contexts(): void
    {
        foreach (['select', 'where', 'order', 'index'] as $keyword) {
            $this->assertTrue($this->slugs->isReserved($keyword, SlugContext::List_));
            $this->assertTrue($this->slugs->isReserved($keyword, SlugContext::Field));
        }
    }

    public function test_isReserved_allows_normal_slugs(): void
    {
        foreach (['clientes', 'tareas', 'proyectos_2026', 'leads'] as $slug) {
            $this->assertFalse($this->slugs->isReserved($slug, SlugContext::List_));
            $this->assertFalse($this->slugs->isReserved($slug, SlugContext::Field));
        }
    }

    public function test_field_reserved_does_not_apply_to_lists(): void
    {
        // 'id' es reservada para campos pero válida como slug de lista.
        $this->assertFalse($this->slugs->isReserved('id', SlugContext::List_));
        $this->assertTrue($this->slugs->isReserved('id', SlugContext::Field));
    }

    public function test_slugify_normalizes_common_inputs(): void
    {
        $this->assertSame('mi_lista', $this->slugs->slugify('Mi Lista'));
        $this->assertSame('clientes_2026', $this->slugs->slugify('Clientes 2026'));
        $this->assertSame('manana_y_pasado', $this->slugs->slugify('Mañana y Pasado'));
        $this->assertSame('agua_y_vino', $this->slugs->slugify('  agua   y   vino  '));
    }

    public function test_slugify_prefixes_when_starting_with_digit(): void
    {
        $this->assertSame('l_2026_clientes', $this->slugs->slugify('2026 clientes'));
    }

    public function test_slugify_returns_empty_for_pure_garbage(): void
    {
        $this->assertSame('', $this->slugs->slugify('---'));
        $this->assertSame('', $this->slugs->slugify('   '));
    }

    public function test_slugify_truncates_to_physical_max(): void
    {
        $long  = str_repeat('clientes_', 20);
        $result = $this->slugs->slugify($long, SlugManager::PHYSICAL_MAX_LEN);

        $this->assertLessThanOrEqual(SlugManager::PHYSICAL_MAX_LEN, strlen($result));
        $this->assertDoesNotMatchRegularExpression('/_$/', $result, 'Truncated slug must not end with underscore.');
    }

    public function test_slugify_output_passes_format_validation(): void
    {
        foreach (['Mi Lista', 'Clientes 2026', 'Mañana', 'agua y vino'] as $input) {
            $slug = $this->slugs->slugify($input);
            $this->assertNotSame('', $slug);
            $this->assertTrue(
                $this->slugs->validateFormat($slug)->isValid(),
                "slugify('{$input}') = '{$slug}' should pass validateFormat."
            );
        }
    }
}
