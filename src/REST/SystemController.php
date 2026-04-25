<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

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
}
