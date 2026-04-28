import { NavLink } from 'react-router-dom';
import {
    BarChart3,
    Database,
    Loader2,
    Settings,
    Sparkles,
} from 'lucide-react';

import { useLists } from '@/hooks/useLists';
import { __ } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Sidebar refinada estilo Linear/Vercel: bg off-white, label de
 * sección en small-caps gris, items con hover bg sutil y active con
 * pill primary muy suave (no saturado).
 */
export function Sidebar(): JSX.Element {
    const lists = useLists();

    return (
        <aside
            className={cn(
                'imcrm-flex imcrm-w-64 imcrm-shrink-0 imcrm-flex-col imcrm-border-r imcrm-border-sidebar-border imcrm-bg-sidebar imcrm-text-sidebar-foreground',
            )}
        >
            {/* Brand */}
            <div className="imcrm-flex imcrm-h-14 imcrm-shrink-0 imcrm-items-center imcrm-gap-2.5 imcrm-px-4">
                <span className="imcrm-flex imcrm-h-8 imcrm-w-8 imcrm-shrink-0 imcrm-items-center imcrm-justify-center imcrm-rounded-lg imcrm-bg-gradient-to-br imcrm-from-primary imcrm-to-primary/80 imcrm-text-primary-foreground imcrm-shadow-imcrm-sm">
                    <Sparkles className="imcrm-h-4 imcrm-w-4" />
                </span>
                <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-col imcrm-leading-tight">
                    <span className="imcrm-truncate imcrm-text-sm imcrm-font-semibold imcrm-text-foreground">
                        Imagina CRM
                    </span>
                    <span className="imcrm-truncate imcrm-text-[11px] imcrm-text-muted-foreground">
                        {__('Listas y registros')}
                    </span>
                </div>
            </div>

            {/* Nav */}
            <nav
                aria-label={__('Navegación principal')}
                className="imcrm-flex imcrm-flex-1 imcrm-flex-col imcrm-gap-5 imcrm-overflow-y-auto imcrm-px-3 imcrm-pb-4"
            >
                <Section label={__('Workspace')}>
                    <NavItem to="/lists" end icon={Database}>
                        {__('Listas')}
                    </NavItem>
                    <NavItem to="/dashboards" icon={BarChart3}>
                        {__('Dashboards')}
                    </NavItem>
                </Section>

                {lists.data && lists.data.length > 0 && (
                    <Section label={__('Tus listas')}>
                        <ul className="imcrm-flex imcrm-flex-col imcrm-gap-0.5">
                            {lists.data.map((list) => (
                                <li key={list.id}>
                                    <NavLink
                                        to={`/lists/${list.slug}/records`}
                                        className={({ isActive }) =>
                                            cn(
                                                'imcrm-flex imcrm-items-center imcrm-gap-2.5 imcrm-rounded-md imcrm-px-2.5 imcrm-py-1.5 imcrm-text-[13px] imcrm-transition-colors imcrm-duration-100',
                                                isActive
                                                    ? 'imcrm-bg-primary/10 imcrm-font-medium imcrm-text-primary'
                                                    : 'imcrm-text-sidebar-foreground/80 hover:imcrm-bg-sidebar-accent hover:imcrm-text-foreground',
                                            )
                                        }
                                    >
                                        <span
                                            aria-hidden
                                            className="imcrm-h-1.5 imcrm-w-1.5 imcrm-shrink-0 imcrm-rounded-full imcrm-bg-current imcrm-opacity-50"
                                        />
                                        <span className="imcrm-truncate">{list.name}</span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {lists.isLoading && (
                    <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-px-3 imcrm-py-2 imcrm-text-xs imcrm-text-muted-foreground">
                        <Loader2 className="imcrm-h-3 imcrm-w-3 imcrm-animate-spin" />
                        {__('Cargando listas…')}
                    </div>
                )}

                <Section label={__('Sistema')}>
                    <NavItem to="/settings" icon={Settings}>
                        {__('Ajustes')}
                    </NavItem>
                </Section>
            </nav>

            <div className="imcrm-border-t imcrm-border-sidebar-border imcrm-px-4 imcrm-py-3 imcrm-text-[11px] imcrm-font-mono imcrm-text-muted-foreground">
                v{window.IMAGINA_CRM_BOOT?.version ?? '0.0.0'}
            </div>
        </aside>
    );
}

function Section({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
            <h3 className="imcrm-px-2.5 imcrm-pt-2 imcrm-pb-1 imcrm-text-[10px] imcrm-font-bold imcrm-uppercase imcrm-tracking-[0.08em] imcrm-text-muted-foreground/70">
                {label}
            </h3>
            <div className="imcrm-flex imcrm-flex-col imcrm-gap-0.5">{children}</div>
        </div>
    );
}

interface NavItemProps {
    to: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    end?: boolean;
}

function NavItem({ to, icon: Icon, children, end }: NavItemProps): JSX.Element {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                cn(
                    'imcrm-flex imcrm-items-center imcrm-gap-2.5 imcrm-rounded-md imcrm-px-2.5 imcrm-py-2 imcrm-text-[13px] imcrm-font-medium imcrm-transition-colors imcrm-duration-100',
                    isActive
                        ? 'imcrm-bg-primary/10 imcrm-text-primary'
                        : 'imcrm-text-sidebar-foreground hover:imcrm-bg-sidebar-accent hover:imcrm-text-foreground',
                )
            }
        >
            {({ isActive }) => (
                <>
                    <Icon
                        className={cn(
                            'imcrm-h-4 imcrm-w-4 imcrm-shrink-0 imcrm-transition-colors',
                            isActive ? 'imcrm-text-primary' : 'imcrm-text-muted-foreground',
                        )}
                    />
                    <span className="imcrm-truncate">{children}</span>
                </>
            )}
        </NavLink>
    );
}
