I have completed the task.

1.  **Imports Added**: Added `ThreadChannel` from `discord.js` and imported `dataStore` and `worktreeManager`.
2.  **Button Handler Logic**: Updated `handleButton` to dispatch `delete` and `pr` actions.
3.  **Functions Implemented**:
    - `handleWorktreeDelete`: Removes worktree (preserving branch), clears mapping, and archives thread.
    - `handleWorktreePR`: Spawns server, manages session, and sends a PR prompt to OpenCode.
4.  **Verification**: Ran `npx tsc --noEmit` and it passed without errors.

The code in `src/handlers/buttonHandler.ts` now supports the requested Delete and PR buttons.
