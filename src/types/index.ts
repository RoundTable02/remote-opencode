import type { ChildProcess } from 'node:child_process';

export interface ProjectConfig {
  alias: string;
  path: string;
}

export interface ChannelBinding {
  channelId: string;
  projectAlias: string;
}

export interface DataStore {
  projects: ProjectConfig[];
  bindings: ChannelBinding[];
  threadSessions?: ThreadSession[];
  worktreeMappings?: WorktreeMapping[];
  passthroughThreads?: PassthroughThread[];
}

export interface TextPart {
  id: string;
  sessionID: string;
  messageID: string;
  text: string;
}

export interface SSEEvent {
  type: string;
  properties: Record<string, unknown>;
}

export interface ServeInstance {
  port: number;
  process: ChildProcess;
  startTime: number;
}

export interface ThreadSession {
  threadId: string;
  sessionId: string;
  projectPath: string;
  port: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface WorktreeMapping {
  threadId: string;
  branchName: string;
  worktreePath: string;
  projectPath: string;
  description: string;
  createdAt: number;
}

export interface PassthroughThread {
  threadId: string;
  enabled: boolean;
  enabledBy: string;  // userId
  enabledAt: number;
}
