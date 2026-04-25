import { getBootData } from '@/lib/boot';

export function SettingsPage(): JSX.Element {
    const boot = getBootData();

    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-6">
            <header>
                <h1 className="imcrm-text-2xl imcrm-font-semibold imcrm-tracking-tight">
                    Ajustes
                </h1>
                <p className="imcrm-mt-1 imcrm-text-sm imcrm-text-muted-foreground">
                    Información del entorno actual de Imagina CRM.
                </p>
            </header>

            <dl className="imcrm-grid imcrm-grid-cols-1 imcrm-gap-3 imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-6 sm:imcrm-grid-cols-2">
                <Item label="Versión del plugin" value={boot.version} />
                <Item label="REST root" value={boot.restRoot} />
                <Item label="Locale" value={boot.locale} />
                <Item label="Timezone" value={boot.timezone} />
            </dl>
        </div>
    );
}

function Item({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1">
            <dt className="imcrm-text-xs imcrm-uppercase imcrm-tracking-wide imcrm-text-muted-foreground">
                {label}
            </dt>
            <dd className="imcrm-font-mono imcrm-text-sm">{value || '—'}</dd>
        </div>
    );
}
