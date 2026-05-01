import { useMemo, useState } from 'react';
import {
    Activity as ActivityIcon,
    AtSign,
    Loader2,
    MessageSquare,
    Pencil,
    Plus,
    Send,
    Trash2,
} from 'lucide-react';

import { CommentContent } from '@/admin/comments/CommentContent';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useRecordActivity } from '@/hooks/useActivity';
import {
    useComments,
    useCreateComment,
    useDeleteComment,
    useUpdateComment,
} from '@/hooks/useComments';
import { ApiError } from '@/lib/api';
import { __, sprintf } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { colorFromString, initialsFromValue } from '@/lib/recordCategorize';
import type { ActivityEntity } from '@/types/activity';
import type { CommentEntity } from '@/types/comment';

interface RecordTimelineProps {
    listId: number;
    recordId: number;
    currentUserId: number;
    isAdmin: boolean;
}

type Filter = 'all' | 'comments' | 'changes';

interface TimelineItem {
    kind: 'comment' | 'activity';
    timestamp: number;
    comment?: CommentEntity;
    activity?: ActivityEntity;
}

/**
 * Timeline unificada del layout CRM. Mergea client-side los
 * comentarios y el activity log del record en un solo feed
 * cronológico (desc), con composer de comentario al tope y filtros
 * (Todos / Comentarios / Cambios) al header.
 *
 * Usa los mismos hooks que CommentsPanel/ActivityPanel — los
 * datos están duplicados en cache de TanStack Query, no hay
 * round-trip extra al server por unificarlos visualmente.
 */
