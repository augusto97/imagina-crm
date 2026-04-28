import { useLocation } from 'react-router-dom';
import { Maximize2, Minimize2, Search } from 'lucide-react';

import { NotificationBell } from '@/admin/layout/NotificationBell';
import { Button } from '@/components/ui/button';
import { getBootData } from '@/lib/boot';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toggleFullscreen, useFullscreen } from '@/stores/shellStore';

function getRouteLabels(): Record<string, string> {
    return {
        lists: __('Listas'),
        dashboards: __('Dashboards'),
        settings: __('Ajustes'),
    };
}

export function Topbar(): JSX.Element {
    const { pathname } = useLocation();
    const segments = pathname.split('/').filter(Boolean);
    const current = segments[0] ?? 'lists';
    const label = getRouteLabels()[current] ?? 'Imagina CRM';
    const boot = getBootData();
    const isFullscreen = useFullscreen();

    return (
        <header
            className={cn(
                'imcrm-flex imcrm-h-14 imcrm-shrink-0 imcrm-items-center imcrm-justify-between imcrm-gap-4 imcrm-border-b imcrm-border-border imcrm-bg-background/80 imcrm-px-5 imcrm-backdrop-blur-md',
            )}
        >
            <nav
                aria-label={__('Breadcrumb')}
                className="imcrm-flex imcrm-items-center imcrm-gap-1.5 imcrm-text-[13px]"
            >
                <span className="imcrm-text-muted-foreground">Imagina CRM</span>
                <span aria-hidden="true" className="imcrm-text-muted-foreground/40">
                    /
                </span>
                <span className="imcrm-font-semibold imcrm-text-foreground">{label}</span>
            </nav>

            <div className="imcrm-flex imcrm-items-center imcrm-gap-1.5">
                <Button variant="outline" size="sm" className="imcrm-gap-2 imcrm-min-w-[160px] imcrm-justify-start imcrm-text-muted-foreground">
                    <Search className="imcrm-h-3.5 imcrm-w-3.5" aria-hidden="true" />
                    <span className="imcrm-flex-1 imcrm-text-left">{__('Buscar…')}</span>
                    <kbd
                        className="imcrm-ml-auto imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-muted imcrm-px-1.5 imcrm-py-0.5 imcrm-text-[10px] imcrm-font-mono imcrm-text-muted-foreground"
                        aria-label={__('atajo Comando K')}
                    >
                        <span aria-hidden="true">⌘K</span>
                    </kbd>
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? __('Salir de pantalla completa') : __('Pantalla completa')}
                    title={
                        isFullscreen
                            ? __('Salir de pantalla completa (Esc)')
                            : __('Pantalla completa — oculta el chrome de WordPress')
                    }
                >
                    {isFullscreen ? (
                        <Minimize2 className="imcrm-h-4 imcrm-w-4" aria-hidden="true" />
                    ) : (
                        <Maximize2 className="imcrm-h-4 imcrm-w-4" aria-hidden="true" />
                    )}
                </Button>

                <NotificationBell />

                <div className="imcrm-mx-1 imcrm-h-6 imcrm-w-px imcrm-bg-border" aria-hidden />

                <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded-lg imcrm-px-1.5 imcrm-py-1 hover:imcrm-bg-accent">
                    {boot.user.avatar ? (
                        <img
                            src={boot.user.avatar}
                            alt=""
                            className="imcrm-h-6 imcrm-w-6 imcrm-rounded-full imcrm-ring-1 imcrm-ring-border"
                        />
                    ) : (
                        <span className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-gradient-to-br imcrm-from-primary imcrm-to-primary/70 imcrm-text-[10px] imcrm-font-bold imcrm-text-primary-foreground">
                            {(boot.user.displayName || 'U').charAt(0).toUpperCase()}
                        </span>
                    )}
                    <span className="imcrm-text-[13px] imcrm-font-medium imcrm-text-foreground">
                        {boot.user.displayName || __('Usuario')}
                    </span>
                </div>
            </div>
        </header>
    );
}
