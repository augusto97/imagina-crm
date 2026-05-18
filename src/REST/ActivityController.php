<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Activity\ActivityEntity;
use ImaginaCRM\Activity\ActivityRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Permissions\PermissionService;
use ImaginaCRM\Records\RecordService;
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
        private readonly RecordService $records,
        private readonly PermissionService $permissions,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        $listBase = 'lists/(?P<list>[a-zA-Z0-9_-]+)';

        $canRead = $this->requireAnyCapability(
            CapabilityRegistry::CAP_VIEW_RECORDS,
            CapabilityRegistry::CAP_VIEW_OWN_RECORDS,
        );

        register_rest_route($this->namespace, '/' . $listBase . '/records/(?P<record>\d+)/activity', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'getRecordActivity'],
            'permission_callback' => $canRead,
            'args'                => [
                'limit'  => ['type' => 'integer', 'default' => self::DEFAULT_LIMIT],
                'offset' => ['type' => 'integer', 'default' => 0],
            ],
        ]);

        register_rest_route($this->namespace, '/' . $listBase . '/activity', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'getListActivity'],
            'permission_callback' => $canRead,
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
        $user = wp_get_current_user();
        if (! $this->permissions->userCanSeeList($user, $list)) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        $recordId = (int) $request->get_param('record');
        $record   = $this->records->find($list, $recordId);
        // Per-record visibility: si no puede ver el record, no ve su
        // actividad. 404 (no 403) para no revelar la existencia.
        if ($record === null || ! $this->permissions->userCanViewRecord($user, $list, $record)) {
            return $this->notFound();
        }
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
        $user = wp_get_current_user();
        if (! $this->permissions->userCanSeeList($user, $list)) {
            return $this->notFound(__('Lista no encontrada.', 'imagina-crm'));
        }
        // Para no-admins con scope acotado (own/assigned), el activity
        // log de la lista completa puede exponer eventos sobre records
        // ajenos. Si el user no es plugin-admin Y su scope != all,
        // bloqueamos el endpoint (la timeline per-record sigue
        // disponible para los records que sí puede ver).
        if (
            ! $this->permissions->userIsPluginAdmin($user)
            && $this->permissions->recordsScopeWhere($user, $list)['sql'] !== ''
        ) {
            return $this->forbidden(__('Tu rol no permite ver la actividad global de la lista.', 'imagina-crm'));
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
