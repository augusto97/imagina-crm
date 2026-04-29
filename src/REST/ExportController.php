<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Exports\CsvExporter;
use ImaginaCRM\Lists\ListService;
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
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        register_rest_route($this->namespace, '/lists/(?P<list>[a-zA-Z0-9_-]+)/export', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'export'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
        ]);
    }

    public function export(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
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

        $rawTree    = $request->get_param('filter_tree');
        $filterTree = null;
        if (is_string($rawTree) && $rawTree !== '') {
            $decoded = json_decode($rawTree, true);
            if (is_array($decoded) && ($decoded['type'] ?? '') === 'group') {
                $filterTree = $decoded;
            }
        }

        $csv = $this->exporter->export($list, $fieldIds, $filterTree);

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
