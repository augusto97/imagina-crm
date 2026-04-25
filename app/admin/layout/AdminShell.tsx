import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/admin/layout/Sidebar';
import { Topbar } from '@/admin/layout/Topbar';
import { cn } from '@/lib/utils';

export function AdminShell(): JSX.Element {
    return (
        <div
            className={cn(
                'imcrm-flex imcrm-min-h-[calc(100vh-32px)] imcrm-w-full imcrm-bg-background imcrm-text-foreground',
            )}
        >
            <Sidebar />
            <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col">
                <Topbar />
                <main className="imcrm-flex-1 imcrm-overflow-auto imcrm-p-6">
                    <div className="imcrm-mx-auto imcrm-w-full imcrm-max-w-screen-2xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
