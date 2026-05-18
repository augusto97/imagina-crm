# Instalación

## Requisitos

| Componente   | Versión mínima                                     |
|--------------|-----------------------------------------------------|
| WordPress    | 6.4                                                 |
| PHP          | 8.2 (recomendado 8.3+)                              |
| MySQL        | 8.0 / MariaDB 10.6                                  |
| Permisos     | Usuario con capability `manage_options` (admin)     |
| Navegador    | Chrome / Firefox / Edge / Safari versiones actuales |
| Resolución   | Mínima 1024 px de ancho                             |

> 💡 Imagina CRM convive sin problemas con cualquier otro plugin de WordPress; usa un prefijo de tablas (`wp_imcrm_*`) y un namespace CSS (`imcrm-`) para no colisionar.

## Pasos

1. **Sube el plugin** a `/wp-content/plugins/imagina-crm/` (vía FTP, ZIP del panel de WordPress, o `git clone`).
2. **Instala dependencias**, una sola vez:
   ```bash
   cd wp-content/plugins/imagina-crm
   composer install --no-dev
   npm install
   npm run build
   ```
   Esto compila el frontend (React + Tailwind) y deja `dist/main-*.js` listo.
3. **Activa el plugin** desde *Plugins → Plugins instalados → Imagina CRM → Activar*.
4. Verás un nuevo ítem **Imagina CRM** en el menú lateral del admin. Abrirlo te lleva a la primera pantalla.

## ¿Qué hace la activación?

- Crea las 7 tablas del sistema con prefijo `wp_imcrm_*` (listas, campos, registros, vistas, comentarios, actividad, relaciones, historial de slugs).
- Programa una verificación diaria de licencia (cron).
- **No toca** ninguna tabla nativa de WordPress ni los datos existentes en otros plugins.

## ¿Qué hace la desactivación?

- Limpia transients y cron del plugin.
- **Conserva todas las tablas y datos**. Si reactivas el plugin más adelante, todo vuelve igual que estaba.

## Eliminación completa de datos

Si quieres borrar definitivamente todos los datos del plugin al desinstalarlo:

1. Antes de desinstalar, abre **Imagina CRM → Ajustes → Avanzado**.
2. Marca la opción "Borrar todos los datos al desinstalar".
3. Desinstala el plugin desde el panel de WordPress.

⚠️ Esta operación **no es reversible**. Las tablas dinámicas (`wp_imcrm_data_*`) se eliminan junto con todos los registros.

## Solución de problemas

Si tras activar ves el aviso *"Imagina CRM no encontró el autoload de Composer"*, asegúrate de haber corrido `composer install` y de que el directorio `vendor/` esté presente.

Si ves *"el bundle del admin no está construido"*, corre `npm install && npm run build` en el directorio del plugin.

Para más detalles técnicos consulta [Preguntas frecuentes](./faq.md).
