<?php
declare(strict_types=1);

namespace ImaginaCRM\REST;

use ImaginaCRM\PublicLists\PublicListService;
use ImaginaCRM\Support\ValidationResult;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST público (Fase 8 — 2.A): endpoints anónimos para listas que el
 * admin marcó como `settings.public.enabled = true`.
 *
 * Namespace separado del admin para hacer explícita la separación de
 * superficies:
 *   - `/imagina-crm/v1/...`         → admin (cookie WP + nonce, capabilities).
 *   - `/imagina-crm/v1/public/...`  → público (sin auth, rate-limited por IP).
 *
 * Endpoints:
 *   - GET  /v1/public/lists/{slug}             → metadata.
 *   - GET  /v1/public/lists/{slug}/records     → records paginados.
 *
 * Rate limit por IP (transient): 60 req/min por endpoint × IP. Defensa
 * básica contra scraping abusivo y DoS. Sin cookie-based auth no
 * podemos hacer rate limit por user — la IP es el único ID disponible.
 *
 * Cache HTTP: `Cache-Control: public, max-age=<ttl>` cuando hay TTL > 0,
 * para que un CDN/Varnish frontal pueda servir sin tocar PHP. El
 * endpoint NO usa cookies, así que es 100% cacheable.
 */
final class PublicListsController extends AbstractController
{
    public const NAMESPACE_PUBLIC = 'imagina-crm/v1';
    public const RATE_LIMIT_MAX   = 60;          // requests
    public const RATE_LIMIT_WIN   = 60;          // segundos

    public function __construct(private readonly PublicListService $service)
    {
        parent::__construct();
    }

    public function register_routes(): void
    {
        // El permission_callback público SIEMPRE retorna true.
        // El control de acceso es:
        //   - 404 si la lista no está marcada como pública.
        //   - 429 si excedió el rate limit (transient por IP).
        $allowPublic = '__return_true';

        register_rest_route($this->namespace, '/public/lists/(?P<slug>[a-zA-Z0-9_-]+)', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'getMeta'],
            'permission_callback' => $allowPublic,
            'args'                => [
                'slug' => ['type' => 'string'],
            ],
        ]);

        register_rest_route($this->namespace, '/public/lists/(?P<slug>[a-zA-Z0-9_-]+)/records', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'getRecords'],
            'permission_callback' => $allowPublic,
            'args'                => [
                'slug'     => ['type' => 'string'],
                'page'     => ['type' => 'integer', 'default' => 1],
                'per_page' => ['type' => 'integer'],
                'search'   => ['type' => 'string'],
                'sort'     => ['type' => 'string'],
                // `filter[slug][op]=value` se recibe como array y se
                // valida en el service.
                'filter'   => ['type' => 'object'],
            ],
        ]);
    }

    public function getMeta(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $slug = (string) $request->get_param('slug');

        $rateLimited = $this->rateLimit('meta:' . $slug);
        if ($rateLimited !== null) {
            return $rateLimited;
        }

        $list = $this->service->findPublicList($slug);
        if ($list === null) {
            return $this->notFound();
        }

        $response = new WP_REST_Response(['data' => $this->service->metaFor($list)]);
        $this->applyPublicCacheHeaders($response, $this->service->configFor($list)->cacheTtl);
        return $response;
    }

    public function getRecords(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $slug = (string) $request->get_param('slug');

        $rateLimited = $this->rateLimit('records:' . $slug);
        if ($rateLimited !== null) {
            return $rateLimited;
        }

        $list = $this->service->findPublicList($slug);
        if ($list === null) {
            return $this->notFound();
        }

        $params = [
            'page'     => $request->get_param('page'),
            'per_page' => $request->get_param('per_page'),
            'search'   => $request->get_param('search'),
            'sort'     => $request->get_param('sort'),
            'filter'   => $request->get_param('filter'),
        ];

        $result = $this->service->fetchRecords($list, $params);
        if ($result instanceof ValidationResult) {
            return $this->validationError($result);
        }

        $response = new WP_REST_Response($result);
        $this->applyPublicCacheHeaders($response, $this->service->configFor($list)->cacheTtl);
        return $response;
    }

    /**
     * Rate limit por IP. Devuelve un WP_Error 429 si excedió el cupo,
     * o null si está dentro del límite (incrementa el contador).
     *
     * Usa transients (`get_transient`/`set_transient`) que un drop-in
     * de cache persistente (Redis) acelera mucho. Sin drop-in cae a
     * wp_options — funcional pero más lento.
     *
     * Identificación de IP: respeta X-Forwarded-For si está presente
     * (servidores detrás de proxy/CDN), con fallback a REMOTE_ADDR.
     */
    private function rateLimit(string $bucket): ?WP_Error
    {
        $ip = $this->clientIp();
        if ($ip === null) {
            // Sin IP identificable, no aplicamos rate limit — el riesgo
            // de bloquear usuarios legítimos detrás de NAT pesa más
            // que el de un scraper anónimo.
            return null;
        }
        $key = 'imcrm_pub_rl_' . md5($bucket . ':' . $ip);

        $count = function_exists('get_transient') ? get_transient($key) : false;
        $count = is_numeric($count) ? (int) $count : 0;

        if ($count >= self::RATE_LIMIT_MAX) {
            return new WP_Error(
                'imcrm_rate_limited',
                __('Demasiadas solicitudes. Intenta de nuevo en unos segundos.', 'imagina-crm'),
                ['status' => 429],
            );
        }

        if (function_exists('set_transient')) {
            set_transient($key, $count + 1, self::RATE_LIMIT_WIN);
        }
        return null;
    }

    private function clientIp(): ?string
    {
        // Orden de preferencia: X-Forwarded-For (left-most = cliente
        // original) → X-Real-IP → REMOTE_ADDR.
        foreach (['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $key) {
            if (! isset($_SERVER[$key])) {
                continue;
            }
            $raw = (string) $_SERVER[$key];
            if ($raw === '') {
                continue;
            }
            // X-Forwarded-For puede ser CSV — quedarnos con el primero.
            $ip = trim(explode(',', $raw)[0]);
            $ip = filter_var($ip, FILTER_VALIDATE_IP);
            if (is_string($ip)) {
                return $ip;
            }
        }
        return null;
    }

    /**
     * Sets headers Cache-Control + Vary para que CDNs cachear sin tocar
     * PHP. El endpoint NO usa cookies, así que es seguro `public`.
     */
    private function applyPublicCacheHeaders(WP_REST_Response $response, int $ttl): void
    {
        if ($ttl <= 0) {
            $response->header('Cache-Control', 'no-store, no-cache, must-revalidate');
            return;
        }
        $response->header('Cache-Control', sprintf('public, max-age=%d, s-maxage=%d', $ttl, $ttl));
        // No deberíamos depender de cookies, pero por defensa: si el
        // tema bota una cookie en el response, el CDN no debe servir
        // ese variant a otros visitantes.
        $response->header('Vary', 'Accept-Encoding');
    }
}