export function RecordTimeline({
    listId,
    recordId,
    currentUserId,
    isAdmin,
}: RecordTimelineProps): JSX.Element {
    const comments = useComments(listId, recordId);
    const activity = useRecordActivity(listId, recordId);
    const createComment = useCreateComment(listId, recordId);
    const updateComment = useUpdateComment(listId, recordId);
    const deleteComment = useDeleteComment(listId, recordId);
    const toast = useToast();
    const confirm = useConfirm();

    const [draft, setDraft] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState('');

    const items = useMemo<TimelineItem[]>(() => {
        const result: TimelineItem[] = [];
        if (filter !== 'changes' && comments.data) {
            for (const c of comments.data) {
                result.push({
                    kind: 'comment',
                    timestamp: parseTimestamp(c.created_at),
                    comment: c,
                });
            }
        }
        if (filter !== 'comments' && activity.data) {
            for (const a of activity.data) {
                // El back-end ya emite `comment.created` — para no
                // duplicarlo con el comentario en sí, lo filtramos
                // cuando ya estamos mostrando comments.
                if (filter === 'all' && a.action.startsWith('comment.')) continue;
                result.push({
                    kind: 'activity',
                    timestamp: parseTimestamp(a.created_at),
                    activity: a,
                });
            }
        }
        result.sort((a, b) => b.timestamp - a.timestamp);
        return result;
    }, [comments.data, activity.data, filter]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        const content = draft.trim();
        if (content === '') return;
        try {
            await createComment.mutateAsync({ content });
            setDraft('');
        } catch (err) {
            const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Error';
            toast.error(__('No se pudo publicar'), msg);
        }
    };

    const handleEdit = async (id: number): Promise<void> => {
        const content = editDraft.trim();
        if (content === '') return;
        try {
            await updateComment.mutateAsync({ id, content });
            setEditingId(null);
            setEditDraft('');
        } catch (err) {
            const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Error';
            toast.error(__('No se pudo editar'), msg);
        }
    };

    const handleDelete = async (id: number): Promise<void> => {
        const ok = await confirm({
            title: __('Eliminar comentario'),
            description: __('Esta acción no se puede deshacer.'),
            destructive: true,
            confirmLabel: __('Eliminar'),
        });
        if (! ok) return;
        try {
            await deleteComment.mutateAsync(id);
        } catch (err) {
            if (err instanceof Error) toast.error(__('Error'), err.message);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void handleSubmit(e as unknown as React.FormEvent);
        }
    };

    const isLoading = comments.isLoading || activity.isLoading;

    return (
        <section className="imcrm-flex imcrm-flex-col imcrm-gap-4 imcrm-rounded-xl imcrm-border imcrm-border-border imcrm-bg-card imcrm-p-5">
            <header className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-gap-3">
                <h2 className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-font-semibold">
                    <ActivityIcon className="imcrm-h-4 imcrm-w-4 imcrm-text-primary" />
                    {__('Actividad del registro')}
                </h2>
                <div className="imcrm-flex imcrm-gap-1 imcrm-rounded-md imcrm-border imcrm-border-border imcrm-bg-muted/40 imcrm-p-0.5">
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
                        {__('Todo')}
                    </FilterButton>
                    <FilterButton active={filter === 'comments'} onClick={() => setFilter('comments')}>
                        {__('Comentarios')}
                    </FilterButton>
                    <FilterButton active={filter === 'changes'} onClick={() => setFilter('changes')}>
                        {__('Cambios')}
                    </FilterButton>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                <Textarea
                    placeholder={__('Escribe una nota o comentario…')}
                    rows={3}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <div className="imcrm-flex imcrm-items-center imcrm-justify-between imcrm-text-xs imcrm-text-muted-foreground">
                    <span>{__('Cmd/Ctrl + Enter para enviar')}</span>
                    <Button
                        type="submit"
                        size="sm"
                        disabled={draft.trim() === '' || createComment.isPending}
                        className="imcrm-gap-1.5"
                    >
                        {createComment.isPending ? (
                            <Loader2 className="imcrm-h-3 imcrm-w-3 imcrm-animate-spin" />
                        ) : (
                            <Send className="imcrm-h-3 imcrm-w-3" />
                        )}
                        {__('Publicar')}
                    </Button>
                </div>
            </form>

            <div className="imcrm-border-t imcrm-border-border imcrm-pt-3">
                {isLoading ? (
                    <div className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-sm imcrm-text-muted-foreground">
                        <Loader2 className="imcrm-h-4 imcrm-w-4 imcrm-animate-spin" />
                        {__('Cargando…')}
                    </div>
                ) : items.length === 0 ? (
                    <p className="imcrm-py-6 imcrm-text-center imcrm-text-sm imcrm-text-muted-foreground">
                        {filter === 'comments'
                            ? __('Aún no hay comentarios. Sé el primero arriba.')
                            : filter === 'changes'
                              ? __('Aún no hay cambios registrados.')
                              : __('Aún no hay actividad. Empieza con un comentario.')}
                    </p>
                ) : (
                    <ul className="imcrm-flex imcrm-flex-col imcrm-gap-4">
                        {items.map((item) => {
                            if (item.kind === 'comment' && item.comment) {
                                const c = item.comment;
                                const canEdit = isAdmin || c.user_id === currentUserId;
                                return (
                                    <CommentRow
                                        key={`c-${c.id}`}
                                        comment={c}
                                        canEdit={canEdit}
                                        editing={editingId === c.id}
                                        editDraft={editDraft}
                                        onStartEdit={() => {
                                            setEditingId(c.id);
                                            setEditDraft(c.content);
                                        }}
                                        onCancelEdit={() => setEditingId(null)}
                                        onChangeEdit={setEditDraft}
                                        onSubmitEdit={() => handleEdit(c.id)}
                                        onDelete={() => handleDelete(c.id)}
                                    />
                                );
                            }
                            if (item.kind === 'activity' && item.activity) {
                                return <ActivityRow key={`a-${item.activity.id}`} activity={item.activity} />;
                            }
                            return null;
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}

function parseTimestamp(s: string | null): number {
    if (! s) return 0;
    return new Date(s + 'Z').getTime();
}

function relativeTime(ts: number): string {
    if (ts === 0) return '—';
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return __('hace unos segundos');
    if (diff < 3600) return sprintf(__('hace %d min'), Math.floor(diff / 60));
    if (diff < 86400) return sprintf(__('hace %d h'), Math.floor(diff / 3600));
    if (diff < 86400 * 7) return sprintf(__('hace %d días'), Math.floor(diff / 86400));
    return new Date(ts).toLocaleDateString();
}

interface CommentRowProps {
    comment: CommentEntity;
    canEdit: boolean;
    editing: boolean;
    editDraft: string;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onChangeEdit: (v: string) => void;
    onSubmitEdit: () => void;
    onDelete: () => void;
}

function CommentRow({
    comment,
    canEdit,
    editing,
    editDraft,
    onStartEdit,
    onCancelEdit,
    onChangeEdit,
    onSubmitEdit,
    onDelete,
}: CommentRowProps): JSX.Element {
    const ts = parseTimestamp(comment.created_at);
    const userLabel = `Usuario #${comment.user_id}`;
    const initials = initialsFromValue(userLabel);
    const color = colorFromString(String(comment.user_id));

    return (
        <li className="imcrm-flex imcrm-gap-3">
            <div
                aria-hidden
                className="imcrm-flex imcrm-h-8 imcrm-w-8 imcrm-shrink-0 imcrm-items-center imcrm-justify-center imcrm-rounded-full imcrm-text-[11px] imcrm-font-semibold imcrm-text-white"
                style={{ backgroundColor: color }}
            >
                {initials}
            </div>
            <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col imcrm-gap-1">
                <header className="imcrm-flex imcrm-items-center imcrm-gap-2 imcrm-text-xs">
                    <span className="imcrm-font-medium imcrm-text-foreground">{userLabel}</span>
                    <span className="imcrm-text-muted-foreground">{relativeTime(ts)}</span>
                    {comment.updated_at !== comment.created_at && (
                        <span className="imcrm-text-muted-foreground">· {__('editado')}</span>
                    )}
                </header>
                {editing ? (
                    <div className="imcrm-flex imcrm-flex-col imcrm-gap-2">
                        <Textarea
                            rows={3}
                            value={editDraft}
                            onChange={(e) => onChangeEdit(e.target.value)}
                            autoFocus
                        />
                        <div className="imcrm-flex imcrm-gap-2">
                            <Button size="sm" onClick={onSubmitEdit} disabled={editDraft.trim() === ''}>
                                {__('Guardar')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                                {__('Cancelar')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="imcrm-rounded-lg imcrm-bg-muted/40 imcrm-px-3 imcrm-py-2 imcrm-text-sm">
                        <CommentContent content={comment.content} />
                    </div>
                )}
                {canEdit && ! editing && (
                    <div className="imcrm-flex imcrm-gap-3 imcrm-text-xs imcrm-text-muted-foreground">
                        <button
                            type="button"
                            onClick={onStartEdit}
                            className="imcrm-flex imcrm-items-center imcrm-gap-1 hover:imcrm-text-foreground"
                        >
                            <Pencil className="imcrm-h-3 imcrm-w-3" />
                            {__('Editar')}
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            className="imcrm-flex imcrm-items-center imcrm-gap-1 hover:imcrm-text-destructive"
                        >
                            <Trash2 className="imcrm-h-3 imcrm-w-3" />
                            {__('Eliminar')}
                        </button>
                    </div>
                )}
            </div>
        </li>
    );
}

function ActivityRow({ activity }: { activity: ActivityEntity }): JSX.Element {
    const ts = parseTimestamp(activity.created_at);
    const { Icon, iconColor, label } = describeActivity(activity);

    return (
        <li className="imcrm-flex imcrm-gap-3">
            <div
                aria-hidden
                className={cn(
                    'imcrm-flex imcrm-h-8 imcrm-w-8 imcrm-shrink-0 imcrm-items-center imcrm-justify-center imcrm-rounded-full',
                    iconColor,
                )}
            >
                <Icon className="imcrm-h-3.5 imcrm-w-3.5" />
            </div>
            <div className="imcrm-flex imcrm-min-w-0 imcrm-flex-1 imcrm-flex-col imcrm-py-1">
                <p className="imcrm-text-sm imcrm-text-foreground">{label}</p>
                <span className="imcrm-text-xs imcrm-text-muted-foreground">{relativeTime(ts)}</span>
            </div>
        </li>
    );
}

interface ActivityDescription {
    Icon: typeof Plus;
    iconColor: string;
    label: string;
}

function describeActivity(a: ActivityEntity): ActivityDescription {
    if (a.action === 'record.created') {
        return {
            Icon: Plus,
            iconColor: 'imcrm-bg-success/15 imcrm-text-success',
            label: __('Registro creado'),
        };
    }
    if (a.action === 'record.deleted') {
        return {
            Icon: Trash2,
            iconColor: 'imcrm-bg-destructive/15 imcrm-text-destructive',
            label: __('Registro eliminado'),
        };
    }
    if (a.action === 'record.updated') {
        const changes = a.changes as { fields?: Record<string, unknown> } | null;
        const fieldsChanged = changes?.fields && typeof changes.fields === 'object'
            ? Object.keys(changes.fields)
            : [];
        const label = fieldsChanged.length > 0
            ? sprintf(
                  /* translators: %s: comma-separated field labels */
                  __('Actualizó %s'),
                  fieldsChanged.join(', '),
              )
            : __('Actualizó el registro');
        return {
            Icon: Pencil,
            iconColor: 'imcrm-bg-info/15 imcrm-text-info',
            label,
        };
    }
    if (a.action.startsWith('comment.')) {
        return {
            Icon: MessageSquare,
            iconColor: 'imcrm-bg-primary/15 imcrm-text-primary',
            label: a.action === 'comment.created'
                ? __('Comentó')
                : a.action === 'comment.updated'
                  ? __('Editó un comentario')
                  : __('Eliminó un comentario'),
        };
    }
    if (a.action === 'automation.run') {
        return {
            Icon: AtSign,
            iconColor: 'imcrm-bg-warning/15 imcrm-text-warning',
            label: __('Automatización ejecutada'),
        };
    }
    return {
        Icon: ActivityIcon,
        iconColor: 'imcrm-bg-muted imcrm-text-muted-foreground',
        label: a.action,
    };
}

function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'imcrm-rounded imcrm-px-2 imcrm-py-1 imcrm-text-xs imcrm-font-medium imcrm-transition-colors',
                active
                    ? 'imcrm-bg-card imcrm-text-foreground imcrm-shadow-imcrm-sm'
                    : 'imcrm-text-muted-foreground hover:imcrm-text-foreground',
            )}
        >
            {children}
        </button>
    );
}
