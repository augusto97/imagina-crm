<?php
declare(strict_types=1);

namespace ImaginaCRM\Tests\Unit\Records;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Records\QueryBuilder;
use ImaginaCRM\Records\QueryParams;
use ImaginaCRM\Support\Database;
use ImaginaCRM\Support\ValidationResult;
use ImaginaCRM\Tests\Unit\Stubs\FakeWpdb;
use ImaginaCRM\Tests\Unit\Stubs\StubSlugManager;
use PHPUnit\Framework\TestCase;

/**
 * Tests del compilador de SELECT/COUNT.
 *
 * Cubrimos: whitelist (slugs/columnas desconocidas se descartan), parsing
 * de operadores, search-only-on-text, paginación, filtro IN, redirección
 * por slug histórico (vía `StubSlugManager`).
 */
final class QueryBuilderTest extends TestCase
{
    private FakeWpdb $wpdb;
    private QueryBuilder $qb;
    private StubSlugManager $slugs;

    protected function setUp(): void
    {
        $this->wpdb  = new FakeWpdb();
        $this->slugs = new StubSlugManager();
        $this->qb    = new QueryBuilder(new Database($this->wpdb), $this->slugs);
    }

    public function test_normalize_drops_unknown_slugs_and_keeps_known(): void
    {
        $fields = $this->sampleFields();
        $params = $this->qb->normalize(
            listId: 7,
            fields: $fields,
            rawFilters: [
                'name' => ['contains' => 'acme'],
                'unknown_slug' => ['eq' => 'x'], // debe descartarse
            ],
            rawSort: [['slug' => 'name', 'dir' => 'asc']],
            rawFields: ['name'],
            search: null,
            page: 1,
            perPage: 50,
            includeDeleted: false,
        );

        $this->assertInstanceOf(QueryParams::class, $params);
        $this->assertCount(1, $params->filters);
        $this->assertSame('col_name', $params->filters[0]['column']);
    }

    public function test_normalize_caps_per_page_and_minimum_page(): void
    {
        $params = $this->qb->normalize(
            listId: 1,
            fields: [],
            rawFilters: [],
            rawSort: [],
            rawFields: [],
            search: null,
            page: 0,
            perPage: 9999,
            includeDeleted: false,
        );

        $this->assertInstanceOf(QueryParams::class, $params);
        $this->assertSame(1, $params->page);
        $this->assertSame(QueryParams::MAX_PER_PAGE, $params->perPage);
    }

    public function test_normalize_returns_validation_when_too_many_filters(): void
    {
        $fields = $this->sampleFields();
        // Generamos 6 filtros sobre el mismo slug válido → debe excederse el cap.
        $rawFilters = [];
        for ($i = 0; $i < 6; $i++) {
            $rawFilters['name'][] = ['eq' => 'x' . $i];
        }
        // Truco: el caller pasaría [slug => [op => val]] para varios; aquí
        // armamos varios slugs distintos válidos.
        $rawFilters = [
            'name'   => ['contains' => 'a'],
            'amount' => ['gte' => 1, 'lte' => 99, 'neq' => 0, 'gt' => -5, 'lt' => 1000],
            // total: 6 operadores
        ];

        $result = $this->qb->normalize(1, $fields, $rawFilters, [], [], null, 1, 50, false);
        $this->assertInstanceOf(ValidationResult::class, $result);
    }

    public function test_buildSelect_uses_only_whitelisted_columns(): void
    {
        $fields = $this->sampleFields();
        $params = new QueryParams(
            page: 1, perPage: 50,
            filters: [
                ['column' => 'col_name', 'operator' => 'eq', 'value' => 'Acme'],
                ['column' => 'malicious; DROP TABLE x', 'operator' => 'eq', 'value' => 'pwn'],
            ],
            sort: [['column' => 'col_name', 'direction' => 'ASC']],
            fields: [],
            search: null,
            includeDeleted: false,
        );

        $compiled = $this->qb->buildSelect('clients', $fields, $params);

        // El filtro malicioso fue descartado (no aparece en SQL).
        $this->assertStringNotContainsString('malicious', $compiled['sql']);
        $this->assertStringContainsString('`col_name`', $compiled['sql']);
        $this->assertStringContainsString('deleted_at IS NULL', $compiled['sql']);
        $this->assertStringContainsString('ORDER BY `col_name` ASC', $compiled['sql']);
        $this->assertStringContainsString('LIMIT %d OFFSET %d', $compiled['sql']);
    }

