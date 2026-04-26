# Imagina CRM

Plataforma de gestión de listas, registros y automatizaciones tipo
ClickUp/Airtable nativa en WordPress.

> Para la spec completa del producto, decisiones de arquitectura y
> roadmap, ver [`CLAUDE.md`](CLAUDE.md).

## Instalar el plugin

### Opción A — Usuario / administrador WP (recomendado)

El plugin se distribuye **pre-construido** (con `vendor/` y `dist/`
incluidos) en la rama `release` del repositorio.

1. Ve al repo en GitHub.
2. **Code → Switch branches → `release` → Code → Download ZIP**.
   Obtienes `imagina-crm-release.zip`.
3. En tu WordPress admin: **Plugins → Añadir nuevo → Subir plugin** y
   selecciona el ZIP.
4. Activa el plugin.

Para una versión etiquetada, ve a **Releases** y descarga el ZIP de
la versión que necesites.

### Opción B — Developer / desde código fuente

```bash
git clone <repo> imagina-crm
cd imagina-crm
composer install --no-dev --optimize-autoloader
npm ci
npm run build
```

Después monta el directorio en `wp-content/plugins/imagina-crm/` y
activa desde el WP admin.

## Desarrollo

### Requisitos

- PHP 8.2+
- Node 20+
- Composer 2.x
- (opcional) MySQL 8 / MariaDB 10.6 para tests de integración.

### Setup inicial

```bash
composer install
npm install
```

### Comandos útiles

| Comando                                  | Qué hace                                          |
|------------------------------------------|---------------------------------------------------|
| `npm run dev`                            | Vite en modo dev con HMR                          |
| `npm run build`                          | Bundle de producción a `dist/`                    |
| `npm run type-check`                     | TypeScript estricto                               |
| `npm run lint`                           | ESLint                                            |
| `composer test:unit`                     | PHPUnit unitario                                  |
| `composer test:integration`              | PHPUnit con MySQL real                            |
| `composer phpstan`                       | PHPStan nivel 8                                   |
| `composer phpcs`                         | PHPCS WordPress-Extra                             |
| `bin/build-release.sh`                   | Construye `build/imagina-crm/` listo-para-instalar |
| `bin/build-release.sh --zip`             | Igual + empaqueta `build/imagina-crm.zip`         |

### Tests de integración local

Los tests de `tests/Integration/` requieren MySQL. Se saltan
silenciosamente si no hay conexión. Para correrlos:

```bash
docker run -d --name imcrm-mysql \
    -e MARIADB_ROOT_PASSWORD=root \
    -e MARIADB_DATABASE=imcrm_tests \
    -e MARIADB_USER=imcrm \
    -e MARIADB_PASSWORD=imcrm \
    -p 3306:3306 \
    mariadb:10.11
composer test:integration
```

## Cómo se publica una release

CI hace el trabajo:

- **Cada push a `main`** → el workflow `release.yml` corre, construye
  el árbol completo y lo publica en la rama `release`. La rama
  `release` siempre tiene el último build instalable.
- **Cada tag `vX.Y.Z` empujado** → además crea un GitHub Release con
  `imagina-crm.zip` adjunto.

Para crear una release versionada:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Si necesitas reconstruir manualmente, en GitHub: **Actions → Build &
publish release branch → Run workflow**.

## Estructura del repo

```
imagina-crm/
├── imagina-crm.php          # Entry point del plugin (header WP)
├── uninstall.php
├── readme.txt               # Formato wp.org
├── src/                     # PHP — namespace ImaginaCRM\
├── app/                     # React + TypeScript (sources)
├── dist/                    # Bundle compilado (gitignored, generado por vite)
├── vendor/                  # Composer deps (gitignored, generado por composer install)
├── tests/                   # PHPUnit (Unit + Integration)
├── languages/               # .pot + .po + .mo
├── docs/                    # Docs de usuario
├── bin/                     # Scripts (build, i18n, bench)
└── .github/workflows/       # CI + release
```

## Licencia

GPL-2.0-or-later. Ver `readme.txt` para metadatos completos.
