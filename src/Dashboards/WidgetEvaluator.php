<?php
declare(strict_types=1);

namespace ImaginaCRM\Dashboards;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Support\Database;
use ImaginaCRM\Support\ValidationResult;

/**
 * Calcula el valor de un widget contra MySQL real. Lo invoca el REST
 * controller cuando el frontend pide los datos de un widget concreto.
 *
 * Output por tipo:
 * - `kpi`:        `['value' => float|int, 'label' => string|null]`
 * - `chart_bar`:  `['data' => [['label' => string, 'value' => int], ...]]`
 * - `chart_line`: `['data' => [['label' => 'YYYY-MM', 'value' => int], ...]]`
 *
 * Usa `column_name` (no `slug`) para el SQL — por construcción ese campo
 * es inmutable y vetted por SlugManager (ver CLAUDE.md §7.5). Validamos
 * con `IDENT_REGEX` de defensa en profundidad antes de envolver con
 * backticks.
 *
 * Filtros por widget se ignoran en este commit; pasarán al QueryBuilder
 * cuando los expongamos en la UI (próximo commit de polish).
 */
final class WidgetEvaluator
{
    private const IDENT_REGEX = '/^[a-z][a-z0-9_]{0,62}$/';

    public function __construct(
        private readonly Database $db,
        private readonly ListRepository $lists,
        private readonly FieldRepository $fields,
    ) {
    }

