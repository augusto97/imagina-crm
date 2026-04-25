import { NavLink } from 'react-router-dom';
import { BarChart3, Database, Loader2, Settings, Sparkles } from 'lucide-react';

import { useLists } from '@/hooks/useLists';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Sidebar(): JSX.Element {
    const lists = useLists();

    return (
        <aside
            className={cn(
                'imcrm-flex imcrm-w-60 imcrm-shrink-0 imcrm-flex-col imcrm-border-r imcrm-border-sidebar-border imcrm-bg-sidebar imcrm-text-sidebar-foreground',
            )}
        >
            <div className="imcrm-flex imcrm-h-14 imcrm-items-center imcrm-gap-2 imcrm-border-b imcrm-border-sidebar-border imcrm-px-4">
                <span className="imcrm-flex imcrm-h-7 imcrm-w-7 imcrm-items-center imcrm-justify-center imcrm-rounded-md imcrm-bg-primary imcrm-text-primary-foreground">
                    <Sparkles className="imcrm-h-4 imcrm-w-4" />
                </span>
                <div className="imcrm-flex imcrm-flex-col imcrm-leading-tight">
                    <span className="imcrm-text-sm imcrm-font-semibold">Imagina CRM</span>
                    <span className="imcrm-text-[11px] imcrm-text-muted-foreground">
                        {__('Listas y registros')}
                    </span>
                </div>
            </div>

            <nav
                aria-label={__('Navegación principal')}
                className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-gap-1 imcrm-overflow-y-auto imcrm-p-3"
            >
                <NavItem to="/lists" icon={<Database className="imcrm-h-4 imcrm-w-4" />}>
                    {__('Listas')}
                </NavItem>

                {lists.isLoading && (
                    <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-px-3 imcrm-py-2 imcrm-text-xs imcrm-text-muted-foreground">
                        <Loader2 className="imcrm-h-3 imcrm-w-3 imcrm-animate-spin" />
                        {__('Cargando listas…')}
                    </div>
                )}

                {lists.data && lists.data.length > 0 && (
                    <ul className="imcrm-flex imcrm-flex-col imcrm-gap-0.5 imcrm-pl-3">
                        {lists.data.map((list) => (
                            <li key={list.id}>
                                <NavLink
                                    to={`/lists/${list.slug}/records`}
                                    className={({ isActive }) =>
                                        cn(
                                            'imcrm-block imcrm-truncate imcrm-rounded-md imcrm-px-3 imcrm-py-1.5 imcrm-text-xs imcrm-transition-colors',
                                            isActive
                                                ? 'imcrm-bg-sidebar-accent imcrm-text-sidebar-accent-foreground'
                                                : 'imcrm-text-muted-foreground hover:imcrm-bg-sidebar-accent/40',
                                        )
                                    }
                                >
                                    {list.name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="imcrm-mt-2 imcrm-flex imcrm-flex-col imcrm-gap-1">
                    <NavItem to="/dashboards" icon={<BarChart3 className="imcrm-h-4 imcrm-w-4" />}>
                        {__('Dashboards')}
                    </NavItem>
                    <NavItem to="/settings" icon={<Settings className="imcrm-h-4 imcrm-w-4" />}>
                        {__('Ajustes')}
                    </NavItem>
                </div>
            </nav>

            <div className="imcrm-border-t imcrm-border-sidebar-border imcrm-px-4 imcrm-py-3 imcrm-text-[11px] imcrm-text-muted-foreground">
                v{window.IMAGINA_CRM_BOOT?.version ?? '0.0.0'}
            </div>
        </aside>
    );
}

interface NavItemProps {
    to: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}

function NavItem({ to, icon, children }: NavItemProps): JSX.Element {
    return (
        <NavLink
            to={to}
            end={to === '/lists'}
            className={({ isActive }) =>
                cn(
                    'imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded-md imcrm-px-3 imcrm-py-2 imcrm-text-sm imcrm-font-medium imcrm-text-sidebar-foreground imcrm-transition-colors',
                    isActive
                        ? 'imcrm-bg-sidebar-accent imcrm-text-sidebar-accent-foreground'
                        : 'hover:imcrm-bg-sidebar-accent/60',
                )
            }
        >
            {icon}
            {children}
        </NavLink>
    );
}
