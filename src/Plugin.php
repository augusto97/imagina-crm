<?php
declare(strict_types=1);

namespace ImaginaCRM;

use ImaginaCRM\Admin\AdminAssets;
use ImaginaCRM\Admin\AdminMenu;
use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Lists\SchemaManager;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Records\QueryBuilder;
use ImaginaCRM\Records\RecordRepository;
use ImaginaCRM\Records\RecordService;
use ImaginaCRM\Records\RecordValidator;
use ImaginaCRM\Records\RelationRepository;
use ImaginaCRM\REST\RestBootstrap;
use ImaginaCRM\Support\Database;

/**
 * Bootstrap principal del plugin.
 *
 * Mantiene el container DI compartido y registra los servicios necesarios.
 * En esta fase ya se cablean SchemaManager, SlugManager, listas y la capa
 * REST. Fields y Records llegan en commits siguientes.
 */
final class Plugin
{
    public const VERSION          = IMAGINA_CRM_VERSION;
    public const TEXT_DOMAIN      = IMAGINA_CRM_TEXT_DOMAIN;
    public const DB_VERSION       = IMAGINA_CRM_DB_VERSION;
    public const ADMIN_PAGE       = 'imagina-crm';
    public const ADMIN_CAPABILITY = 'manage_options';

    private static ?self $instance = null;

    private Container $container;

    private function __construct()
    {
        $this->container = new Container();
        $this->container->instance(Container::class, $this->container);
        $this->bindServices();
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

    private function bindServices(): void
    {
        // Database wrapper sobre wpdb global. Se resuelve perezosamente para
        // que `init` ya tenga $wpdb disponible.
        $this->container->bind(Database::class, static function (): Database {
            global $wpdb;
            return new Database($wpdb);
        });

        // SchemaManager y SlugManager dependen sólo de Database.
        $this->container->bind(SchemaManager::class, static function (Container $c): SchemaManager {
            return new SchemaManager($c->get(Database::class));
        });

        $this->container->bind(SlugManager::class, static function (Container $c): SlugManager {
            return new SlugManager($c->get(Database::class));
        });

        // Lists.
        $this->container->bind(ListRepository::class, static function (Container $c): ListRepository {
            return new ListRepository($c->get(Database::class));
        });

        $this->container->bind(ListService::class, static function (Container $c): ListService {
            return new ListService(
                $c->get(ListRepository::class),
                $c->get(SlugManager::class),
                $c->get(SchemaManager::class),
            );
        });

        // Field type registry: singleton; los 14 tipos default se registran
        // en su constructor.
        $this->container->bind(FieldTypeRegistry::class, static function (): FieldTypeRegistry {
            return new FieldTypeRegistry();
        });

        $this->container->bind(FieldRepository::class, static function (Container $c): FieldRepository {
            return new FieldRepository($c->get(Database::class));
        });

        $this->container->bind(FieldService::class, static function (Container $c): FieldService {
            return new FieldService(
                $c->get(FieldRepository::class),
                $c->get(ListRepository::class),
                $c->get(SlugManager::class),
                $c->get(SchemaManager::class),
                $c->get(FieldTypeRegistry::class),
            );
        });

        // Records.
        $this->container->bind(RecordRepository::class, static function (Container $c): RecordRepository {
            return new RecordRepository($c->get(Database::class));
        });

        $this->container->bind(RelationRepository::class, static function (Container $c): RelationRepository {
            return new RelationRepository($c->get(Database::class));
        });

        $this->container->bind(RecordValidator::class, static function (Container $c): RecordValidator {
            return new RecordValidator($c->get(FieldTypeRegistry::class), $c->get(Database::class));
        });

        $this->container->bind(QueryBuilder::class, static function (Container $c): QueryBuilder {
            return new QueryBuilder($c->get(Database::class), $c->get(SlugManager::class));
        });

        $this->container->bind(RecordService::class, static function (Container $c): RecordService {
            return new RecordService(
                $c->get(FieldRepository::class),
                $c->get(RecordRepository::class),
                $c->get(RelationRepository::class),
                $c->get(RecordValidator::class),
                $c->get(QueryBuilder::class),
            );
        });
    }

    private function register(): void
    {
        add_action('init', [$this, 'loadTextdomain']);

        // REST se registra siempre (admin + frontend pueden consumirlo).
        $rest = new RestBootstrap($this->container);
        $rest->register();

        if (is_admin()) {
            $this->registerAdmin();
        }

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
