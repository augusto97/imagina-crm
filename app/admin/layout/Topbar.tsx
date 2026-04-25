import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getBootData } from '@/lib/boot';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function getRouteLabels(): Record<string, string> {
    return {
        lists: __('Listas'),
        settings: __('Ajustes'),
    };
}

export function Topbar(): JSX.Element {
    const { pathname } = useLocation();
    const segments = pathname.split('/').filter(Boolean);
    const current = segments[0] ?? 'lists';
    const label = getRouteLabels()[current] ?? 'Imagina CRM';
    const boot = getBootData();

    return (
        <header
            className={cn(
                'imcrm-flex imcrm-h-14 imcrm-shrink-0 imcrm-items-center imcrm-justify-between imcrm-gap-4 imcrm-border-b imcrm-border-border imcrm-bg-background imcrm-px-6',
            )}
        >
            <nav
                aria-label={__('Breadcrumb')}
                className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-text-muted-foreground"
            >
                <span>Imagina CRM</span>
                <span aria-hidden="true">/</span>
                <span className="imcrm-font-medium imcrm-text-foreground">{label}</span>
            </nav>

            <div className="imcrm-flex imcrm-items-center imcrm-gap-2">
                <Button variant="outline" size="sm" className="imcrm-gap-2">
                    <Search className="imcrm-h-3.5 imcrm-w-3.5" aria-hidden="true" />
                    <span>{__('Buscar')}</span>
                    <kbd
                        className="imcrm-ml-2 imcrm-rounded imcrm-border imcrm-border-border imcrm-bg-muted imcrm-px-1.5 imcrm-py-0.5 imcrm-text-[10px] imcrm-font-mono imcrm-text-muted-foreground"
                        aria-label={__('atajo Comando K')}
                    >
                        <span aria-hidden="true">⌘K</span>
                    </kbd>
                </Button>

                <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-px-2 imcrm-py-1">
                    {boot.user.avatar ? (
                        <img
                            src={boot.user.avatar}
                            alt=""
                            className="imcrm-h-6 imcrm-w-6 imcrm-rounded-full"
                        />
                    ) : (
                        <span className="imcrm-h-6 imcrm-w-6 imcrm-rounded-full imcrm-bg-muted" />
                    )}
                    <span className="imcrm-text-sm imcrm-font-medium">
                        {boot.user.displayName || __('Usuario')}
                    </span>
                </div>
            </div>
        </header>
    );
}
