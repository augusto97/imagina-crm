<?php
declare(strict_types=1);

namespace ImaginaCRM\Records;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\Database;
use ImaginaCRM\Support\SlugContext;
use ImaginaCRM\Support\ValidationResult;

/**
 * Traduce inputs de la API (filtros por slug, sort por slug, search) en SQL
 * seguro para la tabla dinámica de una lista.
 *
 * Reglas (CLAUDE.md §9.4, §12):
 *
 * - Whitelist estricta de columnas: cada referencia (slug o `field_<id>`)
 *   se resuelve a un `column_name` real consultando los `FieldEntity`
 *   pasados por el caller. Si no existe → la entrada se descarta.
 * - Slugs antiguos se siguen vía `SlugManager::resolveCurrentSlug()`.
 * - Identificadores se envuelven con backticks; valores van a
 *   `wpdb::prepare()`.
 * - Máximo `MAX_FILTERS` filtros activos por query.
 *
 * El caller es responsable de pasar los `fields` ya cargados (de modo que
 * `RecordService` los consulta una única vez por request).
 */
final class QueryBuilder
{
    /** @var array<int, string> */
    private const SCALAR_OPERATORS = [
        'eq', 'neq',
        'gt', 'gte', 'lt', 'lte',
        'contains', 'starts_with', 'ends_with',
        'in', 'nin',
        'is_null', 'is_not_null',
    ];

    /** @var array<int, string> */
    private const SEARCHABLE_TYPES = ['text', 'long_text', 'email', 'url'];

    /** @var array<int, string> Tipos que no admiten WHERE en la columna física. */
    private const NON_FILTERABLE_TYPES = ['relation'];

    /** @var array<int, string> */
    private const BASE_COLUMNS = ['id', 'created_by', 'created_at', 'updated_at', 'deleted_at'];

    public function __construct(
        private readonly Database $db,
        private readonly SlugManager $slugs,
    ) {
    }

