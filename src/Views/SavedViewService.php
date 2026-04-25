<?php
declare(strict_types=1);

namespace ImaginaCRM\Views;

use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Support\ValidationResult;

/**
 * Casos de uso de Saved Views.
 *
 * En el MVP solo aceptamos `type = 'table'`. Otros tipos (kanban, calendar,
 * dashboard) se habilitan en fases posteriores.
 *
 * `is_default` se asegura único por lista a nivel service: setear una nueva
 * default desmarca la anterior.
 */
final class SavedViewService
{
    public const ALLOWED_TYPES = ['table'];

    public function __construct(
        private readonly SavedViewRepository $repo,
        private readonly ListRepository $lists,
    ) {
    }

    /**
     * @return array<int, SavedViewEntity>
     */
    public function allForList(int $listId): array
    {
        return $this->repo->allForList($listId);
    }

    public function find(int $listId, int $viewId): ?SavedViewEntity
    {
        $view = $this->repo->find($viewId);
        if ($view === null || $view->listId !== $listId) {
            return null;
        }
        return $view;
    }

    /**
     * @param array<string, mixed> $input
     */
    public function create(int $listId, array $input): SavedViewEntity|ValidationResult
    {
        if ($this->lists->find($listId) === null) {
            return ValidationResult::failWith('list_id', __('La lista no existe.', 'imagina-crm'));
        }

        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            return ValidationResult::failWith('name', __('El nombre es obligatorio.', 'imagina-crm'));
        }

        $type = (string) ($input['type'] ?? 'table');
        if (! in_array($type, self::ALLOWED_TYPES, true)) {
            return ValidationResult::failWith('type', __('Tipo de vista no soportado.', 'imagina-crm'));
        }

        $config    = is_array($input['config'] ?? null) ? $input['config'] : [];
        $isDefault = ! empty($input['is_default']);
        $now       = current_time('mysql', true);

        $id = $this->repo->insert([
            'list_id'    => $listId,
            'user_id'    => get_current_user_id(),
            'name'       => $name,
            'type'       => $type,
            'config'     => $config,
            'is_default' => $isDefault,
            'position'   => isset($input['position']) ? (int) $input['position'] : 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        if ($id === 0) {
            return ValidationResult::failWith('database', __('No se pudo crear la vista.', 'imagina-crm'));
        }

        if ($isDefault) {
            $this->repo->setDefault($listId, $id);
        }

        $created = $this->repo->find($id);
        if ($created === null) {
            return ValidationResult::failWith('database', __('La vista se creó pero no se pudo leer.', 'imagina-crm'));
        }

        do_action('imagina_crm/view_created', $created);
        return $created;
    }

    /**
     * @param array<string, mixed> $patch
     */
    public function update(int $listId, int $viewId, array $patch): SavedViewEntity|ValidationResult
    {
        $current = $this->find($listId, $viewId);
        if ($current === null) {
            return ValidationResult::failWith('id', __('La vista no existe.', 'imagina-crm'));
        }

        if (isset($patch['type'])) {
            $type = (string) $patch['type'];
            if (! in_array($type, self::ALLOWED_TYPES, true)) {
                return ValidationResult::failWith('type', __('Tipo de vista no soportado.', 'imagina-crm'));
            }
        }

        if (isset($patch['name'])) {
            $patch['name'] = trim((string) $patch['name']);
            if ($patch['name'] === '') {
                return ValidationResult::failWith('name', __('El nombre no puede estar vacío.', 'imagina-crm'));
            }
        }

        $ok = $this->repo->update($viewId, $patch);
        if (! $ok) {
            return ValidationResult::failWith('database', __('No se pudo actualizar la vista.', 'imagina-crm'));
        }

        if (array_key_exists('is_default', $patch) && ! empty($patch['is_default'])) {
            $this->repo->setDefault($listId, $viewId);
        }

        $updated = $this->repo->find($viewId);
        if ($updated === null) {
            return ValidationResult::failWith('database', __('No se pudo releer la vista.', 'imagina-crm'));
        }

        do_action('imagina_crm/view_updated', $updated, $current);
        return $updated;
    }

    public function delete(int $listId, int $viewId): ValidationResult
    {
        $current = $this->find($listId, $viewId);
        if ($current === null) {
            return ValidationResult::failWith('id', __('La vista no existe.', 'imagina-crm'));
        }

        $ok = $this->repo->delete($viewId);
        if (! $ok) {
            return ValidationResult::failWith('database', __('No se pudo eliminar la vista.', 'imagina-crm'));
        }

        do_action('imagina_crm/view_deleted', $current);
        return ValidationResult::ok();
    }
}
