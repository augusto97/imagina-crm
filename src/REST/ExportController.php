<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Exports\CsvExporter;
use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Permissions\PermissionService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST controller para `/imagina-crm/v1/lists/{list}/export`.
 *
 * Devuelve un CSV (con header `Content-Type: text/csv`) listo para
 * descargar. El frontend abre la URL directamente — el browser
 * dispara el download nativo. Acepta `filter_tree` (mismo shape
 * que en `/records`) y `fields` (CSV de field IDs) como query
 * params para que el export respete los filtros activos.
 */
final class ExportController extends AbstractController
{
    public function __construct(
        private readonly CsvExporter $exporter,
        private readonly ListService $lists,
        private readonly PermissionService $permissions,
        private readonly FieldRepository $fields,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        register_rest_route($this->namespace, '/lists/(?P<list>[a-zA-Z0-9_-]+)/export', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'export'],
            'permission_callback' => $this->requireCapability(CapabilityRegistry::CAP_EXPORT_RECORDS),
        ]);
    }

    public function export(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        // Visibilidad: si el user no puede ver la lista, 404.
        $user = wp_get_current_user();
        if (! $this->permissions->userCanSeeList($user, $list)) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }

        $rawFieldIds = $request->get_param('fields');
        $fieldIds    = null;
        if (is_string($rawFieldIds) && $rawFieldIds !== '') {
            $fieldIds = array_values(array_filter(
                array_map('intval', explode(',', $rawFieldIds)),
                static fn (int $id): bool => $id > 0,
            ));
        }

        // Per-field permissions (Fase 16.A — fix bug S1): si el rol
        // del user tiene fields ocultos, los stripeamos del request.
        // Antes de este fix, un user podía pedir `?fields=<hidden_id>`
        // y obtener el campo en el CSV — bypass del feature de
        // permisos.
        $sanitizer = $this->permissions->sanitizerFor($user, $list);
        if (! $sanitizer->isNoop()) {
            $idToSlug = [];
            foreach ($this->fields->allForList($list->id) as $f) {
                $idToSlug[$f->id] = $f->slug;
            }
            if ($fieldIds !== null) {
                // El user pidió IDs específicos: filtramos a los
                // permitidos. Si la intersección queda vacía,
                // devolvemos 403 — el caller pidió SOLO campos
                // ocultos.
                $allowed = $sanitizer->filterAllowedFieldIds($fieldIds, $idToSlug);
                if ($allowed === []) {
                    return $this->forbidden(__('Los campos solicitados están ocultos para tu rol.', 'imagina-crm'));
                }
                $fieldIds = $allowed;
            } else {
                // No pidió IDs (=todos): explícitamente le pasamos
                // solo los visibles para que el exporter NO los
                // incluya por default.
                $allIds = array_keys($idToSlug);
                $fieldIds = $sanitizer->filterAllowedFieldIds($allIds, $idToSlug);
            }
        }

        $rawTree    = $request->get_param('filter_tree');
        $filterTree = null;
        if (is_string($rawTree) && $rawTree !== '') {
            $decoded = json_decode($rawTree, true);
            if (is_array($decoded) && ($decoded['type'] ?? '') === 'group') {
                $filterTree = $decoded;
            }
        }

        // Inyecta el scope de records del user — un agent con scope=own
        // NO debe exportar registros ajenos via CSV.
        $scope = $this->permissions->recordsScopeWhere($user, $list);
        $additionalWhere = $scope['sql'] === '' ? null : $scope;

        // Opciones de formato (Fase 15.B).
        $delimiter = (string) ($request->get_param('delimiter') ?? ',');
        $withBom   = $request->get_param('with_bom') === '1'
            || $request->get_param('with_bom') === true;

        $csv = $this->exporter->export(
            $list,
            $fieldIds,
            $filterTree,
            $additionalWhere,
            $delimiter,
            $withBom,
        );

        $filename = sprintf(
            '%s-%s.csv',
            $list->slug,
            gmdate('Ymd-His'),
        );

        // WordPress devuelve siempre JSON desde un controller REST. Para
        // emitir CSV directo (con headers correctos) tenemos que tomar
        // control del response stream antes de que core lo serialice.
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-store');
        header('Content-Length: ' . strlen($csv));
        echo $csv;
        exit;
    }
}
