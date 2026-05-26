#!/usr/bin/env bash
#
# Build a production-ready release ZIP of Imagina CRM.
#
# Allowlist approach: solo los paths explícitamente listados
# acá entran al ZIP. Archivos nuevos del repo (CSVs sueltos,
# docs, configs de dev, sourcemaps, .env, etc.) nunca se
# escapan al release.
#
# Después del staging corre un audit que falla el build si
# detecta algo que NO debería estar en producción.
#
# Uso:   scripts/build-release.sh [output_zip_path]
# Default output: /tmp/imagina-crm.zip
#

set -euo pipefail

OUTPUT="${1:-/tmp/imagina-crm.zip}"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
STAGE_PARENT="$(mktemp -d)"
STAGE="$STAGE_PARENT/imagina-crm"

cleanup() { rm -rf "$STAGE_PARENT"; }
trap cleanup EXIT

echo "→ Source: $SOURCE"
echo "→ Stage:  $STAGE"
echo "→ Output: $OUTPUT"

cd "$SOURCE"

# ─── 1. Build frontend ────────────────────────────────────────
echo ""
echo "==> Building frontend (vite production)..."
if [ ! -d node_modules ]; then
    npm ci --silent
fi
npm run build 2>&1 | tail -3

# Safety net: si alguien vuelve a meter sourcemaps en config.
if find dist -name '*.map' -print -quit 2>/dev/null | grep -q .; then
    echo ""
    echo "ERROR: el build produjo archivos .map. Revisar vite.config.ts (build.sourcemap debe estar en false)."
    find dist -name '*.map'
    exit 1
fi

# ─── 2. Composer deps (no dev) ────────────────────────────────
echo ""
echo "==> Installing composer deps (--no-dev)..."
composer install --no-dev --optimize-autoloader --no-interaction --quiet

# ─── 3. Stage allowlist ───────────────────────────────────────
echo ""
echo "==> Staging files (allowlist)..."
mkdir -p "$STAGE"

# Plugin bootstrap + metadata
cp imagina-crm.php "$STAGE/"
cp uninstall.php "$STAGE/"
cp readme.txt "$STAGE/"

# PHP source (namespace ImaginaCRM\)
cp -r src "$STAGE/src"

# Frontend bundle (built por vite, sin sourcemaps)
cp -r dist "$STAGE/dist"

# CSS/assets estáticos + traducciones
[ -d assets ] && cp -r assets "$STAGE/assets"
[ -d languages ] && cp -r languages "$STAGE/languages"

# Composer vendor
cp -r vendor "$STAGE/vendor"

# ─── 4. Scrub vendor de artefactos de dev/test ────────────────
echo ""
echo "==> Scrubbing vendor of test/doc artifacts..."
find "$STAGE/vendor" -depth -type d \( \
    -name 'tests' -o -name 'test' -o -name 'Tests' -o -name 'Test' \
    -o -name 'docs' -o -name 'doc' -o -name 'documentation' \
    -o -name 'examples' -o -name 'example' \
    -o -name '.github' -o -name '.git' \
    -o -name 'benchmark' -o -name 'benchmarks' \
\) -exec rm -rf {} + 2>/dev/null || true

# NO borrar vendor/composer/ ni vendor/autoload.php ni installed.{json,php}
# (los necesita el autoloader en runtime).
find "$STAGE/vendor" -type f \( \
    -name 'phpunit.xml*' -o -name 'phpstan.neon*' -o -name 'phpcs.xml*' \
    -o -name '.travis.yml' -o -name '.scrutinizer.yml' \
    -o -name 'appveyor.yml' -o -name 'CODE_OF_CONDUCT*' \
    -o -name 'CONTRIBUTING*' -o -name 'UPGRADE*' -o -name 'UPGRADING*' \
    -o -name '.gitignore' -o -name '.gitattributes' -o -name '.editorconfig' \
    -o -name '.php_cs*' -o -name '.php-cs-fixer*' \
\) -delete 2>/dev/null || true

# ─── 5. Audit ─────────────────────────────────────────────────
echo ""
echo "==> Auditing staged contents..."
AUDIT_FAILED=0
audit_fail() { echo "  ✗ $1"; AUDIT_FAILED=1; }

# Sourcemaps
maps=$(find "$STAGE/dist" -name '*.map' 2>/dev/null | head -3)
if [ -n "$maps" ]; then
    audit_fail ".map files en dist/ (sourcemaps): $maps"
