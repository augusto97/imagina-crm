import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminShell } from '@/admin/layout/AdminShell';
import { AutomationsPage } from '@/admin/automations/AutomationsPage';
import { DashboardPage } from '@/admin/dashboards/DashboardPage';
import { DashboardsIndexPage } from '@/admin/dashboards/DashboardsIndexPage';
import { ListsIndexPage } from '@/admin/lists/ListsIndexPage';
import { ListBuilderPage } from '@/admin/lists/ListBuilderPage';
import { RecordPage } from '@/admin/records/RecordPage';
import { RecordsPage } from '@/admin/records/RecordsPage';
import { SettingsPage } from '@/admin/settings/SettingsPage';

export function App(): JSX.Element {
    return (
        <Routes>
            <Route element={<AdminShell />}>
                <Route index element={<Navigate to="/lists" replace />} />
                <Route path="lists" element={<ListsIndexPage />} />
                <Route path="lists/:listSlug/edit" element={<ListBuilderPage />} />
                <Route path="lists/:listSlug/records" element={<RecordsPage />} />
                <Route path="lists/:listSlug/records/:recordId" element={<RecordPage />} />
                <Route path="lists/:listSlug/automations" element={<AutomationsPage />} />
                <Route path="dashboards" element={<DashboardsIndexPage />} />
                <Route path="dashboards/:dashboardId" element={<DashboardPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/lists" replace />} />
            </Route>
        </Routes>
    );
}
