<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Activity\ActivityEntity;
use ImaginaCRM\Activity\ActivityRepository;
use ImaginaCRM\Lists\ListService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Endpoints de sólo-lectura para el activity log:
 * - `/lists/{list}/records/{record}/activity` — timeline de un record.
 * - `/lists/{list}/activity` — timeline global de la lista (sin filtrar
 *   por record).
 *
 * El log es append-only desde el `ActivityLogger`; aquí no exponemos
 * mutaciones intencionalmente.
 */
final class ActivityController extends AbstractController
{
    public const DEFAULT_LIMIT = 50;
    public const MAX_LIMIT     = 200;

    public function __construct(
        private readonly ActivityRepository $repo,
        private readonly ListService $lists,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        $listBase = 'lists/(?P<list>[a-zA-Z0-9_-]+)';

        register_rest_route($this->namespace, '/' . $listBase . '/records/(?P<record>\d+)/activity', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'getRecordActivity'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
            'args'                => [
                'limit'  => ['type' => 'integer', 'default' => self::DEFAULT_LIMIT],
                'offset' => ['type' => 'integer', 'default' => 0],
            ],
        ]);

        register_rest_route($this->namespace, '/' . $listBase . '/activity', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'getListActivity'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
            'args'                => [
                'limit'  => ['type' => 'integer', 'default' => self::DEFAULT_LIMIT],
                'offset' => ['type' => 'integer', 'default' => 0],
            ],
        ]);
    }

    public function getRecordActivity(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        $recordId = (int) $request->get_param('record');
        [$limit, $offset] = $this->parsePaging($request);

        $items = array_map(
            static fn (ActivityEntity $a): array => $a->toArray(),
            $this->repo->recentForRecord($list->id, $recordId, $limit, $offset),
        );
        return new WP_REST_Response(['data' => $items]);
    }

    public function getListActivity(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('list'));
        if ($list === null) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        [$limit, $offset] = $this->parsePaging($request);

        $items = array_map(
            static fn (ActivityEntity $a): array => $a->toArray(),
            $this->repo->recentForList($list->id, $limit, $offset),
        );
        return new WP_REST_Response(['data' => $items]);
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function parsePaging(WP_REST_Request $request): array
    {
        $limit  = max(1, min(self::MAX_LIMIT, (int) ($request->get_param('limit') ?? self::DEFAULT_LIMIT)));
        $offset = max(0, (int) ($request->get_param('offset') ?? 0));
        return [$limit, $offset];
    }
}
