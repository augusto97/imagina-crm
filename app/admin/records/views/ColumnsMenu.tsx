import { Columns3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { __ } from '@/lib/i18n';
import type { FieldEntity } from '@/types/field';

/**
 * Dropdown que lista todas las columnas de la tabla y permite togglear
 * su visibilidad. La selección se persiste por SavedView en
 * `config.hidden_columns`.
 *
 * Columnas fijas no-de-campo (id, updated_at) también pueden
 * ocultarse — usamos su `id` literal como key.
 */
interface ColumnsMenuProps {
    fields: FieldEntity[];
    /** `true` si la columna está visible. Map por column id. */
    visibility: Record<string, boolean>;
    onChange: (next: Record<string, boolean>) => void;
}

export function ColumnsMenu({ fields, visibility, onChange }: ColumnsMenuProps): JSX.Element {
    const setVisible = (id: string, visible: boolean): void => {
        onChange({ ...visibility, [id]: visible });
    };

    const isVisible = (id: string): boolean => visibility[id] !== false;

    const dynamicCols = fields
        .filter((f) => f.type !== 'relation')
        .sort((a, b) => a.position - b.position);

    const hiddenCount = Object.values(visibility).filter((v) => v === false).length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="imcrm-gap-1.5">
                    <Columns3 className="imcrm-h-3.5 imcrm-w-3.5" />
                    {__('Columnas')}
                    {hiddenCount > 0 && (
                        <span className="imcrm-ml-1 imcrm-rounded imcrm-bg-primary/10 imcrm-px-1.5 imcrm-text-[10px] imcrm-font-semibold imcrm-text-primary">
                            {hiddenCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="imcrm-min-w-[220px] imcrm-max-h-[60vh] imcrm-overflow-y-auto">
                <DropdownMenuCheckboxItem
                    checked={isVisible('id')}
                    onCheckedChange={(c) => setVisible('id', !!c)}
                    onSelect={(e) => e.preventDefault()}
                >
                    {__('ID')}
                </DropdownMenuCheckboxItem>
                {dynamicCols.map((field) => (
                    <DropdownMenuCheckboxItem
                        key={field.id}
                        checked={isVisible(field.slug)}
                        onCheckedChange={(c) => setVisible(field.slug, !!c)}
                        onSelect={(e) => e.preventDefault()}
                    >
                        {field.label}
                    </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={isVisible('updated_at')}
                    onCheckedChange={(c) => setVisible('updated_at', !!c)}
                    onSelect={(e) => e.preventDefault()}
                >
                    {__('Actualizado')}
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
