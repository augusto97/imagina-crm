import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';

import { CommentContent } from '@/admin/comments/CommentContent';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    useComments,
    useCreateComment,
    useDeleteComment,
    useUpdateComment,
} from '@/hooks/useComments';
import { ApiError } from '@/lib/api';
import { __, sprintf } from '@/lib/i18n';
import type { CommentEntity } from '@/types/comment';

/**
 * Hilo de comentarios para un registro específico.
 *
 * Render:
 * - Lista cronológica con burbujas (tipo Slack/Linear).
 * - El autor puede editar inline o eliminar; otros usuarios sólo ven.
 *   El back-end es la autoridad final — el front no asume permisos
 *   más allá de mostrar/ocultar botones.
 * - Composer abajo con Cmd/Ctrl+Enter para enviar.
 *
 * No resolvemos `user_id → display_name` aquí: muestra "Usuario #N"
 * como placeholder. La resolución vendrá en el commit de menciones,
 * cuando consultamos `/wp/v2/users` o el endpoint propio.
 */
interface CommentsPanelProps {
    listId: number;
    recordId: number;
    currentUserId: number;
    isAdmin: boolean;
}

export function CommentsPanel({
    listId,
    recordId,
    currentUserId,
    isAdmin,
}: CommentsPanelProps): JSX.Element {
    const comments = useComments(listId, recordId);
    const create = useCreateComment(listId, recordId);
    const update = useUpdateComment(listId, recordId);
    const remove = useDeleteComment(listId, recordId);

    const [draft, setDraft] = useState('');
    const [submitError, setSubmitError] = useState<string | null>(null);
    const listEndRef = useRef<HTMLDivElement | null>(null);

    // Scroll al final al recibir nuevos comentarios — UX típica de chat.
    useEffect(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments.data?.length]);

    const handleSubmit = async (e?: React.FormEvent): Promise<void> => {
        e?.preventDefault();
        setSubmitError(null);
        const content = draft.trim();
        if (content === '') return;
        try {
            await create.mutateAsync({ content });
            setDraft('');
        } catch (err) {
            if (err instanceof ApiError || err instanceof Error) {
                setSubmitError(err.message);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void handleSubmit();
        }
    };

    return (
        <div className="imcrm-flex imcrm-h-full imcrm-flex-col imcrm-gap-3">
            <div className="imcrm-flex-1 imcrm-overflow-y-auto imcrm-pr-1">
                {comments.isLoading ? (
                    <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-text-muted-foreground">
                        <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                        {__('Cargando comentarios…')}
                    </div>
                ) : comments.isError ? (
                    <div className="imcrm-rounded-md imcrm-border imcrm-border-destructive/40 imcrm-bg-destructive/10 imcrm-p-3 imcrm-text-sm imcrm-text-destructive">
                        {(comments.error as Error).message}
                    </div>
                ) : !comments.data || comments.data.length === 0 ? (
                    <EmptyState />
                ) : (
                    <ul className="imcrm-flex imcrm-flex-col imcrm-gap-3">
                        {comments.data.map((c) => (
                            <CommentItem
                                key={c.id}
                                comment={c}
                                canEdit={isAdmin || c.user_id === currentUserId}
                                canDelete={isAdmin || c.user_id === currentUserId}
                                onUpdate={(content) =>
                                    update.mutateAsync({ id: c.id, content })
                                }
                                onDelete={() => remove.mutateAsync(c.id)}
                            />
                        ))}
                        <div ref={listEndRef} />
                    </ul>
                )}
            </div>

            <form
                onSubmit={handleSubmit}
                className="imcrm-flex imcrm-flex-col imcrm-gap-2 imcrm-border-t imcrm-border-border imcrm-pt-3"
            >
                <Textarea
                    placeholder={__('Escribe un comentario… (Cmd/Ctrl+Enter para enviar)')}
                    rows={3}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={create.isPending}
                />
                {submitError && (
                    <p className="imcrm-text-xs imcrm-text-destructive">{submitError}</p>
                )}
                <div className="imcrm-flex imcrm-justify-end">
                    <Button
                        type="submit"
                        size="sm"
                        disabled={draft.trim() === '' || create.isPending}
                        className="imcrm-gap-1.5"
                    >
                        <Send className="imcrm-h-3.5 imcrm-w-3.5" />
                        {create.isPending ? __('Enviando…') : __('Enviar')}
                    </Button>
                </div>
            </form>
        </div>
    );
}

