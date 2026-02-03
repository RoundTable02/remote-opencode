import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { DataStore, ProjectConfig, ChannelBinding, ThreadSession, WorktreeMapping, PassthroughThread } from '../types/index.js';

const CONFIG_DIR = join(homedir(), '.remote-opencode');
const DATA_FILE = join(CONFIG_DIR, 'data.json');

function ensureDataDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadData(): DataStore {
  ensureDataDir();
  if (!existsSync(DATA_FILE)) {
    return { projects: [], bindings: [] };
  }
  try {
    const content = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content) as DataStore;
  } catch {
    return { projects: [], bindings: [] };
  }
}

function saveData(data: DataStore): void {
  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function addProject(alias: string, path: string): void {
  const data = loadData();
  const existing = data.projects.findIndex(p => p.alias === alias);
  if (existing >= 0) {
    data.projects[existing].path = path;
  } else {
    data.projects.push({ alias, path });
  }
  saveData(data);
}

export function getProjects(): ProjectConfig[] {
  return loadData().projects;
}

export function getProject(alias: string): ProjectConfig | undefined {
  return loadData().projects.find(p => p.alias === alias);
}

export function removeProject(alias: string): boolean {
  const data = loadData();
  const idx = data.projects.findIndex(p => p.alias === alias);
  if (idx < 0) return false;
  data.projects.splice(idx, 1);
  data.bindings = data.bindings.filter(b => b.projectAlias !== alias);
  saveData(data);
  return true;
}

export function setChannelBinding(channelId: string, projectAlias: string): void {
  const data = loadData();
  const existing = data.bindings.findIndex(b => b.channelId === channelId);
  if (existing >= 0) {
    data.bindings[existing].projectAlias = projectAlias;
  } else {
    data.bindings.push({ channelId, projectAlias });
  }
  saveData(data);
}

export function getChannelBinding(channelId: string): string | undefined {
  const binding = loadData().bindings.find(b => b.channelId === channelId);
  return binding?.projectAlias;
}

export function getChannelProjectPath(channelId: string): string | undefined {
  const alias = getChannelBinding(channelId);
  if (!alias) return undefined;
  const project = getProject(alias);
  return project?.path;
}

export function getThreadSession(threadId: string): ThreadSession | undefined {
  const data = loadData();
  return data.threadSessions?.find(s => s.threadId === threadId);
}

export function setThreadSession(session: ThreadSession): void {
  const data = loadData();
  if (!data.threadSessions) {
    data.threadSessions = [];
  }
  const existing = data.threadSessions.findIndex(s => s.threadId === session.threadId);
  if (existing >= 0) {
    data.threadSessions[existing] = session;
  } else {
    data.threadSessions.push(session);
  }
  saveData(data);
}

export function updateThreadSessionLastUsed(threadId: string): void {
  const data = loadData();
  const session = data.threadSessions?.find(s => s.threadId === threadId);
  if (session) {
    session.lastUsedAt = Date.now();
    saveData(data);
  }
}

export function clearThreadSession(threadId: string): void {
  const data = loadData();
  if (data.threadSessions) {
    data.threadSessions = data.threadSessions.filter(s => s.threadId !== threadId);
    saveData(data);
  }
}

export function getAllThreadSessions(): ThreadSession[] {
  return loadData().threadSessions ?? [];
}

export function setWorktreeMapping(mapping: WorktreeMapping): void {
  const data = loadData();
  if (!data.worktreeMappings) {
    data.worktreeMappings = [];
  }
  const existing = data.worktreeMappings.findIndex(m => m.threadId === mapping.threadId);
  if (existing >= 0) {
    data.worktreeMappings[existing] = mapping;
  } else {
    data.worktreeMappings.push(mapping);
  }
  saveData(data);
}

export function getWorktreeMapping(threadId: string): WorktreeMapping | undefined {
  const data = loadData();
  return data.worktreeMappings?.find(m => m.threadId === threadId);
}

export function getWorktreeMappingByBranch(projectPath: string, branchName: string): WorktreeMapping | undefined {
  const data = loadData();
  return data.worktreeMappings?.find(m => m.projectPath === projectPath && m.branchName === branchName);
}

export function removeWorktreeMapping(threadId: string): boolean {
  const data = loadData();
  if (!data.worktreeMappings) return false;
  const idx = data.worktreeMappings.findIndex(m => m.threadId === threadId);
  if (idx < 0) return false;
  data.worktreeMappings.splice(idx, 1);
  saveData(data);
  return true;
}

export function getAllWorktreeMappings(): WorktreeMapping[] {
  return loadData().worktreeMappings ?? [];
}

export function getWorktreeMappingsByProject(projectPath: string): WorktreeMapping[] {
  const data = loadData();
  return data.worktreeMappings?.filter(m => m.projectPath === projectPath) ?? [];
}

export function setPassthroughMode(threadId: string, enabled: boolean, userId: string): void {
  const data = loadData();
  if (!data.passthroughThreads) {
    data.passthroughThreads = [];
  }
  const existing = data.passthroughThreads.findIndex(p => p.threadId === threadId);
  if (existing >= 0) {
    data.passthroughThreads[existing] = {
      threadId,
      enabled,
      enabledBy: userId,
      enabledAt: Date.now()
    };
  } else {
    data.passthroughThreads.push({
      threadId,
      enabled,
      enabledBy: userId,
      enabledAt: Date.now()
    });
  }
  saveData(data);
}

export function getPassthroughMode(threadId: string): PassthroughThread | undefined {
  const data = loadData();
  return data.passthroughThreads?.find(p => p.threadId === threadId);
}

export function isPassthroughEnabled(threadId: string): boolean {
  const passthrough = getPassthroughMode(threadId);
  return passthrough?.enabled ?? false;
}

export function removePassthroughMode(threadId: string): boolean {
  const data = loadData();
  if (!data.passthroughThreads) return false;
  const idx = data.passthroughThreads.findIndex(p => p.threadId === threadId);
  if (idx < 0) return false;
  data.passthroughThreads.splice(idx, 1);
  saveData(data);
  return true;
}
