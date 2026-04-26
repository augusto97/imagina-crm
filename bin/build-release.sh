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