    /**
     * @return array<string, mixed>|ValidationResult
     */
    public function evaluate(DashboardEntity $dashboard, string $widgetId): array|ValidationResult
    {
        $widget = $this->findWidget($dashboard, $widgetId);
        if ($widget === null) {
            return ValidationResult::failWith('id', __('Widget no encontrado.', 'imagina-crm'));
        }

        $list = $this->lists->find((int) ($widget['list_id'] ?? 0));
        if ($list === null) {
            return ValidationResult::failWith('list_id', __('La lista del widget ya no existe.', 'imagina-crm'));
        }
        if (! $this->validIdent($list->tableSuffix)) {
            return ValidationResult::failWith('list_id', __('Nombre de tabla inválido.', 'imagina-crm'));
        }

        $type   = (string) $widget['type'];
        $config = is_array($widget['config'] ?? null) ? $widget['config'] : [];

        return match ($type) {
            'kpi'        => $this->evaluateKpi($list->tableSuffix, $config),
            'chart_bar'  => $this->evaluateChartBar($list->tableSuffix, $list->id, $config),
            'chart_line' => $this->evaluateChartLine($list->tableSuffix, $list->id, $config),
            default      => ValidationResult::failWith('type', __('Tipo de widget no soportado.', 'imagina-crm')),
        };
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findWidget(DashboardEntity $dashboard, string $widgetId): ?array
    {
        foreach ($dashboard->widgets as $widget) {
            if (($widget['id'] ?? '') === $widgetId) {
                return $widget;
            }
        }
        return null;
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>|ValidationResult
     */
    private function evaluateKpi(string $tableSuffix, array $config): array|ValidationResult
    {
        $metric = isset($config['metric']) ? (string) $config['metric'] : '';
        $table  = $this->dataTable($tableSuffix);

        if ($metric === 'count') {
            $value = (int) $this->db->wpdb()->get_var(
                'SELECT COUNT(*) FROM ' . $table . ' WHERE deleted_at IS NULL',
            );
            return ['value' => $value, 'metric' => 'count'];
        }

        if ($metric === 'sum' || $metric === 'avg') {
            $fieldId = isset($config['metric_field_id']) ? (int) $config['metric_field_id'] : 0;
            $field   = $this->fields->find($fieldId);
            if ($field === null || ! $this->validIdent($field->columnName)) {
                return ValidationResult::failWith('metric_field_id', __('Campo de métrica inválido.', 'imagina-crm'));
            }
            $col = '`' . $field->columnName . '`';
            $sqlFn = $metric === 'sum' ? 'SUM' : 'AVG';
            $raw = $this->db->wpdb()->get_var(
                'SELECT ' . $sqlFn . '(' . $col . ') FROM ' . $table . ' WHERE deleted_at IS NULL',
            );
            // SUM/AVG sobre una tabla vacía devuelve NULL; lo
            // normalizamos a 0 para que el frontend pueda renderizar
            // sin guards.
            $value = $raw === null ? 0.0 : (float) $raw;
            return ['value' => $value, 'metric' => $metric];
        }

        return ValidationResult::failWith('metric', __('Métrica desconocida.', 'imagina-crm'));
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>|ValidationResult
     */
    private function evaluateChartBar(string $tableSuffix, int $listId, array $config): array|ValidationResult
    {
        $fieldId = isset($config['group_by_field_id']) ? (int) $config['group_by_field_id'] : 0;
        $field   = $this->fields->find($fieldId);
        if ($field === null || $field->listId !== $listId || $field->type !== 'select') {
            return ValidationResult::failWith('group_by_field_id', __('Campo de agrupación inválido.', 'imagina-crm'));
        }
        if (! $this->validIdent($field->columnName)) {
            return ValidationResult::failWith('group_by_field_id', __('Columna de agrupación inválida.', 'imagina-crm'));
        }

        $col = '`' . $field->columnName . '`';
        $rows = $this->db->wpdb()->get_results(
            'SELECT ' . $col . ' AS bucket, COUNT(*) AS total FROM ' . $this->dataTable($tableSuffix)
            . ' WHERE deleted_at IS NULL'
            . ' GROUP BY ' . $col
            . ' ORDER BY total DESC, bucket ASC',
            ARRAY_A,
        );
        $rows = is_array($rows) ? $rows : [];

        $labelByValue = $this->labelMapForSelect($field);
        $data = [];
        foreach ($rows as $row) {
            $value = $row['bucket'] ?? null;
            $label = $value === null || $value === ''
                ? __('(sin valor)', 'imagina-crm')
                : ($labelByValue[(string) $value] ?? (string) $value);
            $data[] = [
                'label' => $label,
                'value' => (int) ($row['total'] ?? 0),
            ];
        }
        return ['data' => $data];
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>|ValidationResult
     */
    private function evaluateChartLine(string $tableSuffix, int $listId, array $config): array|ValidationResult
    {
        $fieldId = isset($config['date_field_id']) ? (int) $config['date_field_id'] : 0;
        $field   = $this->fields->find($fieldId);
        if (
            $field === null
            || $field->listId !== $listId
            || ! in_array($field->type, ['date', 'datetime'], true)
        ) {
            return ValidationResult::failWith('date_field_id', __('Campo de fecha inválido.', 'imagina-crm'));
        }
        if (! $this->validIdent($field->columnName)) {
            return ValidationResult::failWith('date_field_id', __('Columna de fecha inválida.', 'imagina-crm'));
        }

        $col = '`' . $field->columnName . '`';
        // Agregamos por mes (YYYY-MM). Día sería más granular pero
        // para charts mensuales/trimestrales típicos esto es lo útil.
        // Si más adelante exponemos granularidad como config, pivoteamos
        // entre %Y-%m / %Y-%m-%d.
        $rows = $this->db->wpdb()->get_results(
            'SELECT DATE_FORMAT(' . $col . ", '%Y-%m') AS bucket, COUNT(*) AS total"
            . ' FROM ' . $this->dataTable($tableSuffix)
            . ' WHERE deleted_at IS NULL AND ' . $col . ' IS NOT NULL'
            . ' GROUP BY bucket ORDER BY bucket ASC',
            ARRAY_A,
        );
        $rows = is_array($rows) ? $rows : [];
        $data = [];
        foreach ($rows as $row) {
            $bucket = $row['bucket'] ?? null;
            if ($bucket === null) {
                continue;
            }
            $data[] = [
                'label' => (string) $bucket,
                'value' => (int) ($row['total'] ?? 0),
            ];
        }
        return ['data' => $data];
    }

    /**
     * Mapa `valor → label` derivado del config de un select.
     *
     * @return array<string, string>
     */
    private function labelMapForSelect(FieldEntity $field): array
    {
        $options = $field->config['options'] ?? null;
        if (! is_array($options)) {
            return [];
        }
        $map = [];
        foreach ($options as $opt) {
            if (! is_array($opt)) {
                continue;
            }
            $value = isset($opt['value']) ? (string) $opt['value'] : '';
            $label = isset($opt['label']) ? (string) $opt['label'] : $value;
            if ($value !== '') {
                $map[$value] = $label;
            }
        }
        return $map;
    }

    private function validIdent(string $ident): bool
    {
        return (bool) preg_match(self::IDENT_REGEX, $ident);
    }

    private function dataTable(string $tableSuffix): string
    {
        // Database::dataTable() ya prepende el prefijo correcto y
        // garantiza que el sufijo viene de SlugManager. Aquí lo
        // envolvemos en backticks tras validar el patrón nuevamente.
        $name = $this->db->dataTable($tableSuffix);
        // Backtick: el prefijo de WP puede contener `_` pero no
        // caracteres peligrosos.
        return '`' . str_replace('`', '', $name) . '`';
    }
}
