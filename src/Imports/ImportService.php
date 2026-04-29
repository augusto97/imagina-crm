<?php
declare(strict_types=1);

namespace ImaginaCRM\Imports;

use ImaginaCRM\Fields\FieldEntity;
use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Fields\Types\ComputedField;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Records\RecordService;
use ImaginaCRM\Support\ValidationResult;

/**
 * Importa registros desde un CSV (export de ClickUp, Airtable, Excel
 * "Save as CSV", Google Sheets, …) hacia una lista de Imagina CRM.
 *
 * Flujo de UI (dos pasos):
 *  1. `preview()` — el cliente sube el CSV, mostramos cabeceras +
 *     muestra de las primeras filas + sugerencia de mapping
 *     `csv_column_index → field_slug` basada en match difuso del
 *     header con el label/slug de cada campo.
 *  2. `run()` — el cliente confirma el mapping y dispara el import.
 *     Cada fila se valida contra `RecordValidator` y se inserta vía
 *     `RecordService::create`. Errores por fila se acumulan; el
 *     resto continúa importándose.
 *
 * No usa transacciones porque MySQL no garantiza atomicidad sobre
 * múltiples inserts cuando hay hooks/automatizaciones que pueden
 * disparar updates. El cliente recibe un summary con éxitos/errores
 * para decidir qué hacer manualmente con los registros fallidos.
 */
final class ImportService
{
    /** Cuántas filas devolvemos en el preview. */
    private const PREVIEW_ROWS = 20;

    /** Hard cap para no sobrecargar el servidor de un solo shot. */
    private const MAX_ROWS_PER_RUN = 5000;

    public function __construct(
        private readonly FieldRepository $fields,
        private readonly RecordService $records,
        private readonly FieldService $fieldService,
    ) {
    }

    /**
     * Inspecciona el CSV sin escribir nada. Devuelve cabeceras,
     * filas de muestra, sugerencias de mapping y un `suggested_type`
     * por columna (útil cuando el usuario quiere crear un campo
     * nuevo desde la UI).
     *
     * @return array{
     *     headers: array<int, string>,
     *     sample: array<int, array<int, string>>,
     *     total_rows: int,
     *     suggested_mapping: array<int, string>,
     *     suggested_types: array<int, string>,
     *     fields: array<int, array{id:int, slug:string, label:string, type:string}>
     * }
     */
    public function preview(ListEntity $list, string $csv): array
    {
        $parsed     = CsvParser::parse($csv);
        $headers    = $parsed['headers'];
        $rows       = $parsed['rows'];
        $listFields = $this->importableFields($list);
        $suggested  = $this->suggestMapping($headers, $listFields);

        // Inferir tipo por columna a partir de la muestra. La UI lo
        // usa como default cuando el usuario elige "crear campo nuevo"
        // para una columna que no mapea a ninguno existente.
        $sample           = array_slice($rows, 0, self::PREVIEW_ROWS);
        $suggestedTypes   = [];
        foreach ($headers as $idx => $_header) {
            $columnSample = [];
            foreach ($sample as $row) {
                $columnSample[] = $row[$idx] ?? '';
            }
            $suggestedTypes[$idx] = FieldTypeDetector::detect($columnSample);
        }

        return [
            'headers'           => $headers,
            'sample'            => $sample,
            'total_rows'        => count($rows),
            'suggested_mapping' => $suggested,
            'suggested_types'   => $suggestedTypes,
            'fields'            => array_map(
                static fn (FieldEntity $f): array => [
                    'id'          => $f->id,
                    'slug'        => $f->slug,
                    'label'       => $f->label,
                    'type'        => $f->type,
                    'is_required' => $f->isRequired,
                ],
                $listFields,
            ),
        ];
    }

