export type T1 = `t1_${string}`;
export type T3 = `t3_${string}`;

export const isCommentId = (id: string): id is T1 => id.startsWith('t1_');
export const isPostId = (id: string): id is T3 => id.startsWith('t3_');
