<?php
declare(strict_types=1);

namespace ImaginaCRM\Records;

/**
 * DTO con los parámetros normalizados de una consulta de records.
 *
 * Existe para mantener `QueryBuilder::buildSelect()` con una firma
 * estable y para que la validación de inputs (operadores conocidos,
 * límites de paginación, máximo de filtros) ocurra en un único lugar.
 */
final class QueryParams
{
    public const MAX_FILTERS  = 5;
    public const MAX_PER_PAGE = 200;

    /**
     * @param array<int, array{column:string, operator:string, value:mixed}> $filters
     * @param array<int, array{column:string, direction:string}>             $sort
     * @param array<int, string>                                              $fields
     */
    public function __construct(
        public readonly int $page,
        public readonly int $perPage,
        public readonly array $filters,
        public readonly array $sort,
        public readonly array $fields,
        public readonly ?string $search,
        public readonly bool $includeDeleted,
    ) {
    }
}
