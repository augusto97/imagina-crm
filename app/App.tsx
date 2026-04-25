import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminShell } from '@/admin/layout/AdminShell';
import { ListsIndexPage } from '@/admin/lists/ListsIndexPage';
import { SettingsPage } from '@/admin/settings/SettingsPage';

export function App(): JSX.Element {
    return (
        <Routes>
            <Route element={<AdminShell />}>
                <Route index element={<Navigate to="/lists" replace />} />
                <Route path="lists" element={<ListsIndexPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/lists" replace />} />
            </Route>
        </Routes>
    );
}
