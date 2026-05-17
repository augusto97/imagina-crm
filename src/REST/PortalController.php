<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Permissions\CapabilityRegistry;
use ImaginaCRM\Portal\ClientResolverInterface;
use ImaginaCRM\Portal\PortalAccountManager;
use ImaginaCRM\Portal\PortalScopeService;
use ImaginaCRM\Portal\PortalTemplate;
use ImaginaCRM\Records\RecordAggregator;
use ImaginaCRM\Records\RecordService;
use ImaginaCRM\Support\ValidationResult;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST controllers del portal del cliente (Fase 9 — 3.B).
 *
 * Endpoints (todos requieren cap `imcrm_access_portal` — `crm_client`
 * la tiene por default desde Fase 7):
 *
 *   GET /imagina-crm/v1/portal/me
 *       Devuelve el record del cliente actual + metadata del portal
 *       (template_id por configurar, etc.). 404 si el user no tiene
 *       record asociado en la lista de portal.
 *
 *   GET /imagina-crm/v1/portal/lists/{slug}/records
 *       Records de una lista visibles para el cliente. El scope SQL
 *       de PortalScopeService se inyecta automáticamente — el cliente
 *       NO puede ver records ajenos aunque la lista sea conocida.
 *
 *   GET /imagina-crm/v1/portal/lists/{slug}/records/{id}
 *       Detalle de un record. 404 si no está en el scope del cliente.
 *
 * Esta superficie es la que la SPA del portal (`app/portal.tsx`,
 * llega en Fase 9 — 3.F) consume. NO usa los endpoints del admin
 * (`/v1/lists/.../records`) porque esos exigen capabilities que el
 * cliente no tiene.
 */
