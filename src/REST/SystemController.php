<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Activity\ActivityEntity;
use ImaginaCRM\Activity\ActivityLogger;
use ImaginaCRM\Activity\ActivityRepository;
use ImaginaCRM\Automations\ActionRegistry;
use ImaginaCRM\Automations\TriggerRegistry;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Plugin;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Endpoints utilitarios: `/me`, `/field-types`, `/triggers` y `/actions`.
 *
 * Estos cuatro endpoints son catálogos de solo lectura que el frontend
 * consume para construir UI dinámica (selectores de tipo, builder de
 * automatizaciones, etc.). Se sirven desde los registries reales.
 */
final class SystemController extends AbstractController
{
    public function __construct(
        private readonly FieldTypeRegistry $fieldTypes,
        private readonly TriggerRegistry $triggers,
        private readonly ActionRegistry $actions,
        private readonly ActivityRepository $activity,
    ) {
        parent::__construct();
    }

    public function register_routes(): void
    {
        register_rest_route($this->namespace, '/me', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'me'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
        ]);

        register_rest_route($this->namespace, '/field-types', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'fieldTypes'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
        ]);

        register_rest_route($this->namespace, '/triggers', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'triggerTypes'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
        ]);

        register_rest_route($this->namespace, '/actions', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'actionTypes'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
        ]);

        register_rest_route($this->namespace, '/me/mentions', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'myMentions'],
            'permission_callback' => [$this, 'checkAdminPermissions'],
            'args'                => [
                'limit'  => ['type' => 'integer', 'default' => 50],
                'offset' => ['type' => 'integer', 'default' => 0],
            ],
        ]);
    }

    public function me(WP_REST_Request $request): WP_REST_Response
    {
        unset($request);
        $user = wp_get_current_user();

        return new WP_REST_Response([
            'data' => [
                'id'           => $user->ID,
                'display_name' => $user->display_name,
                'email'        => $user->user_email,
                'locale'       => get_user_locale($user),
                'capabilities' => [
                    'manage_options' => current_user_can(Plugin::ADMIN_CAPABILITY),
                ],
            ],
        ]);
    }

    public function fieldTypes(WP_REST_Request $request): WP_REST_Response
    {
        unset($request);
        return new WP_REST_Response(['data' => $this->fieldTypes->toArray()]);
    }

    public function triggerTypes(WP_REST_Request $request): WP_REST_Response
    {
        unset($request);
        return new WP_REST_Response(['data' => $this->triggers->toArray()]);
    }

    public function actionTypes(WP_REST_Request $request): WP_REST_Response
    {
        unset($request);
        return new WP_REST_Response(['data' => $this->actions->toArray()]);
    }

    public function myMentions(WP_REST_Request $request): WP_REST_Response
    {
        $limit  = max(1, min(200, (int) ($request->get_param('limit') ?? 50)));
        $offset = max(0, (int) ($request->get_param('offset') ?? 0));

        $items = array_map(
            static fn (ActivityEntity $a): array => $a->toArray(),
            $this->activity->recentForUser(
                get_current_user_id(),
                ActivityLogger::ACTION_MENTION_RECEIVED,
                $limit,
                $offset,
            ),
        );
        return new WP_REST_Response(['data' => $items]);
    }
}
