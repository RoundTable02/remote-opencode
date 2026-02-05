import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const execAsync = promisify(exec);

export function sanitizeBranchName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9./_-]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function branchExists(
  projectPath: string,
  branchName: string,
): Promise<{ local: boolean; remote: boolean }> {
  try {
    const [localRes, remoteRes] = await Promise.all([
      execAsync(`git branch --list ${branchName}`, { cwd: projectPath }).catch(() => ({
        stdout: '',
      })),
      execAsync(`git branch -r --list origin/${branchName}`, { cwd: projectPath }).catch(() => ({
        stdout: '',
      })),
    ]);

    return {
      local: localRes.stdout.trim().length > 0,
      remote: remoteRes.stdout.trim().length > 0,
    };
  } catch (error) {
    console.error('Error checking branch existence:', error);
    return { local: false, remote: false };
  }
}

export async function createWorktree(projectPath: string, branchName: string): Promise<string> {
  const sanitizedBranch = sanitizeBranchName(branchName);
  const worktreeDir = join(projectPath, 'worktrees', sanitizedBranch);
  const absolutePath = resolve(worktreeDir);

  const { local, remote } = await branchExists(projectPath, sanitizedBranch);

  try {
    if (local || remote) {
      await execAsync(`git worktree add ./worktrees/${sanitizedBranch} ${sanitizedBranch}`, {
        cwd: projectPath,
      });
    } else {
      await execAsync(`git worktree add ./worktrees/${sanitizedBranch} -b ${sanitizedBranch}`, {
        cwd: projectPath,
      });
    }

    return absolutePath;
  } catch (error) {
    console.error('Error creating worktree:', error);
    throw new Error(`Failed to create worktree: ${(error as Error).message}`);
  }
}

export async function removeWorktree(worktreePath: string, deleteBranch?: boolean): Promise<void> {
  try {
    let branchName: string | undefined;
    if (deleteBranch) {
      const { stdout } = await execAsync('git branch --show-current', { cwd: worktreePath });
      branchName = stdout.trim();
    }

    const projectPath = resolve(worktreePath, '..', '..');

    await execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: projectPath });

    if (deleteBranch && branchName) {
      await execAsync(`git branch -D ${branchName}`, { cwd: projectPath });
    }
  } catch (error) {
    console.error('Error removing worktree:', error);
    throw new Error(`Failed to remove worktree: ${(error as Error).message}`);
  }
}

export function worktreeExists(worktreePath: string): boolean {
  return existsSync(worktreePath);
}
