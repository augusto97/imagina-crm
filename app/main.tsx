import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';

import { App } from '@/App';
import { queryClient } from '@/lib/query-client';
import { getBootData } from '@/lib/boot';
import '@/styles/globals.css';

function mount(): void {
    const boot = getBootData();
    const container = document.getElementById(boot.rootId);

    if (!container) {
        // eslint-disable-next-line no-console
        console.warn(`[imagina-crm] Mount node "#${boot.rootId}" not found.`);
        return;
    }

    createRoot(container).render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <HashRouter>
                    <App />
                </HashRouter>
            </QueryClientProvider>
        </StrictMode>,
    );
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
    mount();
}
