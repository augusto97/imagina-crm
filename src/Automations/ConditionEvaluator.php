<?php
declare(strict_types=1);

namespace ImaginaCRM\Automations;

/**
 * Evalúa condiciones tipo `field_filters` (`[slug => valor_esperado]`)
 * contra un `TriggerContext`. Comparten shape con los filtros del trigger
 * para que el operador no aprenda dos sintaxis distintas.
 *
 * Usado por:
 * - `AbstractTrigger::evaluateFilters()` (trigger-level filters)
 * - `AutomationEngine::executeAction()` (action-level conditions, 0.2.0+)
 */
final class ConditionEvaluator
{
    /**
     * Devuelve true si todos los pares `[slug => esperado]` matchean el
     * estado del registro en `$context`. Una condición vacía o ausente
     * evalúa a true (sin condición = ejecutar siempre).
     *
     * @param array<string, mixed>|null $condition
     */
    public static function matches(TriggerContext $context, ?array $condition): bool
    {
        if ($condition === null || $condition === []) {
            return true;
        }
        foreach ($condition as $slug => $expected) {
            if (! is_string($slug) || $slug === '') {
                continue;
            }
            $actual = $context->fieldValue($slug);
            if (! self::valuesEqual($actual, $expected)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Comparación laxa: arrays se comparan por JSON canon, escalares con
     * loose equality (`==`) para evitar falsos negativos por `"1" vs 1`.
     */
    public static function valuesEqual(mixed $a, mixed $b): bool
    {
        if (is_array($a) && is_array($b)) {
            return wp_json_encode($a) === wp_json_encode($b);
        }
        if (is_array($a) || is_array($b)) {
            return false;
        }
        // phpcs:ignore Universal.Operators.StrictComparisons.LooseEqual
        return $a == $b;
    }
}