    /**
     * Ejecuta el import. `$mapping` es `csv_column_index → field_slug`
     * para campos ya existentes; `$newFields` permite crear campos
     * sobre la marcha (uno por columna del CSV no mapeada). Las
     * columnas no incluidas en ninguno de los dos se ignoran.
     *
     * @param array<int, string>                                                $mapping
     * @param array<int, array{csv_column_index:int, label:string, type:string}> $newFields
     *
     * @return array{
     *     imported: int,
     *     skipped: int,
     *     errors: array<int, array{row:int, message:string}>,
     *     truncated: bool,
     *     created_fields: array<int, array{slug:string, label:string, type:string}>
     * }
     */
    public function run(ListEntity $list, string $csv, array $mapping, array $newFields = []): array
    {
        $parsed = CsvParser::parse($csv);
        $rows   = $parsed['rows'];

        // Crear primero los campos nuevos (si los hay). El user puede
        // haber pedido "crear nuevo" para columnas sin mapping en la
        // lista actual. Errores de creación se reportan en `errors`
        // como filas virtuales con row=0 y la columna como referencia.
        $createdFields = [];
        $errors        = [];
        foreach ($newFields as $spec) {
            $idx   = (int) ($spec['csv_column_index'] ?? -1);
            $label = trim((string) ($spec['label'] ?? ''));
            $type  = (string) ($spec['type'] ?? 'text');
            if ($idx < 0 || $label === '') {
                continue;
            }
            $created = $this->fieldService->create($list->id, [
                'label' => $label,
                'type'  => $type,
            ]);
            if ($created instanceof ValidationResult) {
                $errors[] = [
                    'row'     => 0,
                    'message' => sprintf(
                        /* translators: 1: column label, 2: validation message */
                        __('No se pudo crear el campo "%1$s": %2$s', 'imagina-crm'),
                        $label,
                        $this->summarizeValidation($created),
                    ),
                ];
                continue;
            }
            // Inyectamos el slug recién creado al mapping para que la
            // segunda fase use la columna como cualquier otra.
            $mapping[$idx]   = $created->slug;
            $createdFields[] = [
                'slug'  => $created->slug,
                'label' => $created->label,
                'type'  => $created->type,
            ];
        }

        $listFields = $this->importableFields($list);
        $bySlug     = [];
        foreach ($listFields as $f) {
            $bySlug[$f->slug] = $f;
        }

        $truncated = false;
        if (count($rows) > self::MAX_ROWS_PER_RUN) {
            $rows      = array_slice($rows, 0, self::MAX_ROWS_PER_RUN);
            $truncated = true;
        }

        $imported = 0;
        $skipped  = 0;

        foreach ($rows as $idx => $row) {
            $rowNumber = $idx + 2; // +1 por header, +1 para human-friendly (1-indexed)

            $values = [];
            foreach ($mapping as $colIdx => $slug) {
                if (! isset($bySlug[$slug])) {
                    continue;
                }
                $rawCell = $row[$colIdx] ?? '';
                $values[$slug] = $this->coerceCellValue($rawCell, $bySlug[$slug]);
            }

            // Fila completamente vacía → skip silencioso, no es un error.
            $allEmpty = true;
            foreach ($values as $v) {
                if ($v !== null && $v !== '' && $v !== []) {
                    $allEmpty = false;
                    break;
                }
            }
            if ($allEmpty) {
                $skipped++;
                continue;
            }

            $result = $this->records->create($list, $values);
            if ($result instanceof ValidationResult) {
                $errors[] = [
                    'row'     => $rowNumber,
                    'message' => $this->summarizeValidation($result),
                ];
                $skipped++;
                continue;
            }
            $imported++;
        }

        return [
            'imported'       => $imported,
            'skipped'        => $skipped,
            'errors'         => $errors,
            'truncated'      => $truncated,
            'created_fields' => $createdFields,
        ];
    }

    /**
     * Convierte el string del CSV al shape que espera
     * `RecordValidator` para cada tipo de campo. Best-effort:
     * los errores de tipo los reporta el validator (con mensajes
     * por campo) en `run()`.
     */
    private function coerceCellValue(string $raw, FieldEntity $field): mixed
    {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return $field->type === 'multi_select' ? [] : null;
        }