interface CommentItemProps {
    comment: CommentEntity;
    canEdit: boolean;
    canDelete: boolean;
    onUpdate: (content: string) => Promise<unknown>;
    onDelete: () => Promise<unknown>;
}

function CommentItem({
    comment,
    canEdit,
    canDelete,
    onUpdate,
    onDelete,
}: CommentItemProps): JSX.Element {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(comment.content);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async (): Promise<void> => {
        const content = draft.trim();
        if (content === '' || content === comment.content) {
            setEditing(false);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onUpdate(content);
            setEditing(false);
        } catch (err) {
            if (err instanceof Error) setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!window.confirm(__('¿Eliminar este comentario?'))) return;
        try {
            await onDelete();
        } catch (err) {
            if (err instanceof Error) setError(err.message);
        }
    };

    const wasEdited = comment.created_at !== comment.updated_at;

    return (
        <li className="imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-3">
            <header className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-2">
                <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs">
                    <span className="imcrm-flex imcrm-h-6 imcrm-w-6 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-bg-primary/10 imcrm-text-primary imcrm-font-semibold">
                        {String(comment.user_id).slice(-2)}
                    </span>
                    <span className="imcrm-font-medium">
                        {sprintf(
                            /* translators: %d: user id */
                            __('Usuario #%d'),
                            comment.user_id,
                        )}
                    </span>
                    <span className="imcrm-text-muted-foreground">
                        {new Date(comment.created_at + 'Z').toLocaleString()}
                    </span>
                    {wasEdited && (
                        <span className="imcrm-text-muted-foreground">{__('(editado)')}</span>
                    )}
                </div>
                {!editing && (canEdit || canDelete) && (
                    <div className="imcrm-flex imcrm-gap-1">
                        {canEdit && (
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="imcrm-rounded imcrm-p-1 imcrm-text-muted-foreground hover:imcrm-bg-accent hover:imcrm-text-foreground"
                                aria-label={__('Editar')}
                            >
                                <Pencil className="imcrm-h-3.5 imcrm-w-3.5" />
                            </button>
                        )}
                        {canDelete && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="imcrm-rounded imcrm-p-1 imcrm-text-muted-foreground hover:imcrm-bg-destructive/10 hover:imcrm-text-destructive"
                                aria-label={__('Eliminar')}
                            >
                                <Trash2 className="imcrm-h-3.5 imcrm-w-3.5" />
                            </button>
                        )}
                    </div>
                )}
            </header>

            {editing ? (
                <div className="imcrm-mt-2 imcrm-flex imcrm-flex-col imcrm-gap-2">
                    <Textarea
                        rows={3}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                    />
                    {error && <p className="imcrm-text-xs imcrm-text-destructive">{error}</p>}
                    <div className="imcrm-flex imcrm-justify-end imcrm-gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setDraft(comment.content);
                                setEditing(false);
                                setError(null);
                            }}
                        >
                            {__('Cancelar')}
                        </Button>
                        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? __('Guardando…') : __('Guardar')}
                        </Button>
                    </div>
                </div>
            ) : (
                <CommentContent content={comment.content} />
            )}
        </li>
    );
}

function EmptyState(): JSX.Element {
    return (
        <div className="imcrm-flex imcrm-flex-col imcrm-items-center imcrm-gap-2 imcrm-py-8 imcrm-text-center imcrm-text-muted-foreground">
            <MessageSquare className="imcrm-h-6 imcrm-w-6" />
            <p className="imcrm-text-sm">{__('Aún no hay comentarios.')}</p>
            <p className="imcrm-text-xs">{__('Inicia la conversación enviando el primero.')}</p>
        </div>
    );
}
