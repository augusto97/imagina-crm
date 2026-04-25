<?php
declare(strict_types=1);

namespace ImaginaCRM\Admin;

use ImaginaCRM\Plugin;

/**
 * Registra y enqueuea los assets del admin SPA generados por Vite.
 *
 * Lee `dist/.vite/manifest.json` para resolver entradas + chunks. Sólo se
 * enqueuean cuando estamos en la página del plugin (`?page=imagina-crm`),
 * cumpliendo el contrato de rendimiento "impacto ≤ 15ms en TTFB" del resto
 * del wp-admin.
 */
final class AdminAssets
{
    private const HANDLE   = 'imagina-crm-admin';
    private const ENTRY    = 'app/main.tsx';
    private const MANIFEST = 'dist/manifest.json';

    public function register(): void
    {
        add_action('admin_enqueue_scripts', [$this, 'maybeEnqueue']);
    }

    public function maybeEnqueue(string $hookSuffix): void
    {
        if (! $this->isPluginPage($hookSuffix)) {
            return;
        }

        $manifest = $this->loadManifest();

        if ($manifest === null) {
            add_action('admin_notices', [$this, 'renderBuildMissingNotice']);
            return;
        }

        $entry = $manifest[self::ENTRY] ?? null;

        if (! is_array($entry) || ! isset($entry['file']) || ! is_string($entry['file'])) {
            add_action('admin_notices', [$this, 'renderBuildMissingNotice']);
            return;
        }

        $distUrl = trailingslashit(IMAGINA_CRM_URL . 'dist');

        wp_enqueue_script(
            self::HANDLE,
            $distUrl . $entry['file'],
            [],
            Plugin::VERSION,
            true
        );

        wp_script_add_data(self::HANDLE, 'type', 'module');

        if (isset($entry['css']) && is_array($entry['css'])) {
            foreach ($entry['css'] as $index => $cssFile) {
                if (! is_string($cssFile)) {
                    continue;
                }
                wp_enqueue_style(
                    self::HANDLE . '-' . (int) $index,
                    $distUrl . $cssFile,
                    [],
                    Plugin::VERSION
                );
            }
        }

        wp_localize_script(self::HANDLE, 'IMAGINA_CRM_BOOT', $this->bootData());
    }

    public function renderBuildMissingNotice(): void
    {
        echo '<div class="notice notice-error"><p>';
        echo esc_html__(
            'Imagina CRM: el bundle del admin no está construido. Ejecuta "npm install && npm run build" en el directorio del plugin.',
            'imagina-crm'
        );
        echo '</p></div>';
    }

    /**
     * @return array<string, mixed>
     */
    private function bootData(): array
    {
        $user = wp_get_current_user();

        return [
            'version'   => Plugin::VERSION,
            'rootId'    => 'imcrm-root',
            'restRoot'  => esc_url_raw(rest_url('imagina-crm/v1')),
            'restNonce' => wp_create_nonce('wp_rest'),
            'adminUrl'  => esc_url_raw(admin_url('admin.php?page=' . Plugin::ADMIN_PAGE)),
            'assetsUrl' => esc_url_raw(IMAGINA_CRM_URL . 'dist/'),
            'locale'    => str_replace('_', '-', get_user_locale()),
            'timezone'  => wp_timezone_string(),
            'user'      => [
                'id'           => $user->ID,
                'displayName'  => $user->display_name,
                'avatar'       => get_avatar_url($user->ID, ['size' => 64]) ?: '',
                'capabilities' => [
                    'manage_options' => current_user_can('manage_options'),
                ],
            ],
        ];
    }

    private function isPluginPage(string $hookSuffix): bool
    {
        if ($hookSuffix === 'toplevel_page_' . Plugin::ADMIN_PAGE) {
            return true;
        }

        return isset($_GET['page']) && $_GET['page'] === Plugin::ADMIN_PAGE; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
    }

    /**
     * @return array<string, array<string, mixed>>|null
     */
    private function loadManifest(): ?array
    {
        $path = IMAGINA_CRM_DIR . self::MANIFEST;

        if (! is_readable($path)) {
            return null;
        }

        $contents = file_get_contents($path);

        if ($contents === false) {
            return null;
        }

        $decoded = json_decode($contents, true);

        if (! is_array($decoded)) {
            return null;
        }

        /** @var array<string, array<string, mixed>> $decoded */
        return $decoded;
    }
}
