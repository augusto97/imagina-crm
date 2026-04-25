<?php
declare(strict_types=1);

namespace ImaginaCRM;

use ImaginaCRM\Admin\AdminAssets;
use ImaginaCRM\Admin\AdminMenu;

/**
 * Bootstrap principal del plugin.
 *
 * Mantiene el container DI compartido y registra los servicios mínimos
 * necesarios en Fase 0 (admin shell). Servicios de listas, fields, records,
 * REST, etc. se registrarán en fases siguientes.
 */
final class Plugin
{
    public const VERSION       = IMAGINA_CRM_VERSION;
    public const TEXT_DOMAIN   = IMAGINA_CRM_TEXT_DOMAIN;
    public const DB_VERSION    = IMAGINA_CRM_DB_VERSION;
    public const ADMIN_PAGE    = 'imagina-crm';
    public const ADMIN_CAPABILITY = 'manage_options';

    private static ?self $instance = null;

    private Container $container;

    private function __construct()
    {
        $this->container = new Container();
        $this->container->instance(Container::class, $this->container);
    }

    public static function boot(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
            self::$instance->register();
        }

        return self::$instance;
    }

    public static function instance(): self
    {
        return self::boot();
    }

    public function container(): Container
    {
        return $this->container;
    }

    public function dir(): string
    {
        return IMAGINA_CRM_DIR;
    }

    public function url(): string
    {
        return IMAGINA_CRM_URL;
    }

    private function register(): void
    {
        add_action('init', [$this, 'loadTextdomain']);

        if (is_admin()) {
            $this->registerAdmin();
        }

        /**
         * Hook para que módulos externos (o futuras fases del plugin) registren
         * sus propios servicios contra el container compartido.
         */
        do_action('imagina_crm/booted', $this);
    }

    private function registerAdmin(): void
    {
        $assets = $this->container->get(AdminAssets::class);
        $menu   = $this->container->get(AdminMenu::class);

        if ($assets instanceof AdminAssets) {
            $assets->register();
        }

        if ($menu instanceof AdminMenu) {
            $menu->register();
        }
    }

    public function loadTextdomain(): void
    {
        load_plugin_textdomain(
            self::TEXT_DOMAIN,
            false,
            dirname(IMAGINA_CRM_BASENAME) . '/languages'
        );
    }
}
