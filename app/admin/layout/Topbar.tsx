import { useLocation } from 'react-router-dom';
import { ExternalLink, LogOut, Maximize2, Minimize2, Settings } from 'lucide-react';

import { NotificationBell } from '@/admin/layout/NotificationBell';
import { Button } from '@/components/ui/button';
import { getBootData } from '@/lib/boot';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toggleFullscreen, useFullscreen } from '@/stores/shellStore';

/**
 * Topbar inspirada en la app de audit:
 *  - Izquierda: nombre del workspace (boot.user / brand)
 *  - Derecha: search compacto, notif bell, fullscreen toggle,
 *    "Ver herramienta" link al admin de WP, settings + logout iconos
 */
export function Topbar(): JSX.Element {
    useLocation();
    const boot = getBootData();
    const isFullscreen = useFullscreen();

    return (
        <header
            className={cn(
                'imcrm-flex imcrm-h-16 imcrm-shrink-0 imcrm-items-center imcrm-justify-between imcrm-gap-4 imcrm-border-b imcrm-border-border imcrm-bg-background imcrm-px-6',
            )}
        >
            <div className="imcrm-flex imcrm-min-w-0 imcrm-items-center imcrm-gap-2.5">
                <h2 className="imcrm-truncate imcrm-text-[15px] imcrm-font-semibold imcrm-text-foreground">
                    {boot.user.displayName || 'Imagina CRM'}
                </h2>
            </div>

            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                <NotificationBell />

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? __('Salir de pantalla completa') : __('Pantalla completa')}
                    title={
                        isFullscreen
                            ? __('Salir de pantalla completa (Esc)')
                            : __('Pantalla completa')
                    }
                >
                    {isFullscreen ? (
                        <Minimize2 className="imcrm-h-4 imcrm-w-4" aria-hidden="true" />
                    ) : (
                        <Maximize2 className="imcrm-h-4 imcrm-w-4" aria-hidden="true" />
                    )}
                </Button>

                <a
                    href={boot.adminUrl || '/wp-admin'}
                    className="imcrm-ml-1 imcrm-inline-flex imcrm-h-9 imcrm-items-center imcrm-gap-1.5 imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-px-3 imcrm-text-[13px] imcrm-font-medium imcrm-text-foreground imcrm-shadow-imcrm-sm imcrm-transition-colors hover:imcrm-bg-accent"
                >
                    <ExternalLink className="imcrm-h-3.5 imcrm-w-3.5" aria-hidden />
                    {__('Ver WP')}
                </a>

                <div className="imcrm-mx-1 imcrm-h-6 imcrm-w-px imcrm-bg-border" aria-hidden />

                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={__('Configuración')}
                    onClick={() => {
                        window.location.hash = '#/settings';
                    }}
                >
                    <Settings className="imcrm-h-4 imcrm-w-4" />
                </Button>

                <a
                    href="/wp-login.php?action=logout"
                    className="imcrm-inline-flex imcrm-h-9 imcrm-w-9 imcrm-items-center imcrm-justify-center imcrm-rounded-lg imcrm-text-foreground/70 imcrm-transition-colors hover:imcrm-bg-accent hover:imcrm-text-destructive"
                    aria-label={__('Cerrar sesión')}
                    title={__('Cerrar sesión')}
                >
                    <LogOut className="imcrm-h-4 imcrm-w-4" />
                </a>
            </div>
        </header>
    );
}
