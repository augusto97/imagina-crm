<?php
declare(strict_types=1);

namespace ImaginaCRM;

use ImaginaCRM\Admin\AdminAssets;
use ImaginaCRM\Admin\AdminMenu;
use ImaginaCRM\Automations\ActionRegistry;
use ImaginaCRM\Automations\Actions\CallWebhookAction;
use ImaginaCRM\Automations\Actions\UpdateFieldAction;
use ImaginaCRM\Automations\AutomationEngine;
use ImaginaCRM\Automations\AutomationRepository;
use ImaginaCRM\Automations\AutomationRunRepository;
use ImaginaCRM\Automations\AutomationService;
use ImaginaCRM\Automations\TriggerContext;
use ImaginaCRM\Automations\TriggerRegistry;
use ImaginaCRM\Fields\FieldRepository;
use ImaginaCRM\Fields\FieldService;
use ImaginaCRM\Fields\FieldTypeRegistry;
use ImaginaCRM\Lists\ListEntity;
use ImaginaCRM\Lists\ListRepository;
use ImaginaCRM\Lists\ListService;
use ImaginaCRM\Licensing\LicenseHttpClient;
use ImaginaCRM\Licensing\LicenseManager;
use ImaginaCRM\Licensing\UpdaterClient;
use ImaginaCRM\Lists\SchemaManager;
use ImaginaCRM\Lists\SlugManager;
use ImaginaCRM\Records\QueryBuilder;
use ImaginaCRM\Records\RecordRepository;
use ImaginaCRM\Records\RecordService;
use ImaginaCRM\Records\RecordValidator;
use ImaginaCRM\Records\RelationRepository;
use ImaginaCRM\REST\RestBootstrap;
use ImaginaCRM\Support\Database;
use ImaginaCRM\Views\SavedViewRepository;
use ImaginaCRM\Views\SavedViewService;

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

        // Saved Views.
        $this->container->bind(SavedViewRepository::class, static function (Container $c): SavedViewRepository {
            return new SavedViewRepository($c->get(Database::class));
        });

        $this->container->bind(SavedViewService::class, static function (Container $c): SavedViewService {
            return new SavedViewService(
                $c->get(SavedViewRepository::class),
                $c->get(ListRepository::class),
            );
        });

        // Licensing + Updater.
        $this->container->bind(LicenseHttpClient::class, static function (): LicenseHttpClient {
            return new LicenseHttpClient();
        });

        $this->container->bind(LicenseManager::class, static function (Container $c): LicenseManager {
            return new LicenseManager($c->get(LicenseHttpClient::class));
        });

        $this->container->bind(UpdaterClient::class, static function (Container $c): UpdaterClient {
            return new UpdaterClient($c->get(LicenseManager::class));
        });

        // Automations (Fase 2).
        $this->container->bind(TriggerRegistry::class, static function (): TriggerRegistry {
            return new TriggerRegistry();
        });

        $this->container->bind(ActionRegistry::class, static function (Container $c): ActionRegistry {
            $registry = new ActionRegistry();
            // Acciones default: las que necesitan dependencias se construyen
            // aquí con servicios del container. Las que son puramente HTTP
            // (call_webhook) son `new` directo.
            $registry->register(new UpdateFieldAction($c->get(\ImaginaCRM\Records\RecordService::class)));
            $registry->register(new CallWebhookAction());
            return $registry;
        });

        $this->container->bind(AutomationRepository::class, static function (Container $c): AutomationRepository {
            return new AutomationRepository($c->get(Database::class));
        });

        $this->container->bind(AutomationRunRepository::class, static function (Container $c): AutomationRunRepository {
            return new AutomationRunRepository($c->get(Database::class));
        });

        $this->container->bind(AutomationService::class, static function (Container $c): AutomationService {
            return new AutomationService(
                $c->get(AutomationRepository::class),
                $c->get(ListRepository::class),
                $c->get(TriggerRegistry::class),
                $c->get(ActionRegistry::class),
            );
        });

        $this->container->bind(AutomationEngine::class, static function (Container $c): AutomationEngine {
            return new AutomationEngine(
                $c->get(AutomationRepository::class),
                $c->get(AutomationRunRepository::class),
                $c->get(TriggerRegistry::class),
                $c->get(ActionRegistry::class),
            );
        });
    }

    private function register(): void
    {
        add_action('init', [$this, 'loadTextdomain']);

        // REST se registra siempre (admin + frontend pueden consumirlo).
        $rest = new RestBootstrap($this->container);
        $rest->register();

        // Hook de cron diario para revalidar licencia. El registro en
        // sí (wp_schedule_event) lo hace `Installer` en activación.
        $licenses = $this->container->get(LicenseManager::class);
        if ($licenses instanceof LicenseManager) {
            add_action(LicenseManager::CRON_HOOK, [$licenses, 'dailyCheck']);
        }

        // Updater registra los filtros estándar de WP (transient + plugins_api).
        $updater = $this->container->get(UpdaterClient::class);
        if ($updater instanceof UpdaterClient) {
            $updater->register();
        }

        // Automations: el engine escucha los do_action que dispara
        // RecordService cuando se crean / actualizan registros.
        $engine = $this->container->get(AutomationEngine::class);
        if ($engine instanceof AutomationEngine) {
            add_action(
                'imagina_crm/record_created',
                static function (mixed $list, mixed $recordId, mixed $record, mixed $values) use ($engine): void {
                    if (! $list instanceof ListEntity) {
                        return;
                    }
                    unset($recordId, $values);
                    $engine->dispatch(new TriggerContext(
                        event: 'imagina_crm/record_created',
                        list: $list,
                        record: is_array($record) ? $record : null,
                    ));
                },
                10,
                4,
            );

            add_action(
                'imagina_crm/record_updated',
                static function (mixed $list, mixed $recordId, mixed $newRecord, mixed $previous) use ($engine): void {
                    if (! $list instanceof ListEntity) {
                        return;
                    }
                    unset($recordId);
                    $engine->dispatch(new TriggerContext(
                        event: 'imagina_crm/record_updated',
                        list: $list,
                        record: is_array($newRecord) ? $newRecord : null,
                        previousRecord: is_array($previous) ? $previous : null,
                    ));
                },
                10,
                4,
            );
        }

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
