<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Integration\Lists;

use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\SlugContext;
use ImaginaCRM\Tests\Integration\IntegrationTestCase;

/**
 * Cobertura de los caminos del `SlugManager` que tocan BD:
 *
 * - `generateUnique`: colisiones se resuelven con sufijo `_2`, `_3`…
 * - `validate` con unicidad real consultando BD.
 * - `rename` que persiste y registra entrada en `slug_history`.
 * - `resolveCurrentSlug` que sigue el historial — incluyendo el caso
 *   ambiguo (un slug viejo que apunta a varios actuales) que debe
 *   devolver `null`.
 */
final class SlugManagerTest extends IntegrationTestCase
{
    private SlugManager $slugs;
    private ListService $lists;

    protected function setUp(): void
    {
        parent::setUp();
        $this->slugs = new SlugManager($this->db());
        $this->lists = new ListService(
            new ListRepository($this->db()),
            $this->slugs,
            $this->schema,
        );
    }

    public function test_generateUnique_returns_base_when_free(): void
    {
        $name = $this->slugs->generateUnique('Mi Lista', 'table_suffix');
        $this->assertSame('mi_lista', $name);
    }

    public function test_generateUnique_appends_suffix_on_collision(): void
    {
        $a = $this->lists->create(['name' => 'Clientes']);
        $this->assertNotInstanceOf(\ImaginaCRM\Support\ValidationResult::class, $a);

        // Forzamos colisión pidiendo de nuevo el mismo `table_suffix`.
        $candidate = $this->slugs->generateUnique('clientes', 'table_suffix');
        $this->assertSame('clientes_2', $candidate);
    }

    public function test_validate_detects_existing_slug_unique_per_list(): void
    {
        $list = $this->lists->create(['name' => 'Clientes']);
        $this->assertIsObject($list);
        /** @var \ImaginaCRM\Lists\ListEntity $list */

        // Otro slug nuevo está disponible.
        $this->assertTrue(
            $this->slugs->validate('proyectos', SlugContext::List_)->isValid(),
        );
        // El slug ya tomado falla.
        $this->assertFalse(
            $this->slugs->validate($list->slug, SlugContext::List_)->isValid(),
        );
        // Excluyendo el ID del propio dueño, vuelve a estar disponible (caso edición).
        $this->assertTrue(
            $this->slugs->validate($list->slug, SlugContext::List_, null, $list->id)->isValid(),
        );
    }

    public function test_rename_writes_history_and_resolves_old_slug(): void
    {
        $list = $this->lists->create(['name' => 'Clientes', 'slug' => 'clientes']);
        $this->assertIsObject($list);
        /** @var \ImaginaCRM\Lists\ListEntity $list */

        $result = $this->slugs->rename(SlugContext::List_, $list->id, 'clientes_anuales');
        $this->assertTrue($result->success);
        $this->assertSame('clientes', $result->oldSlug);
        $this->assertSame('clientes_anuales', $result->newSlug);

        // Historial.
        $history = $this->slugs->getHistory(SlugContext::List_, $list->id);
        $this->assertCount(1, $history);
        $this->assertSame('clientes', $history[0]['old_slug']);
        $this->assertSame('clientes_anuales', $history[0]['new_slug']);

        // resolveCurrentSlug sigue el redirect.
        $resolved = $this->slugs->resolveCurrentSlug(SlugContext::List_, 'clientes');
        $this->assertSame('clientes_anuales', $resolved);

        // El slug actual también se resuelve a sí mismo.
        $resolvedCurrent = $this->slugs->resolveCurrentSlug(SlugContext::List_, 'clientes_anuales');
        $this->assertSame('clientes_anuales', $resolvedCurrent);
    }

    public function test_rename_unchanged_returns_unchanged_without_history(): void
    {
        $list = $this->lists->create(['name' => 'Tareas', 'slug' => 'tareas']);
        $this->assertIsObject($list);
        /** @var \ImaginaCRM\Lists\ListEntity $list */

        $result = $this->slugs->rename(SlugContext::List_, $list->id, 'tareas');
        $this->assertTrue($result->success);
        $this->assertSame('tareas', $result->oldSlug);
        $this->assertSame('tareas', $result->newSlug);
        $this->assertCount(0, $this->slugs->getHistory(SlugContext::List_, $list->id));
    }

    public function test_resolveCurrentSlug_returns_null_on_ambiguity(): void
    {
        // Creamos dos listas y simulamos que ambas tuvieron en algún momento
        // el slug "clientes" como ANTERIOR. Esto representa el caso en que el
        // mismo slug viejo apunta a dos slugs nuevos — debe devolver null
        // (HTTP 409 según CLAUDE.md §7.6).
        $a = $this->lists->create(['name' => 'Clientes A', 'slug' => 'clientes_a']);
        $b = $this->lists->create(['name' => 'Clientes B', 'slug' => 'clientes_b']);
        $this->assertIsObject($a);
        $this->assertIsObject($b);
        /** @var \ImaginaCRM\Lists\ListEntity $a */
        /** @var \ImaginaCRM\Lists\ListEntity $b */

        $now = current_time('mysql', true);
        // Insertamos manualmente entradas históricas que generan ambigüedad.
        $this->wpdb->insert(
            $this->db()->systemTable('slug_history'),
            [
                'entity_type' => 'list',
                'entity_id'   => $a->id,
                'old_slug'    => 'clientes',
                'new_slug'    => 'clientes_a',
                'changed_by'  => 1,
                'changed_at'  => $now,
            ],
            ['%s', '%d', '%s', '%s', '%d', '%s'],
        );
        $this->wpdb->insert(
            $this->db()->systemTable('slug_history'),
            [
                'entity_type' => 'list',
                'entity_id'   => $b->id,
                'old_slug'    => 'clientes',
                'new_slug'    => 'clientes_b',
                'changed_by'  => 1,
                'changed_at'  => $now,
            ],
            ['%s', '%d', '%s', '%s', '%d', '%s'],
        );

        $resolved = $this->slugs->resolveCurrentSlug(SlugContext::List_, 'clientes');
        $this->assertNull($resolved, 'Ambiguous old_slug must return null.');
    }

    public function test_rename_validates_format_and_reserved(): void
    {
        $list = $this->lists->create(['name' => 'Tareas']);
        $this->assertIsObject($list);
        /** @var \ImaginaCRM\Lists\ListEntity $list */

        // Reservado.
        $r = $this->slugs->rename(SlugContext::List_, $list->id, 'admin');
        $this->assertFalse($r->success);

        // Mal formato.
        $r = $this->slugs->rename(SlugContext::List_, $list->id, 'Has-Hyphens');
        $this->assertFalse($r->success);

        // El slug original sigue intacto.
        $reloaded = $this->lists->findByIdOrSlug((string) $list->id);
        $this->assertNotNull($reloaded);
        $this->assertSame($list->slug, $reloaded->slug);
    }
}
