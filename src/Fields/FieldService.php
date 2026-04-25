<?php
declare(strict_types=1);

namespace ImaginaCRM\Fields;

use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\SchemaManager;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Support\RenameResult;
use ImaginaCRM\Support\SlugContext;
use ImaginaCRM\Support\ValidationResult;

/**
 * Casos de uso de campos.
 *
 * Orquesta `SlugManager`, `SchemaManager`, `FieldTypeRegistry`,
 * `FieldRepository` y `ListRepository`. Cumple las invariantes:
 *
 * - El `column_name` se decide al crear el campo y nunca cambia.
 * - El `slug` es editable; se persiste vía `SlugManager::rename()`.
 * - Cuando el tipo materializa columna (`hasColumn() === true`), la
 *   creación/borrado del campo dispara `addColumn` / `dropColumn`.
 * - `is_unique` solo se acepta si el tipo lo soporta y se traduce a
 *   un `UNIQUE INDEX` real en la tabla dinámica.
 * - Si el DDL falla durante la creación, se hace rollback del INSERT.
 */
final class FieldService
{
    public function __construct(
        private readonly FieldRepository $fields,
        private readonly ListRepository $lists,
        private readonly SlugManager $slugs,
        private readonly SchemaManager $schema,
        private readonly FieldTypeRegistry $registry,
    ) {
    }

    /**
     * @return array<int, FieldEntity>
     */
    public function allForList(int $listId): array
    {
        return $this->fields->allForList($listId);
    }

    public function findByIdOrSlug(int $listId, string $idOrSlug): ?FieldEntity
    {
        if (ctype_digit($idOrSlug)) {
            $field = $this->fields->find((int) $idOrSlug);
            return ($field !== null && $field->listId === $listId) ? $field : null;
        }

        $direct = $this->fields->findBySlug($listId, $idOrSlug);
        if ($direct !== null) {
            return $direct;
        }

        $resolved = $this->slugs->resolveCurrentSlug(SlugContext::Field, $idOrSlug, $listId);
        if ($resolved === null) {
            return null;
        }
        return $this->fields->findBySlug($listId, $resolved);
    }