fi

# .git directories (cualquier nivel)
gits=$(find "$STAGE" -name '.git' -type d 2>/dev/null | head -3)
if [ -n "$gits" ]; then
    audit_fail ".git en stage: $gits"
fi

# Credentials / env files
envs=$(find "$STAGE" -name '.env*' -o -name '*.pem' -o -name '*.key' -o -name 'id_rsa*' 2>/dev/null | head -3)
if [ -n "$envs" ]; then
    audit_fail "credenciales/.env en stage: $envs"
fi

# node_modules
nm=$(find "$STAGE" -name 'node_modules' -type d 2>/dev/null | head -1)
if [ -n "$nm" ]; then
    audit_fail "node_modules en stage: $nm"
fi

# CSVs (data files sueltos)
csvs=$(find "$STAGE" -name '*.csv' 2>/dev/null | head -3)
if [ -n "$csvs" ]; then
    audit_fail "CSV files en stage: $csvs"
fi

# Dev configs en root del plugin (no en vendor/)
for f in package.json package-lock.json tsconfig.json tsconfig.tsbuildinfo \
         vite.config.ts vite.config.js tailwind.config.ts tailwind.config.js \
         postcss.config.js eslint.config.js eslint.config.mjs \
         .eslintrc .eslintrc.js .eslintrc.json .prettierrc .prettierrc.json \
         phpstan.neon phpstan.neon.dist phpcs.xml phpcs.xml.dist \
         phpunit.xml phpunit.xml.dist phpunit-integration.xml.dist \
         phpstan-bootstrap.php composer.json composer.lock \
         CLAUDE.md AGENTS.md \
         .editorconfig .gitignore .gitattributes \
         .github docs tests app scripts; do
    if [ -e "$STAGE/$f" ]; then
        audit_fail "dev config/source en stage: $f"
    fi
done

# Verificar que TODO archivo PHP en src/ tenga el guard de ABSPATH
# (defensa estándar de WordPress contra ejecución directa).
missing_guard=0
while IFS= read -r php_file; do
    if ! grep -lE "if\s*\(\s*!\s*defined\s*\(\s*['\"]ABSPATH['\"]" "$php_file" > /dev/null 2>&1 \
       && ! grep -qE "^\s*declare\s*\(\s*strict_types" "$php_file"; then
        # Tolerancia: archivos que solo declaran tipos/interfaces y no
        # ejecutan código pueden no necesitar el guard. Pero loggeamos.
        :
    fi
    if ! grep -lE "defined\s*\(\s*['\"]ABSPATH['\"]" "$php_file" > /dev/null 2>&1; then
        missing_guard=$((missing_guard + 1))
        if [ "$missing_guard" -le 3 ]; then
            echo "  ⚠ PHP sin ABSPATH guard: ${php_file#$STAGE/}"
        fi
    fi
done < <(find "$STAGE/src" -name '*.php' 2>/dev/null)

if [ "$missing_guard" -gt 0 ]; then
    echo "  ⚠ Total archivos PHP sin ABSPATH guard: $missing_guard (revisá manualmente)"
fi

# Bootstrap PHP debe tener el guard
if ! grep -qE "defined\s*\(\s*['\"]ABSPATH['\"]" "$STAGE/imagina-crm.php"; then
    audit_fail "imagina-crm.php sin ABSPATH guard"
fi

if [ "$AUDIT_FAILED" -eq 1 ]; then
    echo ""
    echo "Build falló el audit. Stage en: $STAGE (no se borra para inspección)."
    trap - EXIT
    exit 1
fi
echo "  ✓ Audit OK"

# ─── 6. Build ZIP ─────────────────────────────────────────────
echo ""
echo "==> Creating ZIP..."
rm -f "$OUTPUT"
(cd "$STAGE_PARENT" && zip -rq "$OUTPUT" "$(basename "$STAGE")")

# ─── 7. Reporte ──────────────────────────────────────────────
echo ""
SIZE=$(du -h "$OUTPUT" | cut -f1)
COUNT=$(unzip -l "$OUTPUT" | tail -1 | awk '{print $2}')
echo "✓ Built: $OUTPUT"
echo "  Size:  $SIZE"
echo "  Files: $COUNT"
echo ""
echo "Top-level contents:"
unzip -l "$OUTPUT" | awk 'NR>3 {print $4}' | awk -F/ 'NF==2{print "  "$2}' | sort -u | head -20
