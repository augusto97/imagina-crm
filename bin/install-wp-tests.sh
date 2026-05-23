#!/usr/bin/env bash
#
# Instala el WP test suite necesario para los tests de integración.
#
# Uso:
#   bin/install-wp-tests.sh <db-name> <db-user> <db-pass> [db-host] [wp-version] [skip-db-creation]
#
# Ejemplo (local con socket):
#   DATABASE_URL_OPTIONS="--socket=/tmp/mysql.sock" \
#     bin/install-wp-tests.sh imcrm_tests imcrm imcrm 127.0.0.1 latest false
#
# Basado en el script estándar publicado por wp-cli/scaffold (con pequeños
# ajustes para que use socket cuando se le indica).

set -euo pipefail

if [ $# -lt 3 ]; then
    echo "usage: $0 <db-name> <db-user> <db-pass> [db-host] [wp-version] [skip-db-creation]"
    exit 1
fi

DB_NAME="$1"
DB_USER="$2"
DB_PASS="$3"
DB_HOST="${4:-localhost}"
WP_VERSION="${5:-latest}"
SKIP_DB_CREATE="${6:-false}"

WP_TESTS_DIR="${WP_TESTS_DIR:-/tmp/wordpress-tests-lib}"
WP_CORE_DIR="${WP_CORE_DIR:-/tmp/wordpress}"

download() {
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL -o "$2" "$1"
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$2" "$1"
    else
        echo "Need curl or wget"; exit 1
    fi
}

install_wp() {
    if [ -d "$WP_CORE_DIR" ]; then
        return
    fi

    mkdir -p "$WP_CORE_DIR"

    if [ "$WP_VERSION" = 'latest' ]; then
        local ARCHIVE_URL='https://wordpress.org/latest.tar.gz'
    else
        local ARCHIVE_URL="https://wordpress.org/wordpress-${WP_VERSION}.tar.gz"
    fi

    download "$ARCHIVE_URL" /tmp/wordpress.tar.gz
    tar --strip-components=1 -zxmf /tmp/wordpress.tar.gz -C "$WP_CORE_DIR"

    download \
        https://raw.githubusercontent.com/markoheijnen/wp-mysqli/master/db.php \
        "$WP_CORE_DIR/wp-content/db.php" 2>/dev/null || true
}

install_test_suite() {
    if [ ! -d "$WP_TESTS_DIR" ]; then
        mkdir -p "$WP_TESTS_DIR"
        local TAG
        if [ "$WP_VERSION" = 'latest' ]; then
            TAG=$(curl -s https://api.wordpress.org/core/version-check/1.7/ | grep -oE '"current":"[^"]+"' | head -1 | cut -d'"' -f4)
            TAG="tags/${TAG}"
        else
            TAG="tags/${WP_VERSION}"
        fi
        svn co --quiet "https://develop.svn.wordpress.org/${TAG}/tests/phpunit/includes/" "$WP_TESTS_DIR/includes" || {
            # Fallback: cloning develop trunk for the tools.
            svn co --quiet https://develop.svn.wordpress.org/trunk/tests/phpunit/includes/ "$WP_TESTS_DIR/includes"
        }
        svn co --quiet "https://develop.svn.wordpress.org/${TAG}/tests/phpunit/data/" "$WP_TESTS_DIR/data" 2>/dev/null || \
            svn co --quiet https://develop.svn.wordpress.org/trunk/tests/phpunit/data/ "$WP_TESTS_DIR/data"
    fi

    if [ ! -f "$WP_TESTS_DIR/wp-tests-config.php" ]; then
        download \
            https://develop.svn.wordpress.org/trunk/wp-tests-config-sample.php \
            "$WP_TESTS_DIR/wp-tests-config.php"

        local CORE_ABS="$WP_CORE_DIR/"
        sed -i "s|dirname( __FILE__ ) . '/src/'|'$CORE_ABS'|" "$WP_TESTS_DIR/wp-tests-config.php"
        sed -i "s/youremptytestdbnamehere/$DB_NAME/" "$WP_TESTS_DIR/wp-tests-config.php"
        sed -i "s/yourusernamehere/$DB_USER/" "$WP_TESTS_DIR/wp-tests-config.php"
        sed -i "s/yourpasswordhere/$DB_PASS/" "$WP_TESTS_DIR/wp-tests-config.php"
        sed -i "s|localhost|$DB_HOST|" "$WP_TESTS_DIR/wp-tests-config.php"
    fi
}

install_db() {
    if [ "$SKIP_DB_CREATE" = "true" ]; then
        return
    fi

    local DB_OPTIONS="${DATABASE_URL_OPTIONS:-}"

    # Soporta `host:port` y `host` plano. Para conexión por socket se debe
    # pasar DATABASE_URL_OPTIONS="--socket=/path".
    local EXTRA=""
    if [ -n "$DB_OPTIONS" ]; then
        EXTRA="$DB_OPTIONS"
    elif [[ "$DB_HOST" == *:* ]]; then
        local DB_HOSTNAME=${DB_HOST%:*}
        local DB_SOCK_OR_PORT=${DB_HOST#*:}
        if [ "$(echo "$DB_SOCK_OR_PORT" | grep -c '^[0-9]\+$')" -ne 0 ]; then
            EXTRA="--host=$DB_HOSTNAME --port=$DB_SOCK_OR_PORT --protocol=tcp"
        else
            EXTRA="--socket=$DB_SOCK_OR_PORT"
        fi
    else
        EXTRA="--host=$DB_HOST --protocol=tcp"
    fi

    mariadb --user="$DB_USER" --password="$DB_PASS" $EXTRA -e "DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

install_wp
install_test_suite
install_db

echo "WP test suite installed in $WP_TESTS_DIR using core at $WP_CORE_DIR (db=$DB_NAME)"
