<?php
declare(strict_types=1);

namespace ImaginaCRM\Automations;

/**
 * Motor síncrono de automatizaciones (CLAUDE.md §15).
 *
 * Responsabilidades:
 * 1. Recibir `TriggerContext` (desde un do_action de WP, ej.
 *    `imagina_crm/record_created`).
 * 2. Buscar automatizaciones activas con ese trigger_type para esa lista.
 * 3. Para cada una: pedirle al `TriggerInterface` si matches() — pasa o no.
 * 4. Si pasa: crear un `automation_run` (status=running), ejecutar las
 *    acciones en orden, persistir el log y marcar success/failed.
 *
 * En este commit la ejecución es **síncrona** y dentro de la misma
 * request HTTP que disparó el evento. Esto es OK para acciones rápidas
 * (update_field) y aceptable para call_webhook con timeout 8s. La
 * versión async vía Action Scheduler llega en commit posterior.
 *
 * Errores de acción individuales se loguean pero NO abortan el run; el
 * run completo se marca como `failed` solo si TODAS sus acciones
 * fallaron, o si una excepción inesperada se escapa de la ejecución.
 */
final class AutomationEngine
{
    /**
     * Profundidad máxima de cadena de automatizaciones (una automatización
     * que actualiza un campo dispara `record_updated` que puede a su vez
     * gatillar otra automatización, etc.). 5 niveles permite cadenas
     * legítimas pero rompe loops infinitos por configuración accidental.
     */
    public const MAX_DEPTH = 5;

    /**
     * Profundidad actual de la pila de despachos. Estático intencional:
     * vive durante toda la request HTTP, no por instancia. Esto cubre el
     * caso en que `UpdateFieldAction` llama a `RecordService::update()`
     * que dispara `record_updated` → `AutomationEngine::dispatch()`
     * recursivamente.
     */
    private static int $currentDepth = 0;

    public function __construct(
        private readonly AutomationRepository $automations,
        private readonly AutomationRunRepository $runs,
        private readonly TriggerRegistry $triggers,
        private readonly ActionRegistry $actions,
    ) {
    }

    /**
     * Punto de entrada principal: el listener de `imagina_crm/record_created`
     * y `imagina_crm/record_updated` construye el TriggerContext y nos lo
     * pasa.
     */
    public function dispatch(TriggerContext $context): void
    {
        if (self::$currentDepth >= self::MAX_DEPTH) {
            // Loop o cadena demasiado larga. Salimos silenciosamente —
            // cualquier evento más profundo no se procesa para esta request.
            return;
        }

        // Mapeo evento → trigger slug. Si llegan eventos sin trigger
        // registrado, ignoramos (no es error).
        $triggerSlug = $this->resolveTriggerSlugForEvent($context->event);
        if ($triggerSlug === null) {
            return;
        }

        $trigger = $this->triggers->get($triggerSlug);
        if ($trigger === null) {
            return;
        }

        $candidates = $this->automations->activeForListAndTrigger($context->list->id, $triggerSlug);
        if ($candidates === []) {
            return;
        }

        ++self::$currentDepth;
        try {
            foreach ($candidates as $automation) {
                try {
                    if (! $trigger->matches($context, $automation->triggerConfig)) {
                        continue;
                    }
                    $this->runAutomation($automation, $context);
                } catch (\Throwable $e) {
                    // Cualquier error que escape se persiste como run
                    // fallido para que el problema sea visible en el log.
                    $this->logFailedRun($automation, $context, $e->getMessage());
                }
            }
        } finally {
            --self::$currentDepth;
        }
    }

    /**
     * Útil para tests: resetear el contador entre tests evita
     * filtraciones de estado.
     */
    public static function resetDepth(): void
    {
        self::$currentDepth = 0;
    }

    /**
     * Ejecuta las acciones de una automatización en serie y persiste el
     * resultado en `automation_runs`.
     */
    private function runAutomation(AutomationEntity $automation, TriggerContext $context): void
    {
        $now   = current_time('mysql', true);
        $runId = $this->runs->create([
            'automation_id'   => $automation->id,
            'list_id'         => $context->list->id,
            'record_id'       => $context->recordId(),
            'status'          => AutomationRunRepository::STATUS_RUNNING,
            'trigger_context' => $context->toArray(),
            'started_at'      => $now,
        ]);

        $log         = [];
        $hadAnyOk    = false;
        $hadAnyFail  = false;

        foreach ($automation->actions as $spec) {
            $action = $this->actions->get($spec['type']);
            if ($action === null) {
                $log[] = ActionResult::skipped(
                    $spec['type'],
                    'Acción no registrada en el ActionRegistry.',
                )->toArray();
                continue;
            }
            try {
                $result = $action->execute($context, $spec['config']);
            } catch (\Throwable $e) {
                $result = ActionResult::failed($spec['type'], $e->getMessage());
            }
            $log[] = $result->toArray();
            if ($result->isSuccess()) {
                $hadAnyOk = true;
            } elseif ($result->isFailed()) {
                $hadAnyFail = true;
            }
        }

        // Estado final del run:
        // - success: hubo al menos una acción exitosa y ninguna falló.
        // - failed:  hubo al menos un fallo (independiente de éxitos).
        //   Esto deja el run visible para investigación / retry; aún si
        //   2 de 3 acciones funcionaron, el operador debería revisar
        //   por qué la tercera falló.
        // - success por skipped-only: si todas las acciones se skipped,
        //   marcamos success (no hubo error real).
        $finalStatus = $hadAnyFail
            ? AutomationRunRepository::STATUS_FAILED
            : AutomationRunRepository::STATUS_SUCCESS;

        $this->runs->update($runId, [
            'status'      => $finalStatus,
            'actions_log' => $log,
            'finished_at' => current_time('mysql', true),
        ]);

        unset($hadAnyOk); // referenciada por claridad pero usada en la decisión.

        do_action(
            'imagina_crm/automation_run_completed',
            $automation,
            $runId,
            $finalStatus,
            $log,
        );
    }

    private function logFailedRun(AutomationEntity $automation, TriggerContext $context, string $error): void
    {
        $now = current_time('mysql', true);
        $this->runs->create([
            'automation_id'   => $automation->id,
            'list_id'         => $context->list->id,
            'record_id'       => $context->recordId(),
            'status'          => AutomationRunRepository::STATUS_FAILED,
            'trigger_context' => $context->toArray(),
            'started_at'      => $now,
        ]);
    }

    private function resolveTriggerSlugForEvent(string $event): ?string
    {
        foreach ($this->triggers->all() as $trigger) {
            if ($trigger->getEvent() === $event) {
                return $trigger->getSlug();
            }
        }
        return null;
    }
}
