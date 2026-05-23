# Licencia y actualizaciones

Imagina CRM es **open source bajo GPLv2**, pero el mantenimiento, las actualizaciones y el soporte oficial requieren una licencia comercial activa.

> ⚠️ **Política importante (ADR-007)**: la licencia NUNCA bloquea tus datos. Si tu licencia caduca o se desactiva, el plugin sigue funcionando 100% — solo dejas de recibir actualizaciones automáticas y soporte directo.

## Activar tu licencia

1. Ve a **Imagina CRM → Ajustes**.
2. En la sección **Licencia**, pega tu clave de licencia.
3. Pulsa **Activar licencia**.

El plugin contacta al servidor de licencias (`licenses.imaginawp.com`) y valida la clave. Si todo va bien, verás:

- **Estado**: `Activa` (badge verde).
- **Vence**: fecha de caducidad.
- **Activaciones**: cuántas instalaciones activas tienes vs. el límite de tu plan.
- **Última verificación**: cuando fue el último check exitoso.

## Estados posibles

| Estado                  | Qué significa                                                          |
|-------------------------|------------------------------------------------------------------------|
| **Inactiva**            | No has activado ninguna licencia.                                      |
| **Activa**              | Licencia válida y verificada recientemente.                            |
| **Expirada**            | La licencia caducó. Renueva desde imaginawp.com.                       |
| **Inválida**            | La clave no existe o fue revocada.                                     |
| **Límite alcanzado**    | Tu plan permite N activaciones y ya las usaste todas.                  |
| **En gracia**           | El último check falló por red, pero tu última verificación fue válida. |

## Período de gracia

Si el servidor de licencias no responde (problema de red, servidor caído, firewall del cliente), entramos automáticamente en **período de gracia** de 7 días. Durante ese tiempo:

- La licencia se considera **válida** para fines de updates.
- Verás un aviso ⏱ "En período de gracia hasta DD/MM/AAAA HH:MM".
- El plugin reintentará validar diariamente (cron de WordPress).
- En cuanto el server responda OK, salimos automáticamente del modo de gracia.

Si pasa el periodo de gracia sin éxito, los updates dejan de ofrecerse, pero **tus datos siguen disponibles**.

## Refrescar manualmente

Si acabas de renovar tu licencia o solucionar un problema de red, no esperes al cron diario:

1. Ve a **Ajustes → Licencia**.
2. Pulsa **Refrescar**.

El plugin contacta al servidor inmediatamente y actualiza el estado.

## Desactivar la licencia

Si vas a mover el plugin a otro servidor (y ese cambio cuenta como una activación nueva), desactiva primero:

1. **Ajustes → Licencia → Desactivar**.

El plugin notifica al servidor para liberar la activación. Si la red está caída, la desactivación local se completa de todas formas y el servidor lo reconciliará en su próxima verificación.

## Updates automáticos

Cuando hay una versión nueva en `releases.imaginawp.com` y tu licencia es válida:

- WordPress muestra el aviso de update en **Plugins → Actualizar**, igual que cualquier plugin nativo.
- También aparece en el panel de **Actualizaciones** del menú principal.
- Pulsa **Actualizar ahora** para descargar e instalar.

El check se hace cada 12 horas (cacheado en transient). Cambios en tu estado de licencia limpian el cache automáticamente.

⚠️ Si tu licencia no es válida (ni en gracia), no se ofrecerán updates. Esto **no bloquea** la instalación manual de un .zip — siempre puedes descargar la última versión desde tu cuenta en imaginawp.com y subirla manualmente.

## ¿Dónde se guarda la clave?

En la tabla `wp_options`, opción `imcrm_license_state`. Solo accesible para usuarios con `manage_options`. La clave NO se envía a Google Analytics, Sentry, ni a ningún servicio externo aparte del servidor de licencias propio (HTTPS).

En la UI siempre se muestra **enmascarada** (`abcd••••wxyz`). El servidor es la única fuente de verdad de la clave completa.

## Lo que sigue

- [Resuelve problemas comunes](./faq.md).
- [Lee el changelog](./changelog.md) para ver qué hay de nuevo.
