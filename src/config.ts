import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { normalizeWorkspaceId, parseGitHubRemote, RepoInfo } from './core';

export { RepoInfo } from './core';

export function settings() {
  return vscode.workspace.getConfiguration('zhIssues');
}

/** Workspace ID setting, normalized from a bare ID, URL slug, or full board URL. */
export function workspaceId(): string {
  return normalizeWorkspaceId(settings().get<string>('workspaceId', ''));
}

export function defaultPipeline(): string {
  return settings().get<string>('defaultPipeline', 'Backlog').trim();
}

/** Repository to limit the board to, as "owner/name" or "name". Empty = all. */
export function repoFilter(): string {
  return settings().get<string>('repoFilter', '').trim();
}

/** Action IDs hidden from the per-issue options menu. */
export function hiddenIssueOptions(): string[] {
  return settings().get<string[]>('hiddenIssueOptions', []);
}

/** Directory the zh CLI runs in. zh derives owner/repo from this directory's git remote. */
export function repoDir(): string | undefined {
  const configured = settings().get<string>('localRepoPath', '').trim();
  if (configured) {
    return configured;
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/** Resolve the zh binary: explicit setting, PATH, then the default install location. */
export function resolveZhPath(): string | undefined {
  const configured = settings().get<string>('cliPath', '').trim();
  if (configured) {
    return fs.existsSync(configured) ? configured : undefined;
  }
  try {
    cp.execFileSync('zh', ['--version'], { stdio: 'ignore' });
    return 'zh';
  } catch {
    // not on PATH
  }
  const fallback = path.join(os.homedir(), '.zenhub-cli', 'zh');
  return fs.existsSync(fallback) ? fallback : undefined;
}

/**
 * Read the Zenhub GraphQL token the same way zh does: ZH_TOKEN from the
 * environment, otherwise from ~/.config/zh/config.
 */
export function readZhToken(): string | undefined {
  if (process.env.ZH_TOKEN) {
    return process.env.ZH_TOKEN;
  }
  const configFile = path.join(os.homedir(), '.config', 'zh', 'config');
  try {
    const content = fs.readFileSync(configFile, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*(?:export\s+)?ZH_TOKEN=("?)(.*)\1\s*$/);
      if (match && match[2]) {
        return match[2];
      }
    }
  } catch {
    // no config file
  }
  return undefined;
}

/** Parse owner/name from the git remote at dir, mirroring zh's get_repo_info. */
export function gitRepoInfo(dir: string): RepoInfo | undefined {
  let remoteUrl: string;
  try {
    remoteUrl = cp
      .execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: dir, encoding: 'utf8' })
      .trim();
  } catch {
    return undefined;
  }
  return parseGitHubRemote(remoteUrl);
}
