import { NavLink } from 'react-router-dom';
import { Database, Settings, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

type NavItem = {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
    { to: '/lists', label: 'Listas', icon: Database },
    { to: '/settings', label: 'Ajustes', icon: Settings },
];

export function Sidebar(): JSX.Element {
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
                        Listas y registros
                    </span>
                </div>
            </div>

            <nav className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-gap-1 imcrm-p-3">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                'imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-rounded-md imcrm-px-3 imcrm-py-2 imcrm-text-sm imcrm-font-medium imcrm-text-sidebar-foreground imcrm-transition-colors',
                                isActive
                                    ? 'imcrm-bg-sidebar-accent imcrm-text-sidebar-accent-foreground'
                                    : 'hover:imcrm-bg-sidebar-accent/60',
                            )
                        }
                    >
                        <item.icon className="imcrm-h-4 imcrm-w-4" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="imcrm-border-t imcrm-border-sidebar-border imcrm-px-4 imcrm-py-3 imcrm-text-[11px] imcrm-text-muted-foreground">
                v{window.IMAGINA_CRM_BOOT?.version ?? '0.0.0'}
            </div>
        </aside>
    );
}