    public function test_buildSelect_in_operator_emits_multiple_placeholders(): void
    {
        $fields = $this->sampleFields();
        $params = new QueryParams(
            page: 1, perPage: 50,
            filters: [['column' => 'col_status', 'operator' => 'in', 'value' => ['active', 'pending']]],
            sort: [], fields: [], search: null, includeDeleted: false,
        );
        $compiled = $this->qb->buildSelect('clients', $fields, $params);

        $this->assertStringContainsString('`col_status` IN (%s, %s)', $compiled['sql']);
        // args: [val1, val2, perPage, offset]
        $this->assertSame(['active', 'pending', 50, 0], $compiled['args']);
    }

    public function test_buildSelect_contains_uses_like_with_wildcards(): void
    {
        $fields = $this->sampleFields();
        $params = new QueryParams(
            page: 1, perPage: 25,
            filters: [['column' => 'col_name', 'operator' => 'contains', 'value' => 'co_op']],
            sort: [], fields: [], search: null, includeDeleted: false,
        );
        $compiled = $this->qb->buildSelect('clients', $fields, $params);

        $this->assertStringContainsString('`col_name` LIKE %s', $compiled['sql']);
        // FakeWpdb.esc_like escapa _, %, \.
        $this->assertSame(['%co\_op%', 25, 0], $compiled['args']);
    }

    public function test_buildSelect_search_only_targets_text_like_columns(): void
    {
        $fields = $this->sampleFields();
        $params = new QueryParams(
            page: 1, perPage: 10,
            filters: [],
            sort: [], fields: [], search: 'foo', includeDeleted: false,
        );
        $compiled = $this->qb->buildSelect('clients', $fields, $params);

        // Solo `col_name` (text) debería entrar al search; `col_amount` (number) no.
        $this->assertStringContainsString('`col_name` LIKE %s', $compiled['sql']);
        $this->assertStringNotContainsString('`col_amount` LIKE', $compiled['sql']);
    }

    public function test_buildSelect_resolves_legacy_slug_via_history(): void
    {
        $fields = $this->sampleFields();
        $this->slugs->resolutions = ['old_name' => 'name']; // old_name → name (current)

        $params = $this->qb->normalize(
            listId: 1,
            fields: $fields,
            rawFilters: ['old_name' => ['eq' => 'Acme']],
            rawSort: [],
            rawFields: [],
            search: null,
            page: 1, perPage: 10, includeDeleted: false,
        );

        $this->assertInstanceOf(QueryParams::class, $params);
        $this->assertCount(1, $params->filters);
        $this->assertSame('col_name', $params->filters[0]['column']);
    }

    public function test_buildSelect_relation_field_is_not_included(): void
    {
        $fields   = $this->sampleFields();
        $fields[] = new FieldEntity(
            id: 99, listId: 1, slug: 'related', columnName: 'col_related',
            label: 'Related', type: 'relation', config: [],
            isRequired: false, isUnique: false, isPrimary: false,
            position: 99, createdAt: '', updatedAt: '', deletedAt: null,
        );

        $params = new QueryParams(
            page: 1, perPage: 10, filters: [],
            sort: [], fields: [], search: null, includeDeleted: false,
        );
        $compiled = $this->qb->buildSelect('clients', $fields, $params);

        // La columna del relation NO debe aparecer en SELECT.
        $this->assertStringNotContainsString('col_related', $compiled['sql']);
    }

    public function test_buildSelect_field_id_reference_resolves(): void
    {
        $fields = $this->sampleFields();
        $params = $this->qb->normalize(
            listId: 1,
            fields: $fields,
            rawFilters: ['field_2' => ['gte' => 100]],
            rawSort: [],
            rawFields: [],
            search: null,
            page: 1, perPage: 10, includeDeleted: false,
        );

        $this->assertInstanceOf(QueryParams::class, $params);
        $this->assertSame('col_amount', $params->filters[0]['column']);
        $this->assertSame('gte', $params->filters[0]['operator']);
    }

    public function test_buildSelect_with_explicit_projection_only_selects_those_plus_base(): void
    {
        $fields = $this->sampleFields();
        $params = new QueryParams(
            page: 1, perPage: 10,
            filters: [],
            sort: [],
            fields: ['col_name'],
            search: null, includeDeleted: false,
        );
        $compiled = $this->qb->buildSelect('clients', $fields, $params);

        $this->assertStringContainsString('`col_name`', $compiled['sql']);
        $this->assertStringContainsString('`id`', $compiled['sql']);
        // No debe seleccionar col_amount o col_status.
        $this->assertStringNotContainsString('`col_amount`', $compiled['sql']);
        $this->assertStringNotContainsString('`col_status`', $compiled['sql']);
    }

