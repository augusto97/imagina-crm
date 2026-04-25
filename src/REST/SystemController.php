<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Plugin;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Endpoints utilitarios: `/me` y `/field-types` (CLAUDE.md §9.2).
 *
 * `field-types` por ahora devuelve solo el catálogo declarativo. La fase
 * actual aún no instancia los `FieldTypeRegistry` reales — se entregan en
 * el commit de Fields. Mientras tanto, devolvemos los slugs y labels para
 * que el frontend ya pueda iterar la UI del field type picker.
 */
final class SystemController extends AbstractController
{
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

        // Catálogo declarativo (CLAUDE.md §8). El registry funcional llega en
        // el commit de Fields.
        $catalog = [
            ['slug' => 'text',         'label' => __('Texto', 'imagina-crm')],
            ['slug' => 'long_text',    'label' => __('Texto largo', 'imagina-crm')],
            ['slug' => 'number',       'label' => __('Número', 'imagina-crm')],
            ['slug' => 'currency',     'label' => __('Moneda', 'imagina-crm')],
            ['slug' => 'select',       'label' => __('Selección única', 'imagina-crm')],
            ['slug' => 'multi_select', 'label' => __('Selección múltiple', 'imagina-crm')],
            ['slug' => 'date',         'label' => __('Fecha', 'imagina-crm')],
            ['slug' => 'datetime',     'label' => __('Fecha y hora', 'imagina-crm')],
            ['slug' => 'checkbox',     'label' => __('Casilla', 'imagina-crm')],
            ['slug' => 'url',          'label' => __('URL', 'imagina-crm')],
            ['slug' => 'email',        'label' => __('Email', 'imagina-crm')],
            ['slug' => 'user',         'label' => __('Usuario', 'imagina-crm')],
            ['slug' => 'relation',     'label' => __('Relación', 'imagina-crm')],
            ['slug' => 'file',         'label' => __('Archivo', 'imagina-crm')],
        ];

        return new WP_REST_Response(['data' => $catalog]);
    }
}
