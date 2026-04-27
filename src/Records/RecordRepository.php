<?php
declare(strict_types=1);

namespace ImaginaCRM\Records;

use ImaginaCRM\Support\Database;

/**
 * Operaciones CRUD sobre la tabla dinámica `wp_imcrm_data_<table_suffix>`.
 *
 * No conoce slugs ni tipos: recibe `[columnName => value]` ya serializado
 * por `RecordValidator`. Toda la responsabilidad de prepared-statements y
 * sanitización de identificadores vive aquí.
 *
 * NULLs se inyectan como literal `NULL` en SQL (sin placeholder ni arg),
 * para que el conteo de placeholders y `wpdb::prepare()` siempre cuadre.
 */
final class RecordRepository
{
    /** @var array<int, string> Columnas base que toda data table tiene. */
    private const BASE_COLUMNS = ['id', 'created_by', 'created_at', 'updated_at', 'deleted_at'];

    public function __construct(private readonly Database $db)
    {
    }

    /**
     * @return array<string, mixed>|null Fila cruda (columnas físicas).
     */
    public function find(string $tableSuffix, int $id): ?array
    {
        $table = $this->qualifiedTable($tableSuffix);
        $wpdb  = $this->db->wpdb();
        $row   = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$table} WHERE id = %d AND deleted_at IS NULL", $id),
            ARRAY_A
        );
        return is_array($row) ? $row : null;
    }

    /**
     * @param array<string, mixed> $row [columnName => value]
     */
    public function insert(string $tableSuffix, array $row): int
    {
        $now = current_time('mysql', true);
        $row += [
            'created_by' => get_current_user_id(),
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $columns      = [];
        $placeholders = [];
        $args         = [];
        foreach ($row as $col => $value) {
            $columns[] = '`' . esc_sql($col) . '`';
            if ($value === null) {
                $placeholders[] = 'NULL';
                continue;
            }
            $placeholders[] = $this->placeholderForValue($value);
            $args[]         = $value;
        }

        $table = $this->qualifiedTable($tableSuffix);
        $sql   = "INSERT INTO {$table} (" . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';

        $wpdb     = $this->db->wpdb();
        $prepared = $args === [] ? $sql : (string) $wpdb->prepare($sql, $args);
        $wpdb->query($prepared);

        return $this->db->lastInsertId();
    }

    /**
     * @param array<string, mixed> $row [columnName => value]
     */
    public function update(string $tableSuffix, int $id, array $row): bool
    {
        $row['updated_at'] = current_time('mysql', true);

        $sets = [];
        $args = [];
        foreach ($row as $col => $value) {
            $colSql = '`' . esc_sql($col) . '`';
            if ($value === null) {
                $sets[] = $colSql . ' = NULL';
                continue;
            }
            $sets[] = $colSql . ' = ' . $this->placeholderForValue($value);
            $args[] = $value;
        }

        $table  = $this->qualifiedTable($tableSuffix);
        $sql    = "UPDATE {$table} SET " . implode(', ', $sets) . ' WHERE id = %d AND deleted_at IS NULL';
        $args[] = $id;

        $wpdb     = $this->db->wpdb();
        $prepared = (string) $wpdb->prepare($sql, $args);
        $result   = $wpdb->query($prepared);
        return $result !== false;
    }

    public function softDelete(string $tableSuffix, int $id): bool
    {
        $table  = $this->qualifiedTable($tableSuffix);
        $now    = current_time('mysql', true);
        $sql    = "UPDATE {$table} SET deleted_at = %s, updated_at = %s WHERE id = %d AND deleted_at IS NULL";
        $wpdb   = $this->db->wpdb();
        $result = $wpdb->query((string) $wpdb->prepare($sql, [$now, $now, $id]));
        return is_int($result) && $result > 0;
    }

    public function hardDelete(string $tableSuffix, int $id): bool
    {
        $table  = $this->qualifiedTable($tableSuffix);
        $wpdb   = $this->db->wpdb();
        $result = $wpdb->query(
            (string) $wpdb->prepare("DELETE FROM {$table} WHERE id = %d", $id)
        );
        return is_int($result) && $result > 0;
    }

    /**
     * Ejecuta SELECT y COUNT compilados por `QueryBuilder`.
     *
     * @param array<int, mixed> $args
     * @param array<int, mixed> $countArgs
     *
     * @return array{rows: array<int, array<string, mixed>>, total: int}
     */
    public function executeQuery(string $sql, array $args, string $countSql, array $countArgs): array
    {
        $wpdb = $this->db->wpdb();

        $preparedList  = $args === [] ? $sql : (string) $wpdb->prepare($sql, $args);
        $preparedCount = $countArgs === [] ? $countSql : (string) $wpdb->prepare($countSql, $countArgs);

        $rows  = $wpdb->get_results($preparedList, ARRAY_A);
        $total = (int) $wpdb->get_var($preparedCount);

        return [
            'rows'  => is_array($rows) ? $rows : [],
            'total' => $total,
        ];
    }

    private function qualifiedTable(string $tableSuffix): string
    {
        return '`' . esc_sql($this->db->dataTable($tableSuffix)) . '`';
    }

    /**
     * Devuelve los valores distintos de una columna ordenados por
     * frecuencia descendente, con conteo. Útil para autocomplete en
     * filtros y condiciones de automatización.
     *
     * `$columnName` debe venir YA validado por el caller (siempre
     * resuelto desde `wp_imcrm_fields.column_name`, que es inmutable
     * y pasó por SlugManager). Lo escapamos defensivamente igual.
     *
     * `$search` filtra por LIKE %search% case-insensitive si no es null.
     *
     * @return array<int, array{value: string, count: int}>
     */
    public function getDistinctValues(
        string $tableSuffix,
        string $columnName,
        ?string $search,
        int $limit,
    ): array {
        $table  = $this->qualifiedTable($tableSuffix);
        $column = '`' . esc_sql($columnName) . '`';
        $wpdb   = $this->db->wpdb();

        $sql = "SELECT {$column} AS value, COUNT(*) AS cnt "
             . "FROM {$table} "
             . "WHERE deleted_at IS NULL AND {$column} IS NOT NULL AND {$column} != ''";
        $args = [];

        if ($search !== null && $search !== '') {
            $sql   .= " AND {$column} LIKE %s";
            $args[] = '%' . $wpdb->esc_like($search) . '%';
        }

        $sql   .= " GROUP BY {$column} ORDER BY cnt DESC, value ASC LIMIT %d";
        $args[] = max(1, min(500, $limit));

        // $args nunca está vacío (siempre incluye el LIMIT) — siempre prepare.
        $prepared = (string) $wpdb->prepare($sql, $args);
        $rows     = $wpdb->get_results($prepared, ARRAY_A);
        if (! is_array($rows)) {
            return [];
        }

        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $value = $row['value'] ?? null;
            if ($value === null) {
                continue;
            }
            $out[] = [
                'value' => (string) $value,
                'count' => (int) ($row['cnt'] ?? 0),
            ];
        }
        return $out;
    }

    private function placeholderForValue(mixed $value): string
    {
        if (is_int($value)) {
            return '%d';
        }
        if (is_float($value)) {
            return '%f';
        }
        return '%s';
    }

    /**
     * @return array<int, string>
     */
    public static function baseColumns(): array
    {
        return self::BASE_COLUMNS;
    }
}
