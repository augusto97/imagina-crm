import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { RecordListMeta } from '@/types/record';

interface PaginationProps {
    meta: RecordListMeta;
    onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps): JSX.Element | null {
    if (meta.total_pages <= 1) {
        return (
            <div className="imcrm-text-xs imcrm-text-muted-foreground">
                {meta.total} registro{meta.total === 1 ? '' : 's'}
            </div>
        );
    }

    const start = (meta.page - 1) * meta.per_page + 1;
    const end = Math.min(meta.page * meta.per_page, meta.total);

    return (
        <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-3">
            <span className="imcrm-text-xs imcrm-text-muted-foreground">
                {start}–{end} de {meta.total}
            </span>
            <div className="imcrm-flex imcrm-items-center imcrm-gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.max(1, meta.page - 1))}
                    disabled={meta.page <= 1}
                    aria-label="Página anterior"
                >
                    <ChevronLeft className="imcrm-h-4 imcrm-w-4" />
                </Button>
                <span className="imcrm-text-xs imcrm-tabular-nums imcrm-text-muted-foreground imcrm-px-2">
                    Página {meta.page} de {meta.total_pages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.min(meta.total_pages, meta.page + 1))}
                    disabled={meta.page >= meta.total_pages}
                    aria-label="Página siguiente"
                >
                    <ChevronRight className="imcrm-h-4 imcrm-w-4" />
                </Button>
            </div>
        </div>
    );
}