    public function test_buildGroupQuery_scalar_field_uses_group_by_with_nullif(): void
    {
        $fields = $this->sampleFields();
        $statusField = $fields[2]; // 'status' (select)
        $params = $this->qb->normalize(
            1, $fields, [], [], [], null, 1, 50, false,
        );
        $this->assertInstanceOf(QueryParams::class, $params);

        $compiled = $this->qb->buildGroupQuery('clients', $fields, $statusField, $params);

        // Trata '' como NULL para no producir buckets duplicados.
        $this->assertStringContainsString("NULLIF(`col_status`, '')", $compiled['sql']);
        $this->assertStringContainsString('GROUP BY', $compiled['sql']);
        $this->assertStringContainsString('group_count DESC', $compiled['sql']);
        // Excluye soft-deleted.
        $this->assertStringContainsString('deleted_at IS NULL', $compiled['sql']);
    }

    public function test_buildGroupQuery_multi_select_uses_json_table_unnest(): void
    {
        $fields = [
            new FieldEntity(
                id: 1, listId: 1, slug: 'tags', columnName: 'col_tags',
                label: 'Tags', type: 'multi_select', config: ['options' => []],
                isRequired: false, isUnique: false, isPrimary: false,
                position: 0, createdAt: '', updatedAt: '', deletedAt: null,
            ),
        ];
        $params = $this->qb->normalize(1, $fields, [], [], [], null, 1, 50, false);
        $this->assertInstanceOf(QueryParams::class, $params);

        $compiled = $this->qb->buildGroupQuery('clients', $fields, $fields[0], $params);

        $this->assertStringContainsString('JSON_TABLE', $compiled['sql']);
        // Bucket NULL: registros con array vacío o columna NULL.
        $this->assertStringContainsString("`col_tags` IS NULL OR `col_tags` = '[]'", $compiled['sql']);
        // UNION ALL combinando ambos buckets.
        $this->assertStringContainsString('UNION ALL', $compiled['sql']);
    }

    public function test_buildGroupQuery_respects_active_filters(): void
    {
        $fields = $this->sampleFields();
        $statusField = $fields[2];
        // Filtramos por amount > 100; los buckets reflejan solo esos.
        $params = $this->qb->normalize(
            1, $fields, ['amount' => ['gt' => 100]], [], [], null, 1, 50, false,
        );
        $this->assertInstanceOf(QueryParams::class, $params);

        $compiled = $this->qb->buildGroupQuery('clients', $fields, $statusField, $params);

        $this->assertStringContainsString('`col_amount` >', $compiled['sql']);
        // El placeholder ya está embebido por buildWhere.
        $this->assertNotEmpty($compiled['args']);
    }

    public function test_buildGroupQuery_orders_null_bucket_last(): void
    {
        $fields = $this->sampleFields();
        $statusField = $fields[2];
        $params = $this->qb->normalize(1, $fields, [], [], [], null, 1, 50, false);
        $this->assertInstanceOf(QueryParams::class, $params);

        $compiled = $this->qb->buildGroupQuery('clients', $fields, $statusField, $params);

        // El ORDER BY incluye `(group_value IS NULL) ASC` para empujar
        // el bucket "(Sin valor)" al final independiente del count.
        $this->assertStringContainsString('group_value IS NULL', $compiled['sql']);
    }

    /**
     * @return array<int, FieldEntity>
     */
    private function sampleFields(): array
    {
        return [
            new FieldEntity(
                id: 1, listId: 1, slug: 'name', columnName: 'col_name',
                label: 'Nombre', type: 'text', config: ['max_length' => 255],
                isRequired: true, isUnique: false, isPrimary: true,
                position: 0, createdAt: '', updatedAt: '', deletedAt: null,
            ),
            new FieldEntity(
                id: 2, listId: 1, slug: 'amount', columnName: 'col_amount',
                label: 'Monto', type: 'number', config: ['precision' => 2],
                isRequired: false, isUnique: false, isPrimary: false,
                position: 1, createdAt: '', updatedAt: '', deletedAt: null,
            ),
            new FieldEntity(
                id: 3, listId: 1, slug: 'status', columnName: 'col_status',
                label: 'Estado', type: 'select', config: [
                    'options' => [['value' => 'active'], ['value' => 'pending']],
                ],
                isRequired: false, isUnique: false, isPrimary: false,
                position: 2, createdAt: '', updatedAt: '', deletedAt: null,
            ),
        ];
    }
}
