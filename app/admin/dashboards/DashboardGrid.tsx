import { Responsive, WidthProvider, type Layout, type LayoutItem } from 'react-grid-layout/legacy';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import type { WidgetSpec } from '@/types/dashboard';

// react-grid-layout v2 movió WidthProvider al subpath /legacy. La API
// principal ahora es hooks-based (useContainerWidth) pero el HOC sigue
// siendo más simple para nuestro caso. Evita un wrapper adicional.
const ResponsiveGrid = WidthProvider(Responsive);

/**
 * Grid resizable + drag-and-drop para los widgets del Dashboard,
 * basado en `react-grid-layout`. Persistir la posición/tamaño de
 * cada widget cuando el usuario suelta (`onLayoutChange`) → vuelve
 * al backend via la mutation del Dashboard.
 *
 * Layout por widget: `{i, x, y, w, h}` donde `i = widget.id`. El grid
 * tiene 12 columnas (cols.lg=12). Cada celda tiene rowHeight 80px
 * + margen 16px.
 *
 * Lazy-loaded desde DashboardPage para no inflar el bundle principal
 * con react-grid-layout (~50KB gzipped).
 */
interface DashboardGridProps {
    widgets: WidgetSpec[];
    onLayoutChange: (layouts: Array<{ id: string; x: number; y: number; w: number; h: number }>) => void;
    children: (widget: WidgetSpec) => React.ReactNode;
}

export function DashboardGrid({
    widgets,
    onLayoutChange,
    children,
}: DashboardGridProps): JSX.Element {
    const layout: LayoutItem[] = widgets.map((w, i) => ({
        i: w.id,
        // Defaults razonables si nunca se persistió un layout (widget
        // recién creado): grilla 4×3 acomodando 3 por fila.
        x: typeof w.layout?.x === 'number' ? w.layout.x : (i % 3) * 4,
        y: typeof w.layout?.y === 'number' ? w.layout.y : Math.floor(i / 3) * 3,
        w: typeof w.layout?.w === 'number' && w.layout.w > 0 ? w.layout.w : 4,
        h: typeof w.layout?.h === 'number' && w.layout.h > 0 ? w.layout.h : 3,
        minW: 2,
        minH: 2,
    }));

    return (
        <ResponsiveGrid
            className="imcrm-layout"
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 8, xs: 4, xxs: 2 }}
            layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
            rowHeight={80}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            isDraggable
            isResizable
            draggableCancel=".imcrm-no-drag"
            onLayoutChange={(next: Layout) => {
                onLayoutChange(
                    next.map((l) => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h })),
                );
            }}
        >
            {widgets.map((w) => (
                <div key={w.id}>{children(w)}</div>
            ))}
        </ResponsiveGrid>
    );
}
