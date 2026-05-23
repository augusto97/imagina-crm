<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\PublicLists;

use ImaginaCRM\PublicLists\PublicListConfig;
use PHPUnit\Framework\TestCase;

/**
 * Cobertura del value object que parsea `wp_imcrm_lists.settings.public`.
 *
 * Reglas críticas (Fase 8, ver `docs/multi-stakeholder-design.md` §2):
 *  - Default = NO público (fail-closed).
 *  - `enabled=false` o ausencia de la clave `public` → disabled().
 *  - `per_page` clampeado a [1, MAX_PER_PAGE].
 *  - `cache_ttl` clampeado a [0, MAX_TTL].
 *  - `visible_field_slugs` / `sort_allowed_slugs` filtran no-strings y
 *    deduplican.
 *  - `fixed_filter_tree` solo se acepta si tiene shape `{type:'group',...}`.
 */
final class PublicListConfigTest extends TestCase
{
    public function test_disabled_when_no_public_key(): void
    {
        $cfg = PublicListConfig::fromListSettings([]);
        $this->assertFalse($cfg->enabled);
        $this->assertSame([], $cfg->visibleFieldSlugs);
        $this->assertNull($cfg->fixedFilterTree);
    }

    public function test_disabled_when_public_is_not_array(): void
    {
        $cfg = PublicListConfig::fromListSettings(['public' => 'enabled']);
        $this->assertFalse($cfg->enabled);
    }

