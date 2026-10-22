export type TodoItem = {
    id?: string;
    content: string;
    status: string;
    priority?: string;
};
type ToastItem = {
    title?: string;
    message: string;
    variant?: string;
};
export type AdapterState = {
    directory: string;
    status: Map<string, {
        type: string;
    }>;
    sessions: Map<string, Record<string, unknown>>;
    pendingManualContinue: Set<string>;
    recordParent: (childID: string, parentID: string) => void;
    parentOf: (childID: string) => string | undefined;
    parents: () => Record<string, string>;
    recordTodos: (sessionID: string, input: unknown) => void;
    todos: (sessionID: string) => TodoItem[];
    forgetTodos: (sessionID: string) => void;
    /** Hands the session's list over to another state directory (the session moved there). */
    moveTodos: (sessionID: string, fromDirectory: string, toDirectory: string) => boolean;
    recordToast: (input: {
        title?: string;
        message?: string;
        variant?: string;
        duration?: number;
    }) => void;
    readToasts: () => ToastItem[];
    noteStatus: (sessionID: string, type: string) => void;
    noteSession: (session: Record<string, unknown>) => void;
};
/**
 * `directory` is the location's `.omo/v2-state`. OpenCode 2 delivers every
 * session's events to every location's plugin instance, and a session can move
 * to another directory, so a todo list has one owner: the state directory that
 * last wrote it, kept in a user-level index (`todoOwnersFile`).
 */
export declare function createAdapterState(directory: string, options?: {
    todoOwnersFile?: string;
}): AdapterState;
export {};
