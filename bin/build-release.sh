#!/usr/bin/env bash
# Construye un árbol del plugin listo-para-instalar en `build/`.
#
# Salida: directorio `build/imagina-crm/` con todo lo necesario para
# subir a WordPress (vendor sin dev deps, dist compilado, PHP del
# plugin, sin tests ni source TS ni configs de dev).
#
# Uso:
#   bin/build-release.sh        # construye en build/imagina-crm
#   bin/build-release.sh --zip  # adicionalmente empaqueta en build/imagina-crm.zip
#
# Idempotente: limpia build/ antes de empezar.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT}/build"
PLUGIN_SLUG="imagina-crm"
TARGET="${BUILD_DIR}/${PLUGIN_SLUG}"

WANT_ZIP=0
for arg in "$@"; do
    case "$arg" in
        --zip) WANT_ZIP=1 ;;
        *)     echo "argumento desconocido: $arg" >&2; exit 1 ;;
    esac
done

cd "$ROOT"

echo "▶ Limpiando build/"
rm -rf "$BUILD_DIR"
mkdir -p "$TARGET"

echo "▶ Composer install (sin dev)"
composer install --no-dev --optimize-autoloader --prefer-dist --no-interaction --no-progress

echo "▶ NPM install + build"
if [ ! -d node_modules ]; then
    npm ci --no-audit --no-fund
fi
npm run build

# Whitelist de archivos/directorios que sí van al plugin distribuible.
# Más fácil mantener esto que enumerar excepciones, porque agregar un
# archivo de tooling no debería contaminar la build.
INCLUDES=(
    "imagina-crm.php"
    "uninstall.php"
    "readme.txt"
    "src"
    "vendor"
    "dist"
    "assets"
    "languages"
    "docs"
)

echo "▶ Copiando archivos al árbol de release"
for entry in "${INCLUDES[@]}"; do
    if [ -e "$entry" ]; then
        cp -R "$entry" "$TARGET/"
    fi
done

# Inyecta el commit SHA corto en la Version: del header del plugin y
# en la constante IMAGINA_CRM_VERSION. Así cada build distribuible
# tiene un identificador único visible en wp-admin → Plugins (ej.
# `0.1.1+sha.a1b2c3d`) — útil para verificar qué build está instalado
# y para invalidar caches del enqueue de assets.
#
# Si no estamos en un repo git (ej. usuario corre el script desde un
# tarball), saltamos la inyección — la versión queda como en source.
if git rev-parse --git-dir > /dev/null 2>&1; then
    SHORT_SHA=$(git rev-parse --short=7 HEAD 2>/dev/null || echo "")
    if [ -n "$SHORT_SHA" ]; then
        echo "▶ Inyectando SHA en Version del plugin: +sha.${SHORT_SHA}"
        # `Version:` del header WP (formato comentario PHPDoc).
        sed -i.bak -E \
            "s/^( \* Version:[[:space:]]+)([0-9]+\.[0-9]+\.[0-9]+)/\1\2+sha.${SHORT_SHA}/" \
            "$TARGET/imagina-crm.php"
        # Constante IMAGINA_CRM_VERSION usada en wp_enqueue_script.
        sed -i.bak -E \
            "s/(define\('IMAGINA_CRM_VERSION', ')([0-9]+\.[0-9]+\.[0-9]+)('\))/\1\2+sha.${SHORT_SHA}\3/" \
            "$TARGET/imagina-crm.php"
        rm -f "$TARGET/imagina-crm.php.bak"
    fi
fi

# Limpieza extra dentro de vendor: tests/docs/ejemplos de las
# dependencias suelen sobrar y aumentan el ZIP innecesariamente.
echo "▶ Pruning vendor/"
find "$TARGET/vendor" -type d \( \
    -name 'tests' -o \
    -name 'test' -o \
    -name 'Tests' -o \
    -name 'docs' -o \
    -name 'doc' -o \
    -name 'examples' -o \
    -name '.github' \
\) -prune -exec rm -rf {} + 2>/dev/null || true

find "$TARGET/vendor" -type f \( \
    -name '*.md' -o \
    -name '*.markdown' -o \
    -name 'phpunit.xml*' -o \
    -name 'phpstan.neon*' -o \
    -name '.gitignore' -o \
    -name '.gitattributes' -o \
    -name '.editorconfig' \
\) -delete 2>/dev/null || true

# El bundle de Vite incluye source maps por default. En distribución
# no los queremos: ocupan espacio y exponen la TS source.
echo "▶ Removiendo source maps del bundle"
find "$TARGET/dist" -type f -name '*.map' -delete 2>/dev/null || true

echo "▶ Tamaño del árbol de release:"
du -sh "$TARGET" | sed 's/^/  /'

if [ "$WANT_ZIP" = "1" ]; then
    echo "▶ Empaquetando ZIP"
    cd "$BUILD_DIR"
    rm -f "${PLUGIN_SLUG}.zip"
    zip -r -q "${PLUGIN_SLUG}.zip" "$PLUGIN_SLUG"
    echo "  build/${PLUGIN_SLUG}.zip ($(du -h "${PLUGIN_SLUG}.zip" | cut -f1))"
fi

echo "✓ Listo. El plugin instalable está en build/${PLUGIN_SLUG}/"