    public function test_explicit_disabled_flag_respected(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => false, 'visible_field_slugs' => ['x']],
        ]);
        $this->assertFalse($cfg->enabled);
        // Aunque `enabled=false`, el resto del shape se parsea — útil para
        // preview en List Builder antes de activar.
        $this->assertSame(['x'], $cfg->visibleFieldSlugs);
    }

    public function test_full_shape_parses(): void
    {
        $tree = ['type' => 'group', 'logic' => 'and', 'children' => []];
        $cfg = PublicListConfig::fromListSettings([
            'public' => [
                'enabled'                => true,
                'visible_field_slugs'    => ['nombre', 'precio'],
                'fixed_filter_tree'      => $tree,
                'viewer_filters_allowed' => false,
                'sort_allowed_slugs'     => ['precio'],
                'default_sort'           => 'precio:asc',
                'per_page'               => 25,
                'search_enabled'         => false,
                'cache_ttl'              => 120,
            ],
        ]);

        $this->assertTrue($cfg->enabled);
        $this->assertSame(['nombre', 'precio'], $cfg->visibleFieldSlugs);
        $this->assertSame($tree, $cfg->fixedFilterTree);
        $this->assertFalse($cfg->viewerFiltersAllowed);
        $this->assertSame(['precio'], $cfg->sortAllowedSlugs);
        $this->assertSame('precio:asc', $cfg->defaultSort);
        $this->assertSame(25, $cfg->perPage);
        $this->assertFalse($cfg->searchEnabled);
        $this->assertSame(120, $cfg->cacheTtl);
    }

    public function test_visible_field_slugs_normalized(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => [
                'enabled' => true,
                'visible_field_slugs' => ['nombre', 'nombre', '', 42, 'precio', null],
            ],
        ]);
        $this->assertSame(['nombre', 'precio'], $cfg->visibleFieldSlugs);
    }

    public function test_sort_allowed_slugs_normalized(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => [
                'enabled' => true,
                'sort_allowed_slugs' => ['a', 'a', 'b', '', null, 42],
            ],
        ]);
        $this->assertSame(['a', 'b'], $cfg->sortAllowedSlugs);
    }

    public function test_per_page_clamped_to_max(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'per_page' => 9999],
        ]);
        $this->assertSame(PublicListConfig::MAX_PER_PAGE, $cfg->perPage);
    }

    public function test_per_page_clamped_to_min(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'per_page' => 0],
        ]);
        $this->assertSame(1, $cfg->perPage);
    }

    public function test_per_page_default_when_missing(): void
    {
        $cfg = PublicListConfig::fromListSettings(['public' => ['enabled' => true]]);
        $this->assertSame(PublicListConfig::DEFAULT_PER_PAGE, $cfg->perPage);
    }

    public function test_cache_ttl_clamped(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'cache_ttl' => 99999],
        ]);
        $this->assertSame(PublicListConfig::MAX_TTL, $cfg->cacheTtl);

        $cfg2 = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'cache_ttl' => -5],
        ]);
        $this->assertSame(0, $cfg2->cacheTtl);
    }

    public function test_fixed_filter_tree_rejected_if_not_group(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => [
                'enabled' => true,
                'fixed_filter_tree' => ['type' => 'not_a_group', 'children' => []],
            ],
        ]);
        $this->assertNull($cfg->fixedFilterTree);
    }

    public function test_fixed_filter_tree_rejected_if_not_array(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'fixed_filter_tree' => 'a string'],
        ]);
        $this->assertNull($cfg->fixedFilterTree);
    }

    public function test_default_sort_null_if_empty_string(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'default_sort' => ''],
        ]);
        $this->assertNull($cfg->defaultSort);
    }

    public function test_viewer_filters_allowed_defaults_true(): void
    {
        $cfg = PublicListConfig::fromListSettings(['public' => ['enabled' => true]]);
        $this->assertTrue($cfg->viewerFiltersAllowed);
    }

    public function test_search_enabled_defaults_true(): void
    {
        $cfg = PublicListConfig::fromListSettings(['public' => ['enabled' => true]]);
        $this->assertTrue($cfg->searchEnabled);
    }

    public function test_disabled_factory_returns_safe_config(): void
    {
        $cfg = PublicListConfig::disabled();
        $this->assertFalse($cfg->enabled);
        $this->assertFalse($cfg->viewerFiltersAllowed);
        $this->assertFalse($cfg->searchEnabled);
        $this->assertSame([], $cfg->visibleFieldSlugs);
    }

    public function test_toArray_roundtrip(): void
    {
        $input = [
            'enabled'                => true,
            'visible_field_slugs'    => ['a', 'b'],
            'fixed_filter_tree'      => ['type' => 'group', 'logic' => 'and', 'children' => []],
            'viewer_filters_allowed' => true,
            'sort_allowed_slugs'     => ['a'],
            'default_sort'           => 'a:desc',
            'per_page'               => 10,
            'search_enabled'         => true,
            'cache_ttl'              => 30,
            'permalink_base'         => 'mi-lista',
        ];
        $cfg = PublicListConfig::fromListSettings(['public' => $input]);
        // El roundtrip debe preservar todo el shape.
        $this->assertSame($input, $cfg->toArray());
    }

    // ───────────────────────────────────────────────────────────────────
    //  permalink_base (Fase 10 — pulidos)
    // ───────────────────────────────────────────────────────────────────

    public function test_permalink_base_null_by_default(): void
    {
        $cfg = PublicListConfig::fromListSettings(['public' => ['enabled' => true]]);
        $this->assertNull($cfg->permalinkBase);
    }

    public function test_permalink_base_sanitizes_input(): void
    {
        // Mayúsculas → lowercase, espacios y chars no permitidos → strip.
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'permalink_base' => 'Mi Lista Buena!'],
        ]);
        $this->assertSame('milistabuena', $cfg->permalinkBase);
    }

    public function test_permalink_base_keeps_hyphens(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'permalink_base' => 'mi-lista-2026'],
        ]);
        $this->assertSame('mi-lista-2026', $cfg->permalinkBase);
    }

    public function test_permalink_base_strips_leading_trailing_hyphens(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'permalink_base' => '--precios--'],
        ]);
        $this->assertSame('precios', $cfg->permalinkBase);
    }

    public function test_permalink_base_clamps_to_64_chars(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'permalink_base' => str_repeat('a', 100)],
        ]);
        $this->assertSame(64, strlen($cfg->permalinkBase ?? ''));
    }

    public function test_permalink_base_returns_null_for_empty_after_sanitize(): void
    {
        // Input lleno de chars inválidos → todos strip → null (no string vacío).
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'permalink_base' => '!!!@@@###'],
        ]);
        $this->assertNull($cfg->permalinkBase);
    }

    public function test_permalink_base_ignored_when_not_string(): void
    {
        $cfg = PublicListConfig::fromListSettings([
            'public' => ['enabled' => true, 'permalink_base' => 42],
        ]);
        $this->assertNull($cfg->permalinkBase);
    }
}
