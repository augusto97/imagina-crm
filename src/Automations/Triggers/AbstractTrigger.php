<?php
declare(strict_types=1);

namespace ImaginaCRM\Automations\Triggers;

use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Contracts\TriggerInterface;

/**
 * Helpers comunes a todos los triggers.
 *
 * `evaluateFilters()` aplica una lista pequeña de filtros del config sobre
 * el contexto: por ahora sólo `field_filters` (igualdad simple por slug).
 * Los triggers concretos pueden extender o ignorar.
 */
abstract class AbstractTrigger implements TriggerInterface
{
    public function getConfigSchema(): array
    {
        return [];
    }

    /**
     * Aplica los filtros declarados en `config.field_filters` (`[slug => valor]`).
     * Devuelve `true` si todos pasan, `false` si alguno falla.
     *
     * @param array<string, mixed> $config
     */
    protected function evaluateFilters(TriggerContext $context, array $config): bool
    {
        $filters = $config['field_filters'] ?? null;
        if (! is_array($filters)) {
            return true;
        }
        foreach ($filters as $slug => $expected) {
            if (! is_string($slug)) {
                continue;
            }
            $actual = $context->fieldValue($slug);
            if (! $this->valuesEqual($actual, $expected)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Comparación laxa: para escalares usa loose-equality (`==`); para
     * arrays compara JSON. Cubre casos típicos como `status="active"`
     * sin que tipos numérico vs string causen falsos negativos.
     */
    protected function valuesEqual(mixed $a, mixed $b): bool
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