        return match ($field->type) {
            // multi_select: ClickUp/Airtable usan "tag1, tag2" o
            // "tag1; tag2". Aceptamos ambos.
            'multi_select' => array_values(array_filter(
                array_map('trim', preg_split('/[,;]/', $trimmed) ?: []),
                static fn (string $v): bool => $v !== '',
            )),

            // checkbox: aceptamos true/false, 1/0, sí/no, x/blank.
            'checkbox' => self::parseBool($trimmed),

            // number/currency: limpiar separadores de miles.
            'number', 'currency' => self::parseNumber($trimmed),

            // user/file: ID numérico.
            'user', 'file' => is_numeric($trimmed) ? (int) $trimmed : $trimmed,

            // date/datetime: dejamos el string; el validator parsea.
            // Si viene en formato local "DD/MM/YYYY" lo convertimos.
            'date', 'datetime' => self::normalizeDate($trimmed, $field->type),

            default => $trimmed,
        };
    }

    private static function parseBool(string $v): bool
    {
        $low = strtolower($v);
        return in_array($low, ['1', 'true', 'yes', 'sí', 'si', 'x', 'on'], true);
    }

    private static function parseNumber(string $v): float|int|string
    {
        // Excel ES exporta "1.234,56"; mantenemos el último separador
        // como decimal y descartamos los demás (separadores de miles).
        $clean = $v;
        if (preg_match('/^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$/', $v) === 1) {
            $clean = str_replace('.', '', $v);
            $clean = str_replace(',', '.', $clean);
        } elseif (str_contains($v, ',') && ! str_contains($v, '.')) {
            $clean = str_replace(',', '.', $v);
        }
        if (is_numeric($clean)) {
            return str_contains($clean, '.') ? (float) $clean : (int) $clean;
        }
        return $v;
    }

    /**
     * Normaliza una cadena de fecha a formato compatible con
     * `RecordValidator`:
     *  - `date`     → 'YYYY-MM-DD'
     *  - `datetime` → 'YYYY-MM-DD HH:MM:SS'
     *
     * Acepta:
     *  1. ISO 8601: 'YYYY-MM-DD' (canónico, devuelto sin tocar para
     *     `date` — para `datetime` con hora ya viene formateado).
     *  2. Slashed numéricos: 'DD/MM/YYYY' o 'MM/DD/YYYY' (Excel ES,
     *     ClickUp US). Heurística: si el primer grupo > 12, es DD/MM;
     *     si el segundo > 12, MM/DD; ambiguo → DD/MM (locale ES).
     *  3. Fallback: `DateTimeImmutable::__construct` parsea formatos
     *     humanos como "Thursday, May 21st 2026" o
     *     "Wednesday, January 21st 2026, 5:29:08 pm -05:00" — el
     *     parser nativo de PHP entiende nombres de día/mes y sufijos
     *     ordinales (1st, 2nd, 3rd, 21st). Es lo que ClickUp emite
     *     en sus exports CSV.
     *
     * Si nada parsea, devolvemos el string original — el validator
     * reportará "Fecha inválida" con el valor crudo para que el
     * usuario sepa qué celda revisar.
     */
    public static function normalizeDate(string $v, string $type): string
    {
        // 1. Ya en formato ISO.
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $v) === 1) {
            return $v;
        }
        // 2. Slashed numéricos.
        if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(.*)$/', $v, $m) === 1) {
            $a    = (int) $m[1];
            $b    = (int) $m[2];
            $year = (int) $m[3];
            if ($year < 100) {
                $year += 2000;
            }
            $tail = (string) $m[4];
            if ($a > 12 && $b <= 12) {
                $day = $a; $month = $b;
            } elseif ($b > 12 && $a <= 12) {
                $day = $b; $month = $a;
            } else {
                $day = $a; $month = $b;
            }
            $iso = sprintf('%04d-%02d-%02d', $year, $month, $day);
            return $type === 'datetime' && trim($tail) !== '' ? $iso . ' ' . trim($tail) : $iso;
        }
        // 3. Fallback al parser nativo de PHP (cubre formatos humanos
        // como ClickUp).
        try {
            $d = new \DateTimeImmutable($v);
            return $type === 'datetime'
                ? $d->format('Y-m-d H:i:s')
                : $d->format('Y-m-d');
        } catch (\Throwable) {
            return $v;
        }
    }

    /**
     * Sugiere `csv_column_index → field_slug` basado en match difuso
     * del header CSV con label/slug de cada campo. Usamos
     * `similar_text()` que devuelve un score 0-100. Threshold > 60
     * para minimizar falsos positivos.
     *
     * @param array<int, string>          $headers
     * @param array<int, FieldEntity>     $listFields
     * @return array<int, string>
     */
    private function suggestMapping(array $headers, array $listFields): array
    {
        $suggestions = [];
        $usedSlugs   = [];
        foreach ($headers as $idx => $header) {
            $bestSlug  = null;
            $bestScore = 0.0;
            foreach ($listFields as $f) {
                if (in_array($f->slug, $usedSlugs, true)) {
                    continue;
                }
                $candidates = [
                    self::normalize($f->slug),
                    self::normalize($f->label),
                ];
                foreach ($candidates as $cand) {
                    similar_text(self::normalize($header), $cand, $score);
                    if ($score > $bestScore) {
                        $bestScore = $score;
                        $bestSlug  = $f->slug;
                    }
                }
            }
            if ($bestSlug !== null && $bestScore >= 60.0) {
                $suggestions[$idx] = $bestSlug;
                $usedSlugs[]       = $bestSlug;
            }
        }
        return $suggestions;
    }

    private static function normalize(string $s): string
    {
        $s = strtolower(trim($s));
        $s = (string) preg_replace('/[^a-z0-9]+/i', '_', $s);
        return trim($s, '_');
    }

    /**
     * Campos importables: todos menos `computed` (no acepta input
     * directo, lo deriva el evaluator) y `relation` (requiere FK
     * a registros que pueden no existir aún).
     *
     * @return array<int, FieldEntity>
     */
    private function importableFields(ListEntity $list): array
    {
        return array_values(array_filter(
            $this->fields->allForList($list->id),
            static fn (FieldEntity $f): bool =>
                $f->type !== 'relation'
                && $f->type !== ComputedField::SLUG
                && $f->deletedAt === null,
        ));
    }

    private function summarizeValidation(ValidationResult $result): string
    {
        $errors = $result->errors();
        if ($errors === []) {
            return __('Validación falló sin detalles.', 'imagina-crm');
        }
        $msgs = [];
        foreach ($errors as $field => $messages) {
            $list = is_array($messages) ? $messages : [$messages];
            foreach ($list as $msg) {
                $msgs[] = $field . ': ' . (string) $msg;
            }
        }
        return implode('; ', array_slice($msgs, 0, 3));
    }
}