    /**
     * Crea un campo nuevo dentro de una lista.
     *
     * @param array<string, mixed> $input Debe contener `label` y `type`.
     */
    public function create(int $listId, array $input): FieldEntity|ValidationResult
    {
        $list = $this->lists->find($listId);
        if ($list === null) {
            return ValidationResult::failWith('list_id', __('La lista no existe.', 'imagina-crm'));
        }

        $label = trim((string) ($input['label'] ?? ''));
        $type  = (string) ($input['type'] ?? '');

        if ($label === '') {
            return ValidationResult::failWith('label', __('El label es obligatorio.', 'imagina-crm'));
        }

        $fieldType = $this->registry->get($type);
        if ($fieldType === null) {
            return ValidationResult::failWith('type', __('Tipo de campo desconocido.', 'imagina-crm'));
        }

        $slugInput = isset($input['slug']) ? (string) $input['slug'] : '';
        $slug      = $slugInput !== '' ? strtolower($slugInput) : $this->slugs->slugify($label);

        $slugValidation = $this->slugs->validate($slug, SlugContext::Field, $listId);
        if (! $slugValidation->isValid()) {
            return $slugValidation;
        }

        $isUnique = ! empty($input['is_unique']);
        if ($isUnique && ! $fieldType->supportsUnique()) {
            return ValidationResult::failWith(
                'is_unique',
                __('Este tipo de campo no soporta unicidad.', 'imagina-crm')
            );
        }

        $config = is_array($input['config'] ?? null) ? $input['config'] : [];

        $columnName = $this->slugs->generateUnique($slug, 'column_name', $listId);
        $now        = current_time('mysql', true);

        $id = $this->fields->insert([
            'list_id'     => $listId,
            'slug'        => $slug,
            'column_name' => $columnName,
            'label'       => $label,
            'type'        => $type,
            'config'      => $config,
            'is_required' => ! empty($input['is_required']),
            'is_unique'   => $isUnique,
            'is_primary'  => ! empty($input['is_primary']),
            'position'    => isset($input['position']) ? (int) $input['position'] : $this->nextPosition($listId),
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);

        if ($id === 0) {
            return ValidationResult::failWith('database', __('No se pudo guardar el campo.', 'imagina-crm'));
        }

        // Materializar columna si el tipo lo requiere.
        if ($fieldType->hasColumn()) {
            try {
                $this->schema->addColumn($list->tableSuffix, $columnName, $fieldType->getSqlDefinition($config));
                if ($isUnique) {
                    $this->schema->addUniqueIndex($list->tableSuffix, $columnName);
                }
            } catch (\Throwable $e) {
                // Rollback: marcar el campo como deleted; intentar limpiar
                // estado parcial si la columna sí se creó pero el índice no.
                $this->fields->softDelete($id);
                if ($this->schema->columnExists($list->tableSuffix, $columnName)) {
                    try {
                        $this->schema->dropColumn($list->tableSuffix, $columnName);
                    } catch (\Throwable) {
                        // Ya estamos en path de error; nada más que hacer aquí.
                    }
                }
                return ValidationResult::failWith(
                    'schema',
                    sprintf(
                        /* translators: %s: error message */
                        __('No se pudo crear la columna: %s', 'imagina-crm'),
                        $e->getMessage()
                    )
                );
            }
        }

        $created = $this->fields->find($id);
        if ($created === null) {
            return ValidationResult::failWith('database', __('El campo se creó pero no se pudo leer.', 'imagina-crm'));
        }

        do_action('imagina_crm/field_created', $created, $list);
        return $created;
    }

    /**
     * Actualiza un campo: label, config, flags y position. Si cambia
     * `config` y el tipo materializa columna, se hace `MODIFY COLUMN`.
     * Si cambia `is_unique`, se añade/quita el `UNIQUE INDEX`.
     *
     * El cambio de slug se maneja por separado en `renameSlug()` para
     * mantener la trazabilidad y los headers de respuesta.
     *
     * @param array<string, mixed> $patch
     */
    public function update(int $listId, int $fieldId, array $patch): FieldEntity|ValidationResult
    {
        $list = $this->lists->find($listId);
        if ($list === null) {
            return ValidationResult::failWith('list_id', __('La lista no existe.', 'imagina-crm'));
        }

        $current = $this->fields->find($fieldId);
        if ($current === null || $current->listId !== $listId) {
            return ValidationResult::failWith('id', __('El campo no existe.', 'imagina-crm'));
        }

        $type = $this->registry->get($current->type);
        if ($type === null) {
            return ValidationResult::failWith('type', __('Tipo de campo desconocido.', 'imagina-crm'));
        }

        if (isset($patch['label'])) {
            $patch['label'] = trim((string) $patch['label']);
            if ($patch['label'] === '') {
                return ValidationResult::failWith('label', __('El label no puede estar vacío.', 'imagina-crm'));
            }
        }

        $newConfig    = $patch['config'] ?? null;
        $configChanged = $newConfig !== null && is_array($newConfig)
            && wp_json_encode($newConfig) !== wp_json_encode($current->config);

        $newUnique = array_key_exists('is_unique', $patch) ? (bool) $patch['is_unique'] : null;
        if ($newUnique === true && ! $type->supportsUnique()) {
            return ValidationResult::failWith(
                'is_unique',
                __('Este tipo de campo no soporta unicidad.', 'imagina-crm')
            );
        }

        $ok = $this->fields->update($fieldId, $patch);
        if (! $ok) {
            return ValidationResult::failWith('database', __('No se pudo actualizar el campo.', 'imagina-crm'));
        }

        // ALTER COLUMN si la config cambió y el tipo materializa columna.
        if ($configChanged && $type->hasColumn() && is_array($newConfig)) {
            try {
                $this->schema->alterColumn($list->tableSuffix, $current->columnName, $type->getSqlDefinition($newConfig));
            } catch (\Throwable $e) {
                return ValidationResult::failWith(
                    'schema',
                    sprintf(
                        /* translators: %s: error message */
                        __('No se pudo modificar la columna: %s', 'imagina-crm'),
                        $e->getMessage()
                    )
                );
            }
        }

        // Toggle UNIQUE INDEX si cambió.
        if ($newUnique !== null && $newUnique !== $current->isUnique && $type->hasColumn()) {
            try {
                if ($newUnique) {
                    $this->schema->addUniqueIndex($list->tableSuffix, $current->columnName);
                } else {
                    $this->schema->dropUniqueIndex($list->tableSuffix, $current->columnName);
                }
            } catch (\Throwable $e) {
                return ValidationResult::failWith(
                    'schema',
                    sprintf(
                        /* translators: %s: error message */
                        __('No se pudo actualizar el índice único: %s', 'imagina-crm'),
                        $e->getMessage()
                    )
                );
            }
        }

        $updated = $this->fields->find($fieldId);
        if ($updated === null) {
            return ValidationResult::failWith('database', __('No se pudo releer el campo.', 'imagina-crm'));
        }

        do_action('imagina_crm/field_updated', $updated, $current, $list);
        return $updated;
    }

    public function renameSlug(int $listId, int $fieldId, string $newSlug): RenameResult
    {
        $field = $this->fields->find($fieldId);
        if ($field === null || $field->listId !== $listId) {
            return RenameResult::fail(
                ValidationResult::failWith('id', __('El campo no existe.', 'imagina-crm'))
            );
        }

        $result = $this->slugs->rename(SlugContext::Field, $fieldId, $newSlug, $listId);
        if ($result->success && $result->oldSlug !== $result->newSlug) {
            do_action('imagina_crm/field_slug_renamed', $listId, $fieldId, $result->oldSlug, $result->newSlug);
        }
        return $result;
    }

    /**
     * Elimina un campo. Por defecto soft-delete; con `purge: true` además
     * dropea la columna real de la tabla dinámica.
     */
    public function delete(int $listId, int $fieldId, bool $purge = false): ValidationResult
    {
        $list = $this->lists->find($listId);
        if ($list === null) {
            return ValidationResult::failWith('list_id', __('La lista no existe.', 'imagina-crm'));
        }

        $current = $this->fields->find($fieldId);
        if ($current === null || $current->listId !== $listId) {
            return ValidationResult::failWith('id', __('El campo no existe.', 'imagina-crm'));
        }

        $ok = $this->fields->softDelete($fieldId);
        if (! $ok) {
            return ValidationResult::failWith('database', __('No se pudo eliminar el campo.', 'imagina-crm'));
        }

        if ($purge) {
            $type = $this->registry->get($current->type);
            if ($type !== null && $type->hasColumn()) {
                try {
                    if ($current->isUnique && $this->schema->columnExists($list->tableSuffix, $current->columnName)) {
                        $this->schema->dropUniqueIndex($list->tableSuffix, $current->columnName);
                    }
                    $this->schema->dropColumn($list->tableSuffix, $current->columnName);
                } catch (\Throwable $e) {
                    return ValidationResult::failWith(
                        'schema',
                        sprintf(
                            /* translators: %s: error message */
                            __('El campo se marcó como eliminado pero la columna no se pudo borrar: %s', 'imagina-crm'),
                            $e->getMessage()
                        )
                    );
                }
            }
        }

        do_action('imagina_crm/field_deleted', $current, $list, $purge);
        return ValidationResult::ok();
    }

    /**
     * @param array<int, int> $order [fieldId => position]
     */
    public function reorder(int $listId, array $order): ValidationResult
    {
        $list = $this->lists->find($listId);
        if ($list === null) {
            return ValidationResult::failWith('list_id', __('La lista no existe.', 'imagina-crm'));
        }

        $valid = [];
        foreach ($order as $fieldId => $position) {
            if (! is_int($fieldId) && ! ctype_digit((string) $fieldId)) {
                continue;
            }
            $valid[(int) $fieldId] = (int) $position;
        }

        if ($valid === []) {
            return ValidationResult::failWith('order', __('No hay items que reordenar.', 'imagina-crm'));
        }

        $this->fields->reorder($listId, $valid);
        do_action('imagina_crm/fields_reordered', $listId, $valid);
        return ValidationResult::ok();
    }

    private function nextPosition(int $listId): int
    {
        $existing = $this->fields->allForList($listId);
        if ($existing === []) {
            return 0;
        }
        $max = 0;
        foreach ($existing as $f) {
            if ($f->position > $max) {
                $max = $f->position;
            }
        }
        return $max + 1;
    }
}
