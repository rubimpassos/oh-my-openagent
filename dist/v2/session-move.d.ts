import type { AdapterState } from "./adapter-state";
export type SessionMoveResult = {
    goal: boolean;
    todos: boolean;
    marker: boolean;
    works: number;
    parentLinks: number;
};
/**
 * OMO keeps a session's goal, todo list, continuation marker, Atlas works and
 * parent links under the project directory the session runs in. When OpenCode moves the
 * session to another directory (a worktree and its main checkout), they move
 * with it: the new directory's tools and continuations see them, the old one
 * stops acting on them, and deleting the old worktree loses nothing.
 */
export declare function moveSessionState(input: {
    fromDirectory: string;
    toDirectory: string;
    sessionID: string;
    state: AdapterState;
}): SessionMoveResult;
/** Follows a raw OpenCode 2 `session.moved` event; any other event is ignored. */
export declare function followSessionMove(raw: unknown, state: AdapterState): SessionMoveResult | undefined;
