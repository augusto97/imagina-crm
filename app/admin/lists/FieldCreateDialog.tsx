import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateField } from '@/hooks/useFields';
import { useFieldTypes } from '@/hooks/useFieldTypes';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { FieldTypeSlug } from '@/types/field';

import { FieldTypeSelect } from './FieldTypeSelect';
import { SlugEditor } from './SlugEditor';

interface FieldCreateDialogProps {
    listId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function FieldCreateDialog({ listId, open, onOpenChange }: FieldCreateDialogProps): JSX.Element {
    const create = useCreateField(listId);
    const { data: fieldTypes } = useFieldTypes();

    const [label, setLabel] = useState('');
    const [type, setType] = useState<FieldTypeSlug | ''>('');
    const [slug, setSlug] = useState('');
    const [slugDirty, setSlugDirty] = useState(false);
    const [isRequired, setIsRequired] = useState(false);
    const [isUnique, setIsUnique] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setLabel('');
            setType('');
            setSlug('');
            setSlugDirty(false);
            setIsRequired(false);
            setIsUnique(false);
            setSubmitError(null);
            create.reset();
        }
    }, [open, create]);

    const supportsUnique = fieldTypes?.find((t) => t.slug === type)?.supports_unique ?? false;

    useEffect(() => {
        if (!supportsUnique && isUnique) {
            setIsUnique(false);
        }
    }, [supportsUnique, isUnique]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!type) return;
        setSubmitError(null);
        try {
            await create.mutateAsync({
                label: label.trim(),
                type,
                slug: slug || undefined,
                is_required: isRequired,
                is_unique: isUnique,
            });
            onOpenChange(false);
        } catch (err) {
            setSubmitError(err instanceof ApiError || err instanceof Error ? err.message : 'Error');
        }
    };

    const canSubmit = label.trim() !== '' && type !== '' && !create.isPending;

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={cn(
                        'imcrm-fixed imcrm-inset-0 imcrm-z-50 imcrm-bg-black/40 imcrm-backdrop-blur-sm',
                    )}
                />
                <Dialog.Content
                    className={cn(
                        'imcrm-fixed imcrm-left-1/2 imcrm-top-1/2 imcrm-z-50 imcrm-w-full imcrm-max-w-md',
                        'imcrm--translate-x-1/2 imcrm--translate-y-1/2',
                        'imcrm-rounded-lg imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-6 imcrm-shadow-imcrm-lg',
                    )}
                >
                    <div className="imcrm-flex imcrm-items-start imcrm-justify-between imcrm-gap-2">
                        <div>
                            <Dialog.Title className="imcrm-text-base imcrm-font-semibold">
                                Añadir campo
                            </Dialog.Title>
                            <Dialog.Description className="imcrm-text-sm imcrm-text-muted-foreground">
                                Define el label, tipo y slug del nuevo campo.
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" aria-label="Cerrar">
                                <X className="imcrm-h-4 imcrm-w-4" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="imcrm-mt-4 imcrm-flex imcrm-flex-col imcrm-gap-4">
                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            <Label htmlFor="new-field-label">Label</Label>
                            <Input
                                id="new-field-label"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="Ej. Email"
                                autoFocus
                            />
                        </div>

                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-1.5">
                            <Label>Tipo</Label>
                            <FieldTypeSelect value={type} onChange={setType} />
                        </div>

                        <SlugEditor
                            type="field"
                            sourceText={label}
                            listId={listId}
                            value={slug}
                            onChange={setSlug}
                            isDirty={slugDirty}
                            onDirty={() => setSlugDirty(true)}
                        />

                        <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                            <label className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm">
                                <input
                                    type="checkbox"
                                    checked={isRequired}
                                    onChange={(e) => setIsRequired(e.target.checked)}
                                />
                                Obligatorio
                            </label>
                            <label
                                className={cn(
                                    'imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm',
                                    !supportsUnique && 'imcrm-opacity-50',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={isUnique}
                                    onChange={(e) => setIsUnique(e.target.checked)}
                                    disabled={!supportsUnique}
                                />
                                Único {!supportsUnique && type !== '' && '(no soportado por este tipo)'}
                            </label>
                        </div>

                        {submitError !== null && (
                            <div className="imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-p-3 imcrm-text-sm imcrm-text-destructive">
                                {submitError}
                            </div>
                        )}

                        <div className="imcrm-flex imcrm-justify-end imcrm-gap-2">
                            <Dialog.Close asChild>
                                <Button type="button" variant="outline">
                                    Cancelar
                                </Button>
                            </Dialog.Close>
                            <Button type="submit" disabled={!canSubmit}>
                                {create.isPending ? 'Creando…' : 'Crear campo'}
                            </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
