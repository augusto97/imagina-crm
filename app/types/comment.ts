export interface CommentEntity {
    id: number;
    list_id: number;
    record_id: number;
    user_id: number;
    parent_id: number | null;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface CreateCommentInput {
    content: string;
    parent_id?: number | null;
}
