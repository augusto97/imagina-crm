#!/usr/bin/env bash
#
# Genera/regenera los archivos de traducción del plugin.
#
# Requiere:
#   - wp-cli (https://wp-cli.org/) instalado y disponible en PATH.
#   - msgfmt (paquete `gettext` en Linux/macOS) para compilar .mo.
#
# Pasos que ejecuta:
#   1. `wp i18n make-pot` — extrae todas las cadenas de PHP y JS/TSX al
#      template `languages/imagina-crm.pot`.
#   2. Para cada `.po` existente en `languages/*.po`:
#      - `msgmerge` actualiza el archivo con las nuevas cadenas del .pot.
#      - `msgfmt` compila el .mo.
#   3. `wp i18n make-json` — genera los `.json` que `@wordpress/i18n` carga
#      en el bundle del frontend (uno por cada handle de script via
#      `wp_set_script_translations`).
#
# Uso:
#   bin/i18n-build.sh
#
# En CI puedes correr `wp-cli` desde un Docker action si no quieres
# instalarlo en el runner:
#   docker run --rm -v "$PWD:/app" -w /app wordpress:cli i18n make-pot . languages/imagina-crm.pot
#

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LANG_DIR="$ROOT/languages"
POT="$LANG_DIR/imagina-crm.pot"

cd "$ROOT"

if ! command -v wp >/dev/null 2>&1; then
    echo "wp-cli no está instalado. Mira https://wp-cli.org/ o usa el modo Docker:" >&2
    echo "  docker run --rm -v \"$PWD:/app\" -w /app wordpress:cli i18n make-pot . languages/imagina-crm.pot --domain=imagina-crm" >&2
    exit 1
fi

mkdir -p "$LANG_DIR"

echo "→ Generando .pot…"
wp i18n make-pot "$ROOT" "$POT" \
    --domain=imagina-crm \
    --slug=imagina-crm \
    --exclude="vendor,node_modules,dist,tests,bin"

shopt -s nullglob
for po in "$LANG_DIR"/*.po; do
    locale="$(basename "$po" .po)"
    locale="${locale#imagina-crm-}"
    echo "→ Sincronizando $locale…"
    if command -v msgmerge >/dev/null 2>&1; then
        msgmerge --update --backup=none --quiet "$po" "$POT"
    else
        echo "  (msgmerge no disponible — saltando merge)"
    fi
    if command -v msgfmt >/dev/null 2>&1; then
        msgfmt -o "${po%.po}.mo" "$po"
        echo "  ✓ ${po%.po}.mo"
    else
        echo "  (msgfmt no disponible — saltando .mo)"
    fi
done
shopt -u nullglob

echo "→ Generando .json para JS…"
wp i18n make-json "$LANG_DIR" --no-purge

echo "✓ Hecho."