final class PortalController extends AbstractController
{
    public function __construct(
        private readonly ClientResolverInterface $resolver,
        private readonly PortalScopeService $scope,
        private readonly ListService $lists,
        private readonly RecordService $records,
        private readonly FieldRepository $fields,
        private readonly PortalAccountManager $accounts,
        private readonly RecordAggregator $aggregator,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        $canAccess = $this->requireCapability(CapabilityRegistry::CAP_ACCESS_PORTAL);

        register_rest_route($this->namespace, '/portal/me', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'getMe'],
                'permission_callback' => $canAccess,
            ],
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [$this, 'updateMe'],
                'permission_callback' => $canAccess,
                'args'                => [
                    'fields' => [
                        'type'        => 'object',
                        'description' => 'Mapa slug → valor. Solo se aceptan slugs declarados en algún bloque editable_form del template.',
                    ],
                ],
            ],
        ]);

        register_rest_route(
            $this->namespace,
            '/portal/lists/(?P<slug>[a-zA-Z0-9_-]+)/records',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'getRecords'],
                'permission_callback' => $canAccess,
                'args'                => [
                    'slug'     => ['type' => 'string'],
                    'page'     => ['type' => 'integer', 'default' => 1],
                    'per_page' => ['type' => 'integer', 'default' => 20],
                    'sort'     => ['type' => 'string'],
                    'search'   => ['type' => 'string'],
                ],
            ],
        );

        register_rest_route(
            $this->namespace,
            '/portal/lists/(?P<slug>[a-zA-Z0-9_-]+)/records/(?P<id>\d+)',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'getRecord'],
                'permission_callback' => $canAccess,
            ],
        );

        // Aggregates de records relacionados al cliente (Fase 9 — 3.E).
        // Sirve a los bloques kpi_widget del template del portal. El
        // scope SQL del PortalScopeService se inyecta automáticamente
        // — el cliente nunca ve agregados sobre records ajenos.
        register_rest_route(
            $this->namespace,
            '/portal/lists/(?P<slug>[a-zA-Z0-9_-]+)/aggregates',
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'getAggregates'],
                'permission_callback' => $canAccess,
                'args'                => [
                    'fields' => ['type' => 'string', 'description' => 'CSV de field IDs a agregar.'],
                ],
            ],
        );

        // Endpoint admin: crear cuenta WP para un cliente desde el CRM
        // (Fase 9 — 3.G). Requiere manage_lists — solo admins crean
        // accesos.
        register_rest_route(
            $this->namespace,
            '/portal/lists/(?P<slug>[a-zA-Z0-9_-]+)/records/(?P<id>\d+)/access',
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [$this, 'createAccess'],
                'permission_callback' => $this->requireCapability(CapabilityRegistry::CAP_MANAGE_LISTS),
                'args'                => [
                    'send_notification' => ['type' => 'boolean', 'default' => true],
                ],
            ],
        );
    }

    /**
     * PATCH /portal/me
     *
     * Permite al cliente actualizar SU PROPIO record. Solo se aceptan
     * slugs declarados en algún bloque `editable_form` del template
     * configurado por el admin. Cualquier slug fuera de la whitelist
     * → 403.
     *
     * Es el endpoint de mutación más sensible del portal — un bug
     * acá significa que un cliente puede tamper con campos que no
     * debería tocar (ej. estado de un trámite que solo el admin
     * cambia).
     */
    public function updateMe(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $user = wp_get_current_user();
        $portalList = $this->resolver->portalList();
        if ($portalList === null) {
            return $this->notFound(__('El portal del cliente no está configurado.', 'imagina-crm'));
        }
        $clientRecord = $this->resolver->clientRecordFor($user);
        if ($clientRecord === null) {
            return $this->notFound();
        }
        $recordId = isset($clientRecord['id']) ? (int) $clientRecord['id'] : 0;
        if ($recordId <= 0) {
            return $this->notFound();
        }

        // Whitelist desde el template configurado (no el default —
        // el default no incluye `editable_form`, así que un cliente
        // sin template explícito no puede editar nada).
        $template = PortalTemplate::fromListSettings($portalList->settings);
        $allowed = array_flip($template->editableFieldSlugs());
        if ($allowed === []) {
            return $this->forbidden(__('Tu portal no permite edición de campos.', 'imagina-crm'));
        }

        $params = $request->get_json_params();
        if (! is_array($params)) {
            $params = $request->get_params();
        }
        $fieldsIn = is_array($params['fields'] ?? null) ? $params['fields'] : [];
        if ($fieldsIn === []) {
            return $this->validationError(ValidationResult::failWith(
                'fields',
                __('No se enviaron cambios.', 'imagina-crm'),
            ));
        }

        // Filtra: solo slugs en whitelist. Cualquier slug fuera lo
        // rechazamos con 403 — error explícito, no silencioso, para
        // evitar que un cliente piense que "guardó" un campo que el
        // backend ignoró.
        $cleanValues = [];
        foreach ($fieldsIn as $slug => $value) {
            if (! is_string($slug)) {
                continue;
            }
            if (! isset($allowed[$slug])) {
                return $this->forbidden(
                    /* translators: %s: field slug */
                    sprintf(__('No tienes permiso para editar el campo "%s".', 'imagina-crm'), $slug),
                );
            }
            $cleanValues[$slug] = $value;
        }
        if ($cleanValues === []) {
            return $this->validationError(ValidationResult::failWith(
                'fields',
                __('No se enviaron cambios válidos.', 'imagina-crm'),
            ));
        }

        $result = $this->records->update($portalList, $recordId, $cleanValues);
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }

        return new WP_REST_Response(['data' => $result]);
    }

    /**
     * GET /portal/lists/{slug}/aggregates?fields=1,2,3
     *
     * Aggregates de records relacionados al cliente. Reutiliza el
     * `RecordAggregator` con el scope SQL del portal inyectado vía
     * `additionalWhere` — los totales son SIEMPRE solo del cliente
     * actual.
     */
    public function getAggregates(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('slug'));
        if ($list === null) {
            return $this->notFound();
        }

        $user = wp_get_current_user();
        $scope = $this->scope->recordsScopeWhere($user, $list);
        // El portal nunca otorga ver-todo; si por algún edge el scope
        // está vacío (no debería), bloqueamos como defensa adicional.
        if ($scope['sql'] === '') {
            return new WP_REST_Response(['data' => ['totals' => [], 'groups' => []]]);
        }

        $rawFields = (string) ($request->get_param('fields') ?? '');
        $fieldIds = array_values(array_filter(
            array_map('intval', explode(',', $rawFields)),
            static fn (int $id): bool => $id > 0,
        ));
        if ($fieldIds === []) {
            return new WP_REST_Response(['data' => ['totals' => [], 'groups' => []]]);
        }

        $result = $this->aggregator->aggregate(
            $list,
            $fieldIds,
            null,    // sin filterTree extra — solo el scope del portal.
            null,    // sin groupBy.
            $scope,
        );
        return new WP_REST_Response(['data' => $result]);
    }

    /**
     * POST /portal/lists/{slug}/records/{id}/access
     *
     * Crea (o reactiva) la cuenta WP del cliente y la asocia al record.
     * Cap requerida: imcrm_manage_lists.
     */
    public function createAccess(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('slug'));
        if ($list === null) {
            return $this->notFound();
        }
        $recordId = (int) $request->get_param('id');
        if ($recordId <= 0) {
            return $this->notFound();
        }
        $send = (bool) $request->get_param('send_notification');

        $result = $this->accounts->createAccessFor($list, $recordId, $send);
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }

        return new WP_REST_Response(['data' => $result], 201);
    }

    public function getMe(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        unset($request);
        $user = wp_get_current_user();

        $portalList = $this->resolver->portalList();
        if ($portalList === null) {
            return $this->notFound(__('El portal del cliente no está configurado.', 'imagina-crm'));
        }

        $clientRecord = $this->resolver->clientRecordFor($user);
        if ($clientRecord === null) {
            return $this->notFound(__('Tu cuenta aún no está asociada a un cliente.', 'imagina-crm'));
        }

        // Refetch hidratado vía RecordService para que el cliente
        // reciba fields + relations en el shape estándar.
        $clientId = isset($clientRecord['id']) ? (int) $clientRecord['id'] : 0;
        $hydrated = $clientId > 0 ? $this->records->find($portalList, $clientId) : null;
        if ($hydrated === null) {
            return $this->notFound();
        }

        // Template del portal: si la lista de portal tiene
        // `settings.portal_template` configurado, lo usamos. Sino,
        // generamos uno default con los fields del record cliente
        // (cero-config, "out-of-the-box").
        $template = PortalTemplate::fromListSettings($portalList->settings);
        if ($template->isEmpty()) {
            $portalFields = $this->fields->allForList($portalList->id);
            $template = PortalTemplate::defaultFor($portalFields);
        }

        return new WP_REST_Response([
            'data' => [
                'list'   => [
                    'id'   => $portalList->id,
                    'slug' => $portalList->slug,
                    'name' => $portalList->name,
                ],
                'record' => $hydrated,
                'user'   => [
                    'id'           => $user->ID,
                    'display_name' => $user->display_name,
                    'email'        => $user->user_email,
                ],
                'template' => ['blocks' => $template->toArray()],
            ],
        ]);
    }

    public function getRecords(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('slug'));
        if ($list === null) {
            return $this->notFound();
        }

        $user = wp_get_current_user();
        $scope = $this->scope->recordsScopeWhere($user, $list);

        // Si el scope ya bloquea todo (1=0), igual seguimos la query —
        // el cliente recibe `data: []` y el meta apropiado. Más
        // predecible para el frontend que un 404.

        $page    = max(1, (int) ($request->get_param('page') ?? 1));
        $perPage = max(1, min(100, (int) ($request->get_param('per_page') ?? 20)));
        $sort    = $this->parseSort($request->get_param('sort'));
        $search  = $request->get_param('search');
        $search  = is_string($search) ? $search : null;

        $result = $this->records->list(
            list:            $list,
            filters:         [],
            sort:            $sort,
            fields:          [],
            search:          $search,
            page:            $page,
            perPage:         $perPage,
            filterTree:      null,
            cursor:          null,
            additionalWhere: $scope,
        );
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }

        return new WP_REST_Response($result);
    }

    public function getRecord(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $list = $this->lists->findByIdOrSlug((string) $request->get_param('slug'));
        if ($list === null) {
            return $this->notFound();
        }

        $recordId = (int) $request->get_param('id');
        if ($recordId <= 0) {
            return $this->notFound();
        }

        $user = wp_get_current_user();
        $scope = $this->scope->recordsScopeWhere($user, $list);

        // Estrategia para visibility per-record: cargamos el record
        // por id directamente y verificamos contra el scope. Más eficiente
        // que ejecutar list() con un filtro de id (que pasaría por todo
        // el pipeline). El scope se evalúa mentalmente:
        //  - Lista de portal: scope['args'][0] DEBE ser el id pedido.
        //  - Lista con user field: el record DEBE tener user_id == col.
        //  - Lista con relation: tenemos que mirar la tabla relations.
        //  - Lista sin vínculo: 1=0 → siempre 404.
        //
        // Para 3.B simplificamos: usamos `list()` con additionalWhere
        // del scope + un filtro extra `id=%d`. Es UN solo round-trip
        // y reusa toda la lógica del QueryBuilder.
        $additional = $this->mergeScopeWithIdFilter($scope, $recordId);
        $result = $this->records->list(
            list:            $list,
            filters:         [],
            sort:            [],
            fields:          [],
            search:          null,
            page:            1,
            perPage:         1,
            filterTree:      null,
            cursor:          null,
            additionalWhere: $additional,
        );
        if ($result instanceof ValidationResult || ! isset($result['data'][0])) {
            return $this->notFound();
        }

        return new WP_REST_Response(['data' => $result['data'][0]]);
    }

    /**
     * Concatena la cláusula del scope con un filtro de id específico.
     * Resultado: `AND id = %d <scope.sql>` con args `[id, ...scope.args]`.
     *
     * @param array{sql: string, args: list<mixed>} $scope
     * @return array{sql: string, args: list<mixed>}
     */
    private function mergeScopeWithIdFilter(array $scope, int $recordId): array
    {
        $sql = 'AND `id` = %d';
        $args = [$recordId];
        if ($scope['sql'] !== '') {
            $sql .= ' ' . $scope['sql'];
            foreach ($scope['args'] as $a) {
                $args[] = $a;
            }
        }
        return ['sql' => $sql, 'args' => $args];
    }

    /**
     * @param mixed $raw
     * @return list<array{slug:string, dir:string}>
     */
    private function parseSort(mixed $raw): array
    {
        if (! is_string($raw) || $raw === '') {
            return [];
        }
        $out = [];
        foreach (explode(',', $raw) as $piece) {
            $parts = explode(':', trim($piece), 2);
            $slug = trim($parts[0] ?? '');
            $dir = strtolower(trim($parts[1] ?? 'asc'));
            if ($slug !== '') {
                $out[] = ['slug' => $slug, 'dir' => $dir === 'desc' ? 'desc' : 'asc'];
            }
        }
        return $out;
    }
}
