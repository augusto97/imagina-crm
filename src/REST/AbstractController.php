<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\Plugin;
use ImaginaCRM\Support\ValidationResult;
use WP_Error;
use WP_REST_Controller;
use WP_REST_Request;

/**
 * Base para todos los controllers REST del plugin.
 *
 * Establece el namespace `imagina-crm/v1`, helpers de capability check y
 * conversión `ValidationResult` → `WP_Error` con shape consistente
 * `{code, message, data: {status, errors?}}` (CLAUDE.md §9).
 */
abstract class AbstractController extends WP_REST_Controller
{
    public const NAMESPACE = 'imagina-crm/v1';

    public function __construct()
    {
        $this->namespace = self::NAMESPACE;
    }

    /**
     * Permission callback estándar para endpoints administrativos.
     *
     * @return bool|WP_Error
     */
    public function checkAdminPermissions(WP_REST_Request $request): bool|WP_Error
    {
        unset($request);

        if (! current_user_can(Plugin::ADMIN_CAPABILITY)) {
            return new WP_Error(
                'imcrm_forbidden',
                __('No tienes permiso para realizar esta acción.', 'imagina-crm'),
                ['status' => rest_authorization_required_code()]
            );
        }

        return true;
    }

    protected function validationError(ValidationResult $validation, int $status = 422): WP_Error
    {
        return new WP_Error(
            'imcrm_validation_failed',
            $validation->firstError() ?? __('Validación fallida.', 'imagina-crm'),
            [
                'status' => $status,
                'errors' => $validation->errors(),
            ]
        );
    }

    protected function notFound(string $message = ''): WP_Error
    {
        return new WP_Error(
            'imcrm_not_found',
            $message !== '' ? $message : __('Recurso no encontrado.', 'imagina-crm'),
            ['status' => 404]
        );
    }

    protected function conflict(string $message): WP_Error
    {
        return new WP_Error('imcrm_conflict', $message, ['status' => 409]);
    }
}