    /**
     * @param array<int, FieldEntity>                    $fields  Campos vivos de la lista.
     * @param array<string, mixed>                       $rawFilters
     * @param array<int, array{slug:string, dir:string}> $rawSort
     * @param array<int, string>                         $rawFields
     */
    public function normalize(
        int $listId,
        array $fields,
        array $rawFilters,
        array $rawSort,
        array $rawFields,
        ?string $search,
        int $page,
        int $perPage,
        bool $includeDeleted,
    ): QueryParams|ValidationResult {
        $page    = max(1, $page);
        $perPage = max(1, min($perPage, QueryParams::MAX_PER_PAGE));

        $fieldsById = $this->indexById($fields);

        $filters = [];
        foreach ($rawFilters as $key => $value) {
            $column = $this->resolveColumn((string) $key, $listId, $fieldsById);
            if ($column === null) {
                continue;
            }

            if (is_array($value)) {
                foreach ($value as $op => $opValue) {
                    if (! is_string($op)) {
                        continue;
                    }
                    $filters[] = ['column' => $column, 'operator' => $op, 'value' => $opValue];
                }
            } else {
                $filters[] = ['column' => $column, 'operator' => 'eq', 'value' => $value];
            }
        }

        if (count($filters) > QueryParams::MAX_FILTERS) {
            return ValidationResult::failWith(
                'filters',
                sprintf(
                    /* translators: %d: max filters */
                    __('Máximo %d filtros por consulta.', 'imagina-crm'),
                    QueryParams::MAX_FILTERS
                )
            );
        }

        $sort = [];
        foreach ($rawSort as $entry) {
            $column = $this->resolveColumn($entry['slug'] ?? '', $listId, $fieldsById);
            if ($column === null) {
                continue;
            }
            $direction = strtolower($entry['dir'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';
            $sort[] = ['column' => $column, 'direction' => $direction];
        }

        $projection = [];
        foreach ($rawFields as $entry) {
            $column = $this->resolveColumn((string) $entry, $listId, $fieldsById);
            if ($column !== null) {
                $projection[] = $column;
            }
        }

        $search = $search !== null ? trim($search) : null;
        if ($search === '') {
            $search = null;
        }

        return new QueryParams(
            page: $page,
            perPage: $perPage,
            filters: $filters,
            sort: $sort,
            fields: $projection,
            search: $search,
            includeDeleted: $includeDeleted,
        );
    }

    /**
     * @param array<int, FieldEntity> $fields
     *
     * @return array{
     *     sql:string,
     *     args:array<int, mixed>,
     *     count_sql:string,
     *     count_args:array<int, mixed>
     * }
     */
    public function buildSelect(string $tableSuffix, array $fields, QueryParams $params): array
    {
        $table     = '`' . esc_sql($this->db->dataTable($tableSuffix)) . '`';
        $columnSet = $this->columnsByName($fields);

        $select = $this->buildSelectClause($params, $columnSet, $table);
        [$where, $whereArgs] = $this->buildWhere($params, $columnSet);

        $sql      = "SELECT {$select} FROM {$table} {$where}";
        $countSql = "SELECT COUNT(*) AS total FROM {$table} {$where}";

        if ($params->sort !== []) {
            $orderParts = [];
            foreach ($params->sort as $s) {
                if (! $this->isAllowedColumn($s['column'], $columnSet)) {
                    continue;
                }
                $orderParts[] = '`' . esc_sql($s['column']) . '` ' . $s['direction'];
            }
            if ($orderParts !== []) {
                $sql .= ' ORDER BY ' . implode(', ', $orderParts);
            }
        } else {
            $sql .= ' ORDER BY id DESC';
        }

        $offset = ($params->page - 1) * $params->perPage;
        $sql   .= ' LIMIT %d OFFSET %d';

        $args   = $whereArgs;
        $args[] = $params->perPage;
        $args[] = $offset;

        return [
            'sql'        => $sql,
            'args'       => $args,
            'count_sql'  => $countSql,
            'count_args' => $whereArgs,
        ];
    }

    /**
     * @param array<string, FieldEntity> $columnSet
     */
    private function buildSelectClause(QueryParams $params, array $columnSet, string $table): string
    {
        if ($params->fields === []) {
            $cols = self::BASE_COLUMNS;
            foreach ($columnSet as $name => $_field) {
                $cols[] = $name;
            }
        } else {
            $cols = array_unique(array_merge(self::BASE_COLUMNS, $params->fields));
        }

        $parts = [];
        foreach ($cols as $col) {
            $parts[] = $table . '.`' . esc_sql($col) . '`';
        }
        return implode(', ', $parts);
    }

    /**
     * @param array<string, FieldEntity> $columnSet
     *
     * @return array{0:string, 1:array<int,mixed>}
     */
    private function buildWhere(QueryParams $params, array $columnSet): array
    {
        $clauses = [];
        $args    = [];

        if (! $params->includeDeleted) {
            $clauses[] = 'deleted_at IS NULL';
        }

        foreach ($params->filters as $filter) {
            if (! $this->isAllowedColumn($filter['column'], $columnSet)) {
                continue;
            }
            $field = $columnSet[$filter['column']] ?? null;
            if ($field !== null && in_array($field->type, self::NON_FILTERABLE_TYPES, true)) {
                continue;
            }

            $compiled = $this->compileFilter($filter['column'], $filter['operator'], $filter['value'], $field);
            if ($compiled === null) {
                continue;
            }
            $clauses[] = $compiled['sql'];
            foreach ($compiled['args'] as $arg) {
                $args[] = $arg;
            }
        }

        if ($params->search !== null) {
            $searchClauses = [];
            foreach ($columnSet as $name => $field) {
                if (! in_array($field->type, self::SEARCHABLE_TYPES, true)) {
                    continue;
                }
                $searchClauses[] = '`' . esc_sql($name) . '` LIKE %s';
                $args[]          = '%' . $this->escLike($params->search) . '%';
            }
            if ($searchClauses !== []) {
                $clauses[] = '(' . implode(' OR ', $searchClauses) . ')';
            } else {
                $clauses[] = '1 = 0';
            }
        }

        if ($clauses === []) {
            return ['', []];
        }
        return ['WHERE ' . implode(' AND ', $clauses), $args];
    }

    /**
     * @return array{sql:string, args:array<int,mixed>}|null
     */
    private function compileFilter(string $column, string $operator, mixed $value, ?FieldEntity $field): ?array
    {
        $operator = strtolower($operator);
        if (! in_array($operator, self::SCALAR_OPERATORS, true)) {
            return null;
        }

        $col   = '`' . esc_sql($column) . '`';

        // multi_select: la columna almacena JSON arrays
        // (ej. ["elementor_pro","crocoblock"]). Comparar con `=`
        // nunca matchearía una opción individual. Usamos
        // JSON_CONTAINS para eq/neq/contains y JSON_OVERLAPS para
        // in/nin. Esto es lo que el usuario espera al filtrar.
        if ($field !== null && $field->type === 'multi_select') {
            return $this->compileMultiSelectFilter($col, $operator, $value);
        }

        $place = $field !== null ? $this->placeholder($field) : '%s';
        $cast  = $field !== null
            ? $this->castFilter($field, $value)
            : (is_scalar($value) ? (string) $value : '');

        return match ($operator) {
            'eq'  => ['sql' => "{$col} = {$place}",  'args' => [$cast]],
            'neq' => ['sql' => "{$col} <> {$place}", 'args' => [$cast]],
            'gt'  => ['sql' => "{$col} > {$place}",  'args' => [$cast]],
            'gte' => ['sql' => "{$col} >= {$place}", 'args' => [$cast]],
            'lt'  => ['sql' => "{$col} < {$place}",  'args' => [$cast]],
            'lte' => ['sql' => "{$col} <= {$place}", 'args' => [$cast]],
            'contains'    => ['sql' => "{$col} LIKE %s", 'args' => ['%' . $this->escLike((string) $value) . '%']],
            'starts_with' => ['sql' => "{$col} LIKE %s", 'args' => [$this->escLike((string) $value) . '%']],
            'ends_with'   => ['sql' => "{$col} LIKE %s", 'args' => ['%' . $this->escLike((string) $value)]],
            'in'  => $this->compileInClause($col, $value, $field, false),
            'nin' => $this->compileInClause($col, $value, $field, true),
            'is_null'     => ['sql' => "{$col} IS NULL", 'args' => []],
            'is_not_null' => ['sql' => "{$col} IS NOT NULL", 'args' => []],
        };
    }

    /**
     * Filtros sobre columnas multi_select (JSON arrays). Mapeo:
     *  - eq / contains  → JSON_CONTAINS(col, JSON_QUOTE(value))
     *  - neq            → NOT JSON_CONTAINS(...)
     *  - in             → JSON_OVERLAPS(col, JSON_ARRAY(v1, v2, ...))
     *  - nin            → NOT JSON_OVERLAPS(...)
     *  - is_null / is_not_null → mismas
     *  - starts_with / ends_with → no aplica, retorna null
     *
     * @return array{sql:string, args:array<int,mixed>}|null
     */
    private function compileMultiSelectFilter(string $col, string $operator, mixed $value): ?array
    {
        if ($operator === 'is_null') {
            // multi_select se considera null si la columna es NULL O si
            // contiene un array vacío []. Ambos casos son "sin valor"
            // desde la perspectiva del usuario.
            return [
                'sql'  => "({$col} IS NULL OR {$col} = '[]')",
                'args' => [],
            ];
        }
        if ($operator === 'is_not_null') {
            return [
                'sql'  => "({$col} IS NOT NULL AND {$col} <> '[]')",
                'args' => [],
            ];
        }

        if ($operator === 'eq' || $operator === 'contains' || $operator === 'neq') {
            $needle = is_scalar($value) ? (string) $value : '';
            if ($needle === '') {
                return null;
            }
            $negate = $operator === 'neq';
            // JSON_QUOTE(?) → "valor" con escapes JSON. JSON_CONTAINS
            // verifica membership en el array. Para `neq` también
            // incluimos NULL: un registro sin valor "no contiene"
            // ningún ítem específico desde la perspectiva del usuario.
            return [
                'sql'  => $negate
                    ? "({$col} IS NULL OR NOT JSON_CONTAINS({$col}, JSON_QUOTE(%s)))"
                    : "JSON_CONTAINS({$col}, JSON_QUOTE(%s))",
                'args' => [$needle],
            ];
        }

        if ($operator === 'in' || $operator === 'nin') {
            $values = is_array($value) ? $value : [$value];
            $values = array_values(array_filter(
                array_map(static fn ($v) => is_scalar($v) ? (string) $v : '', $values),
                static fn (string $v): bool => $v !== '',
            ));
            if ($values === []) {
                return null;
            }
            $negate = $operator === 'nin';
            // JSON_ARRAY(?, ?, ?) construye un array JSON literal a
            // partir de strings PHP — auto-quotea cada uno (no usar
            // JSON_QUOTE adentro o se duplica el quoting).
            $placeholders = array_fill(0, count($values), '%s');
            $body = "JSON_OVERLAPS({$col}, JSON_ARRAY(" . implode(', ', $placeholders) . '))';
            return [
                'sql'  => $negate
                    ? "({$col} IS NULL OR NOT {$body})"
                    : $body,
                'args' => $values,
            ];
        }

        // gt/gte/lt/lte/starts_with/ends_with no tienen semántica
        // útil para multi_select. Devolvemos null para que el
        // QueryBuilder skipee este filtro (mejor que un ERROR del
        // usuario por uno mal armado).
        return null;
    }

    /**
     * @return array{sql:string, args:array<int,mixed>}|null
     */
    private function compileInClause(string $col, mixed $value, ?FieldEntity $field, bool $negate): ?array
    {
        $values = is_array($value) ? $value : [$value];
        if ($values === []) {
            return null;
        }
        $placeholders = [];
        $args         = [];
        foreach ($values as $v) {
            $placeholders[] = $field !== null ? $this->placeholder($field) : '%s';
            $args[]         = $field !== null ? $this->castFilter($field, $v) : (is_scalar($v) ? (string) $v : '');
        }
        $op = $negate ? 'NOT IN' : 'IN';
        return [
            'sql'  => "{$col} {$op} (" . implode(', ', $placeholders) . ')',
            'args' => $args,
        ];
    }

    private function placeholder(FieldEntity $field): string
    {
        return match ($field->type) {
            'number'   => $this->numberPlaceholder($field),
            'currency' => '%f',
            'checkbox', 'user', 'file' => '%d',
            default    => '%s',
        };
    }

    private function numberPlaceholder(FieldEntity $field): string
    {
        $precision = isset($field->config['precision']) ? (int) $field->config['precision'] : 4;
        return $precision <= 0 ? '%d' : '%f';
    }

    private function castFilter(FieldEntity $field, mixed $value): mixed
    {
        return match ($field->type) {
            'checkbox', 'user', 'file' => is_numeric($value) ? (int) $value : 0,
            'number'   => $this->numberPlaceholder($field) === '%d' ? (int) $value : (float) $value,
            'currency' => is_numeric($value) ? (float) $value : 0.0,
            default    => is_scalar($value) ? (string) $value : '',
        };
    }

    /**
     * @param array<int, FieldEntity> $fields
     * @return array<int, FieldEntity>
     */
    private function indexById(array $fields): array
    {
        $map = [];
        foreach ($fields as $f) {
            $map[$f->id] = $f;
        }
        return $map;
    }

    /**
     * @param array<int, FieldEntity> $fields
     * @return array<string, FieldEntity>
     */
    private function columnsByName(array $fields): array
    {
        $set = [];
        foreach ($fields as $f) {
            if (in_array($f->type, self::NON_FILTERABLE_TYPES, true)) {
                continue;
            }
            $set[$f->columnName] = $f;
        }
        return $set;
    }

    /**
     * @param array<string, FieldEntity> $columnSet
     */
    private function isAllowedColumn(string $name, array $columnSet): bool
    {
        return isset($columnSet[$name]) || in_array($name, self::BASE_COLUMNS, true);
    }

    /**
     * @param array<int, FieldEntity> $fieldsById
     */
    private function resolveColumn(string $reference, int $listId, array $fieldsById): ?string
    {
        $reference = trim($reference);
        if ($reference === '') {
            return null;
        }

        if (in_array($reference, self::BASE_COLUMNS, true)) {
            return $reference;
        }

        if (str_starts_with($reference, 'field_')) {
            $fieldId = (int) substr($reference, 6);
            return isset($fieldsById[$fieldId]) ? $fieldsById[$fieldId]->columnName : null;
        }

        foreach ($fieldsById as $f) {
            if ($f->columnName === $reference) {
                return $f->columnName;
            }
        }

        foreach ($fieldsById as $f) {
            if ($f->slug === $reference) {
                return $f->columnName;
            }
        }

        $resolved = $this->slugs->resolveCurrentSlug(SlugContext::Field, $reference, $listId);
        if ($resolved !== null) {
            foreach ($fieldsById as $f) {
                if ($f->slug === $resolved) {
                    return $f->columnName;
                }
            }
        }
        return null;
    }

    private function escLike(string $value): string
    {
        return $this->db->wpdb()->esc_like($value);
    }
}
