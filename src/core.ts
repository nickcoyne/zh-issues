/**
 * Pure logic with no vscode/API dependencies, extracted so it can be unit
 * tested with `node --test`.
 */

export interface RepoInfo {
  owner: string;
  name: string;
}

export interface RepoRef {
  id: string;
  name: string;
  ownerName: string;
}

export interface PipelineRef {
  id: string;
  name: string;
}

/** Parse owner/name from a GitHub remote URL (ssh or https). */
export function parseGitHubRemote(remoteUrl: string): RepoInfo | undefined {
  // Keep dots in the repo name (e.g. acme/foo.js); only strip a trailing .git.
  const match = remoteUrl.trim().match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (!match) {
    return undefined;
  }
  return { owner: match[1], name: match[2] };
}

/**
 * Accepts a bare workspace ID, the URL slug ("my-team-<id>"), or a full board
 * URL, and normalizes to the trailing 24-hex ID the API expects.
 */
export function normalizeWorkspaceId(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/([0-9a-fA-F]{24})(?:\/|$)/);
  return match ? match[1] : trimmed;
}

/**
 * Resolve a repo filter ("owner/name" or "name", case-insensitive) against a
 * workspace's repositories. Empty filter matches everything (no ids).
 */
export function matchRepoFilter(
  filter: string,
  repositories: RepoRef[]
): { ids?: string[]; error?: string } {
  if (!filter) {
    return {};
  }
  const slash = filter.indexOf('/');
  const owner = slash === -1 ? undefined : filter.slice(0, slash).toLowerCase();
  const name = (slash === -1 ? filter : filter.slice(slash + 1)).toLowerCase();
  const matches = repositories.filter(
    (r) => r.name.toLowerCase() === name && (!owner || r.ownerName.toLowerCase() === owner)
  );
  if (!matches.length) {
    const available = repositories.map((r) => `${r.ownerName}/${r.name}`).join(', ');
    return {
      error:
        `The "zhIssues.repoFilter" setting ("${filter}") doesn't match any repository in this ` +
        `workspace. Available: ${available}`
    };
  }
  return { ids: matches.map((r) => r.id) };
}

/** Last saved selection if still valid, then the default name, then the first pipeline. */
export function choosePipeline(
  pipelines: PipelineRef[],
  savedId: string | undefined,
  defaultName: string
): string | undefined {
  if (savedId && pipelines.some((p) => p.id === savedId)) {
    return savedId;
  }
  const wanted = defaultName.trim().toLowerCase();
  const byName = pipelines.find((p) => p.name.trim().toLowerCase() === wanted);
  return (byName ?? pipelines[0])?.id;
}
