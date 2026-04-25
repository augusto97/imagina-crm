<?php
declare(strict_types=1);

namespace ImaginaCRM\Automations\Actions;

use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Contracts\ActionInterface;

abstract class AbstractAction implements ActionInterface
{
    public function getConfigSchema(): array
    {
        return [];
    }

    /**
     * Reemplazo simple de merge tags `{{slug}}` por valores del registro
     * actual del contexto. Soporta tanto `{{name}}` (campo del registro)
     * como `{{record.id}}` (id del registro). Sin valor → string vacío.
     *
     * Útil para `send_email.body`, `call_webhook.url` con queries, etc.
     */
    protected function applyMergeTags(string $template, TriggerContext $context): string
    {
        return preg_replace_callback(
            '/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/',
            static function (array $m) use ($context): string {
                $key = $m[1];
                if ($key === 'record.id') {
                    $id = $context->recordId();
                    return $id === null ? '' : (string) $id;
                }
                if (str_starts_with($key, 'record.')) {
                    $slug = substr($key, 7);
                    $val = $context->fieldValue($slug);
                    return self::stringifyValue($val);
                }
                $val = $context->fieldValue($key);
                return self::stringifyValue($val);
            },
            $template,
        ) ?? $template;
    }

    private static function stringifyValue(mixed $value): string
    {
        if ($value === null) return '';
        if (is_bool($value)) return $value ? '1' : '0';
        if (is_scalar($value)) return (string) $value;
        $encoded = wp_json_encode($value);
        return is_string($encoded) ? $encoded : '';
    }
}
