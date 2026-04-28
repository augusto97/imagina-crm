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
            'chart_bar', 'chart_pie'
                         => $this->evaluateChartBar($list->tableSuffix, $list->id, $config),
            'chart_line', 'chart_area'
                         => $this->evaluateChartLine($list->tableSuffix, $list->id, $config),
            'stat_delta' => $this->evaluateStatDelta($list->tableSuffix, $list->id, $config),
            'table'      => $this->evaluateTable($list->tableSuffix, $list->id, $config),
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

    /** Tipos de campo que se pueden usar como dimensión en chart_bar / chart_pie. */
    private const GROUPABLE_TYPES = [
        'select', 'multi_select',
        'text', 'email', 'url',
        'date', 'datetime',
        'checkbox',
    ];

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>|ValidationResult
     */
    private function evaluateChartBar(string $tableSuffix, int $listId, array $config): array|ValidationResult
    {
        $fieldId = isset($config['group_by_field_id']) ? (int) $config['group_by_field_id'] : 0;
        $field   = $this->fields->find($fieldId);
        if (
            $field === null
            || $field->listId !== $listId
            || ! in_array($field->type, self::GROUPABLE_TYPES, true)
        ) {
            return ValidationResult::failWith('group_by_field_id', __('Campo de agrupación inválido.', 'imagina-crm'));
        }
        if (! $this->validIdent($field->columnName)) {
            return ValidationResult::failWith('group_by_field_id', __('Columna de agrupación inválida.', 'imagina-crm'));
        }

        $table = $this->dataTable($tableSuffix);
        $col   = '`' . $field->columnName . '`';
        $limit = 25; // hard cap para no devolver charts enormes con text fields

        // multi_select: la columna almacena JSON. Hacemos UNNEST en PHP
        // — fetch all distinct arrays + decode + acumular.
        if ($field->type === 'multi_select') {
            $rows = $this->db->wpdb()->get_results(
                'SELECT ' . $col . ' AS bucket, COUNT(*) AS total FROM ' . $table
                . ' WHERE deleted_at IS NULL AND ' . $col . ' IS NOT NULL'
                . ' GROUP BY ' . $col,
                ARRAY_A,
            );
            $counts = [];
            foreach (is_array($rows) ? $rows : [] as $row) {
                $raw   = $row['bucket'] ?? null;
                $total = (int) ($row['total'] ?? 0);
                $arr   = is_string($raw) ? json_decode($raw, true) : null;
                if (! is_array($arr)) {
                    continue;
                }
                foreach ($arr as $v) {
                    if (! is_string($v) || $v === '') {
                        continue;
                    }
                    $counts[$v] = ($counts[$v] ?? 0) + $total;
                }
            }
            $labelByValue = $this->labelMapForSelect($field);
            arsort($counts);
            $data = [];
            foreach (array_slice($counts, 0, $limit, true) as $value => $total) {
                $data[] = [
                    'label' => $labelByValue[$value] ?? $value,
                    'value' => $total,
                ];
            }
            return ['data' => $data];
        }

        // date / datetime: agrupamos por mes (YYYY-MM) para que el chart
        // sea legible. Si en algún momento exponemos granularidad day/week
        // como config, pivoteamos el formato aquí.
        if ($field->type === 'date' || $field->type === 'datetime') {
            $rows = $this->db->wpdb()->get_results(
                'SELECT DATE_FORMAT(' . $col . ", '%Y-%m') AS bucket, COUNT(*) AS total"
                . ' FROM ' . $table
                . ' WHERE deleted_at IS NULL AND ' . $col . ' IS NOT NULL'
                . ' GROUP BY bucket ORDER BY bucket DESC LIMIT ' . $limit,
                ARRAY_A,
            );
            return $this->bucketsAsData($rows);
        }

        // checkbox: 0/1. Mapeamos a labels reconocibles.
        if ($field->type === 'checkbox') {
            $rows = $this->db->wpdb()->get_results(
                'SELECT ' . $col . ' AS bucket, COUNT(*) AS total FROM ' . $table
                . ' WHERE deleted_at IS NULL'
                . ' GROUP BY ' . $col,
                ARRAY_A,
            );
            $data = [];
            foreach (is_array($rows) ? $rows : [] as $row) {
                $v = $row['bucket'] ?? null;
                $label = $v === '1' || $v === 1 ? __('Sí', 'imagina-crm')
                    : ($v === '0' || $v === 0 ? __('No', 'imagina-crm') : __('(sin valor)', 'imagina-crm'));
                $data[] = ['label' => $label, 'value' => (int) ($row['total'] ?? 0)];
            }
            return ['data' => $data];
        }

        // text / email / url / select: top N distintos por frecuencia.
        $rows = $this->db->wpdb()->get_results(
            'SELECT ' . $col . ' AS bucket, COUNT(*) AS total FROM ' . $table
            . ' WHERE deleted_at IS NULL'
            . ' GROUP BY ' . $col
            . ' ORDER BY total DESC, bucket ASC LIMIT ' . $limit,
            ARRAY_A,
        );
        $rows = is_array($rows) ? $rows : [];

        $labelByValue = $field->type === 'select' ? $this->labelMapForSelect($field) : [];
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
     * @param mixed $rows
     * @return array<string, mixed>
     */
    private function bucketsAsData(mixed $rows): array
    {
        $data = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
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
     * `stat_delta`: KPI con comparación vs período anterior. Config:
     *  - metric: 'count' | 'sum' | 'avg'
     *  - metric_field_id: requerido para sum/avg
     *  - date_field_id: campo date/datetime que delimita los períodos
     *  - period_days: longitud del período actual (default 30)
     *
     * Devuelve `{value, previous, delta_pct, period_days, metric}`.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>|ValidationResult
     */
    private function evaluateStatDelta(string $tableSuffix, int $listId, array $config): array|ValidationResult
    {
        $metric = isset($config['metric']) ? (string) $config['metric'] : 'count';
        if (! in_array($metric, ['count', 'sum', 'avg'], true)) {
            return ValidationResult::failWith('metric', __('Métrica desconocida.', 'imagina-crm'));
        }
        $periodDays = max(1, min(365, (int) ($config['period_days'] ?? 30)));

        $dateFieldId = isset($config['date_field_id']) ? (int) $config['date_field_id'] : 0;
        $dateField   = $this->fields->find($dateFieldId);
        if (
            $dateField === null
            || $dateField->listId !== $listId
            || ! in_array($dateField->type, ['date', 'datetime'], true)
            || ! $this->validIdent($dateField->columnName)
        ) {
            return ValidationResult::failWith('date_field_id', __('Campo de fecha inválido.', 'imagina-crm'));
        }

        $metricCol = '*';
        $sqlFn     = 'COUNT';
        if ($metric === 'sum' || $metric === 'avg') {
            $metricFieldId = isset($config['metric_field_id']) ? (int) $config['metric_field_id'] : 0;
            $metricField   = $this->fields->find($metricFieldId);
            if (
                $metricField === null
                || $metricField->listId !== $listId
                || ! $this->validIdent($metricField->columnName)
            ) {
                return ValidationResult::failWith('metric_field_id', __('Campo de métrica inválido.', 'imagina-crm'));
            }
            $metricCol = '`' . $metricField->columnName . '`';
            $sqlFn     = $metric === 'sum' ? 'SUM' : 'AVG';
        }

        $table   = $this->dataTable($tableSuffix);
        $dateCol = '`' . $dateField->columnName . '`';
        $wpdb    = $this->db->wpdb();

        // Período actual: [now - N días, now]. Período previo:
        // [now - 2N días, now - N días).
        $sql = $wpdb->prepare(
            'SELECT'
            . ' (SELECT ' . $sqlFn . '(' . $metricCol . ') FROM ' . $table
                . ' WHERE deleted_at IS NULL AND ' . $dateCol . ' >= DATE_SUB(NOW(), INTERVAL %d DAY)) AS curr,'
            . ' (SELECT ' . $sqlFn . '(' . $metricCol . ') FROM ' . $table
                . ' WHERE deleted_at IS NULL AND ' . $dateCol . ' >= DATE_SUB(NOW(), INTERVAL %d DAY)'
                . ' AND ' . $dateCol . ' < DATE_SUB(NOW(), INTERVAL %d DAY)) AS prev',
            $periodDays,
            $periodDays * 2,
            $periodDays,
        );
        $row = $wpdb->get_row($sql, ARRAY_A);

        $curr = is_array($row) ? ($row['curr'] ?? 0) : 0;
        $prev = is_array($row) ? ($row['prev'] ?? 0) : 0;
        $currVal = $metric === 'count' ? (int) $curr : (float) $curr;
        $prevVal = $metric === 'count' ? (int) $prev : (float) $prev;

        $deltaPct = null;
        if ($prevVal != 0) {
            $deltaPct = (($currVal - $prevVal) / abs($prevVal)) * 100.0;
        } elseif ($currVal != 0) {
            $deltaPct = 100.0;
        }

        return [
            'value'       => $currVal,
            'previous'    => $prevVal,
            'delta_pct'   => $deltaPct,
            'period_days' => $periodDays,
            'metric'      => $metric,
        ];
    }

    /**
     * `table`: top N records ordenados por un campo. Config:
     *  - sort_field_id: id del campo a ordenar
     *  - sort_dir: 'asc' | 'desc' (default 'desc')
     *  - limit: 1..50 (default 10)
     *  - visible_field_ids: lista de IDs de campos a mostrar
     *
     * Devuelve `{rows: [{id, fields:[{label, value}]}], columns: [{label, type}]}`.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function evaluateTable(string $tableSuffix, int $listId, array $config): array
    {
        $limit   = max(1, min(50, (int) ($config['limit'] ?? 10)));
        $sortDir = (string) ($config['sort_dir'] ?? 'desc');
        $sortDir = $sortDir === 'asc' ? 'ASC' : 'DESC';

        $sortFieldId = isset($config['sort_field_id']) ? (int) $config['sort_field_id'] : 0;
        $sortCol     = 'created_at';
        if ($sortFieldId > 0) {
            $sortField = $this->fields->find($sortFieldId);
            if (
                $sortField !== null
                && $sortField->listId === $listId
                && $this->validIdent($sortField->columnName)
            ) {
                $sortCol = $sortField->columnName;
            }
        }

        $rawVisible = $config['visible_field_ids'] ?? [];
        if (! is_array($rawVisible)) {
            $rawVisible = [];
        }
        /** @var array<int, FieldEntity> $visibleFields */
        $visibleFields = [];
        foreach ($rawVisible as $vid) {
            $vf = $this->fields->find((int) $vid);
            if (
                $vf !== null
                && $vf->listId === $listId
                && $vf->type !== 'relation'
                && $this->validIdent($vf->columnName)
            ) {
                $visibleFields[] = $vf;
            }
        }
        // Si el caller no especificó columnas, mostramos las primeras 4
        // del list (sin relations) para no devolver una tabla vacía.
        if ($visibleFields === []) {
            foreach ($this->fields->allForList($listId) as $f) {
                if ($f->type === 'relation' || ! $this->validIdent($f->columnName)) {
                    continue;
                }
                $visibleFields[] = $f;
                if (count($visibleFields) >= 4) {
                    break;
                }
            }
        }

        $cols = ['id'];
        foreach ($visibleFields as $vf) {
            $cols[] = '`' . $vf->columnName . '`';
        }
        $colsSql = implode(', ', $cols);

        $sql = $this->db->wpdb()->prepare(
            'SELECT ' . $colsSql . ' FROM ' . $this->dataTable($tableSuffix)
            . ' WHERE deleted_at IS NULL'
            . ' ORDER BY `' . $sortCol . '` ' . $sortDir
            . ' LIMIT %d',
            $limit,
        );
        $rows = $this->db->wpdb()->get_results($sql, ARRAY_A);
        $rows = is_array($rows) ? $rows : [];

        $columns = array_map(
            static fn (FieldEntity $f): array => [
                'label' => $f->label,
                'slug'  => $f->slug,
                'type'  => $f->type,
            ],
            $visibleFields,
        );

        $outRows = [];
        foreach ($rows as $row) {
            $values = [];
            foreach ($visibleFields as $vf) {
                $values[$vf->slug] = $row[$vf->columnName] ?? null;
            }
            $outRows[] = [
                'id'     => (int) ($row['id'] ?? 0),
                'fields' => $values,
            ];
        }

        return [
            'columns' => $columns,
            'rows'    => $outRows,
        ];
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
