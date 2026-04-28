<?php
declare(strict_types=1);

namespace ImaginaCRM\Records;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Support\ValidationResult;

/**
 * Casos de uso de records.
 *
 * Orquesta `RecordValidator`, `RecordRepository`, `RelationRepository` y
 * `QueryBuilder`. Garantiza que los `relation` fields se persisten en
 * `wp_imcrm_relations` y NO en la tabla dinámica.
 */
final class RecordService
{
    public function __construct(
        private readonly FieldRepository $fields,
        private readonly RecordRepository $records,
        private readonly RelationRepository $relations,
        private readonly RecordValidator $validator,
        private readonly QueryBuilder $queryBuilder,
    ) {
    }

    /**
     * Lista paginada con filtros/sort/search.
     *
     * @param array<string, mixed>                       $filters
     * @param array<int, array{slug:string, dir:string}> $sort
     * @param array<int, string>                         $fields
     *
     * @return array{
     *     data: array<int, array<string, mixed>>,
     *     meta: array{page:int, per_page:int, total:int, total_pages:int}
     * }|ValidationResult
     */
    public function list(
        ListEntity $list,
        array $filters,
        array $sort,
        array $fields,
        ?string $search,
        int $page,
        int $perPage,
    ): array|ValidationResult {
        $listFields = $this->fields->allForList($list->id);

        $params = $this->queryBuilder->normalize(
            $list->id,
            $listFields,
            $filters,
            $sort,
            $fields,
            $search,
            $page,
            $perPage,
            includeDeleted: false,
        );

        if ($params instanceof ValidationResult) {
            return $params;
        }

        $compiled = $this->queryBuilder->buildSelect($list->tableSuffix, $listFields, $params);
        $result   = $this->records->executeQuery(
            $compiled['sql'],
            $compiled['args'],
            $compiled['count_sql'],
            $compiled['count_args'],
        );

        $hydrated = array_map(
            fn (array $row): array => $this->hydrate($listFields, $row),
            $result['rows']
        );

        $hydrated = $this->attachRelations($listFields, $hydrated);

        $total = $result['total'];
        return [
            'data' => $hydrated,
            'meta' => [
                'page'        => $params->page,
                'per_page'    => $params->perPage,
                'total'       => $total,
                'total_pages' => $params->perPage > 0 ? (int) ceil($total / $params->perPage) : 1,
            ],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(ListEntity $list, int $recordId): ?array
    {
        $row = $this->records->find($list->tableSuffix, $recordId);
        if ($row === null) {
            return null;
        }

        $listFields = $this->fields->allForList($list->id);
        $hydrated   = $this->hydrate($listFields, $row);

        $withRelations = $this->attachRelations($listFields, [$hydrated]);
        return $withRelations[0] ?? $hydrated;
    }

    /**
     * @param array<string, mixed> $values [slug => value]
     *
     * @return array<string, mixed>|ValidationResult
     */
    public function create(ListEntity $list, array $values): array|ValidationResult
    {
        $listFields = $this->fields->allForList($list->id);

        $validation = $this->validator->validate($listFields, $values, partial: false);
        if (! $validation->isValid()) {
            return $validation;
        }

        $row = $this->validator->buildRow($listFields, $values);

        $id = $this->records->insert($list->tableSuffix, $row);
        if ($id === 0) {
            return ValidationResult::failWith('database', __('No se pudo crear el record.', 'imagina-crm'));
        }

        $this->syncRelationsFromValues($list, $listFields, $id, $values);

        $created = $this->find($list, $id);

        // Disparamos con el record hidratado para que las automatizaciones
        // tengan acceso a `{fields: {slug: value}, relations: {…}, …}`
        // — las acciones como UpdateFieldAction lo necesitan así.
        do_action('imagina_crm/record_created', $list, $id, $created ?? [], $values);
        if ($created === null) {
            return ValidationResult::failWith('database', __('El record se creó pero no se pudo leer.', 'imagina-crm'));
        }
        return $created;
    }

    /**
     * @param array<string, mixed> $values
     *
     * @return array<string, mixed>|ValidationResult
     */
    public function update(ListEntity $list, int $recordId, array $values): array|ValidationResult
    {
        $existing = $this->records->find($list->tableSuffix, $recordId);
        if ($existing === null) {
            return ValidationResult::failWith('id', __('El record no existe.', 'imagina-crm'));
        }

        $listFields = $this->fields->allForList($list->id);

        // Snapshot previo hidratado (con `{id, fields, relations, ...}`)
        // para que las automatizaciones puedan comparar diff antes/después.
        $previousRecord = $this->find($list, $recordId);

        $validation = $this->validator->validate($listFields, $values, partial: true);
        if (! $validation->isValid()) {
            return $validation;
        }

        $row = $this->validator->buildRow($listFields, $values);
        if ($row !== []) {
            $ok = $this->records->update($list->tableSuffix, $recordId, $row);
            if (! $ok) {
                return ValidationResult::failWith('database', __('No se pudo actualizar el record.', 'imagina-crm'));
            }
        }

        $this->syncRelationsFromValues($list, $listFields, $recordId, $values, partial: true);

        $updated = $this->find($list, $recordId);
        do_action('imagina_crm/record_updated', $list, $recordId, $updated ?? [], $previousRecord);

        if ($updated === null) {
            return ValidationResult::failWith('database', __('No se pudo releer el record.', 'imagina-crm'));
        }
        return $updated;
    }

    public function delete(ListEntity $list, int $recordId, bool $purge = false): ValidationResult
    {
        $existing = $this->records->find($list->tableSuffix, $recordId);
        if ($existing === null) {
            return ValidationResult::failWith('id', __('El record no existe.', 'imagina-crm'));
        }

        if ($purge) {
            $this->relations->deleteAllForRecord($recordId);
            $this->records->hardDelete($list->tableSuffix, $recordId);
        } else {
            $this->records->softDelete($list->tableSuffix, $recordId);
        }

        do_action('imagina_crm/record_deleted', $list, $recordId, $purge);
        return ValidationResult::ok();
    }

    /**
     * Aplica una operación bulk sobre múltiples records.
     *
     * @param string                               $action  'delete' | 'update'
     * @param array<int, int>                      $ids
     * @param array<string, mixed>                 $values  Solo para `update`.
     *
     * @return array{succeeded: array<int, int>, failed: array<int, array{id:int, message:string}>}
     */
    public function bulk(ListEntity $list, string $action, array $ids, array $values = []): array
    {
        $succeeded = [];
        $failed    = [];

        foreach ($ids as $rid) {
            $rid = (int) $rid;
            if ($rid <= 0) {
                continue;
            }
            $result = match ($action) {
                'delete' => $this->delete($list, $rid),
                'update' => $this->update($list, $rid, $values),
                default  => ValidationResult::failWith('action', __('Acción desconocida.', 'imagina-crm')),
            };

            if ($result instanceof ValidationResult) {
                if ($result->isValid()) {
                    $succeeded[] = $rid;
                } else {
                    $failed[] = ['id' => $rid, 'message' => $result->firstError() ?? ''];
                }
            } else {
                // update devuelve array
                $succeeded[] = $rid;
            }
        }

        return ['succeeded' => $succeeded, 'failed' => $failed];
    }

    /**
     * @param array<int, FieldEntity> $listFields
     * @param array<string, mixed>    $row Fila cruda.
     *
     * @return array<string, mixed>
     */
    private function hydrate(array $listFields, array $row): array
    {
        return [
            'id'         => (int) ($row['id'] ?? 0),
            'fields'     => $this->validator->hydrateRow($listFields, $row),
            'relations'  => [], // se llena en attachRelations
            'created_by' => (int) ($row['created_by'] ?? 0),
            'created_at' => (string) ($row['created_at'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    /**
     * @param array<int, FieldEntity>           $listFields
     * @param array<int, array<string, mixed>>  $records
     *
     * @return array<int, array<string, mixed>>
     */
    private function attachRelations(array $listFields, array $records): array
    {
        $relationFields = array_values(array_filter(
            $listFields,
            static fn (FieldEntity $f): bool => $f->type === 'relation'
        ));

        if ($relationFields === [] || $records === []) {
            return $records;
        }

        $recordIds = array_map(static fn (array $r): int => (int) $r['id'], $records);
        $fieldIds  = array_map(static fn (FieldEntity $f): int => $f->id, $relationFields);

        $batch = $this->relations->batchTargets($recordIds, $fieldIds);

        foreach ($records as &$record) {
            $rid = (int) $record['id'];
            foreach ($relationFields as $field) {
                $record['relations'][$field->slug] = $batch[$rid][$field->id] ?? [];
            }
        }
        unset($record);

        return $records;
    }

    /**
     * @param array<int, FieldEntity>  $listFields
     * @param array<string, mixed>     $values
     */
    private function syncRelationsFromValues(
        ListEntity $list,
        array $listFields,
        int $sourceRecordId,
        array $values,
        bool $partial = false,
    ): void {
        foreach ($listFields as $field) {
            if ($field->type !== 'relation') {
                continue;
            }
            if ($partial && ! array_key_exists($field->slug, $values)) {
                continue;
            }
            $targetListId = (int) ($field->config['target_list_id'] ?? 0);
            if ($targetListId <= 0) {
                continue;
            }

            $raw = $values[$field->slug] ?? [];
            if (! is_array($raw)) {
                $raw = [$raw];
            }
            $ids = [];
            foreach ($raw as $v) {
                if (is_numeric($v) && (int) $v > 0) {
                    $ids[] = (int) $v;
                }
            }

            $this->relations->sync(
                $field->id,
                $list->id,
                $sourceRecordId,
                $targetListId,
                $ids,
            );
        }
    }
}
