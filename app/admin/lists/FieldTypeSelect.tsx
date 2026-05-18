import { Select } from '@/components/ui/select';
import { useFieldTypes } from '@/hooks/useFieldTypes';
import { __ } from '@/lib/i18n';
import type { FieldTypeSlug } from '@/types/field';

interface FieldTypeSelectProps {
    value: FieldTypeSlug | '';
    onChange: (slug: FieldTypeSlug) => void;
    disabled?: boolean;
}

export function FieldTypeSelect({ value, onChange, disabled }: FieldTypeSelectProps): JSX.Element {
    const { data: types, isLoading } = useFieldTypes();

    return (
        <Select
            value={value}
            disabled={disabled || isLoading}
            onChange={(e) => onChange(e.target.value as FieldTypeSlug)}
        >
            <option value="" disabled>
                {isLoading ? __('Cargando…') : __('Selecciona un tipo')}
            </option>
            {types?.map((t) => (
                <option key={t.slug} value={t.slug}>
                    {t.label}
                </option>
            ))}
        </Select>
    );
}
