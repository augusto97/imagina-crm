import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/admin/layout/Sidebar';
import { SkipLink } from '@/admin/layout/SkipLink';
import { Topbar } from '@/admin/layout/Topbar';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useFullscreen, useFullscreenEscapeKey } from '@/stores/shellStore';

export function AdminShell(): JSX.Element {
    const isFullscreen = useFullscreen();
    useFullscreenEscapeKey();

    return (
        <div
            className={cn(
                'imcrm-flex imcrm-w-full imcrm-bg-canvas imcrm-text-foreground',
                isFullscreen
                    ? 'imcrm-h-screen imcrm-min-h-screen'
                    : 'imcrm-min-h-[calc(100vh-32px)]',
            )}
        >
            <SkipLink />
            <Sidebar />
            <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col">
                <Topbar />
                <main
                    id="imcrm-main"
                    aria-label={__('Contenido principal')}
                    className="imcrm-flex-1 imcrm-overflow-auto imcrm-p-6"
                    tabIndex={-1}
                >
                    <div className="imcrm-mx-auto imcrm-w-full imcrm-max-w-screen-2xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
