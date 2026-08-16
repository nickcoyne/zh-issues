const ENDPOINT = 'https://api.zenhub.com/public/graphql';

export interface Pipeline {
  id: string;
  name: string;
}

export interface WorkspaceRepository {
  id: string;
  name: string;
  ownerName: string;
}

export interface WorkspaceInfo {
  name: string;
  pipelines: Pipeline[];
  repositories: WorkspaceRepository[];
}

export interface IssueLabel {
  name: string;
  color: string | null;
}

export interface IssueAssignee {
  login: string;
  name: string | null;
}

export interface ZenhubIssue {
  id: string;
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  zenhubUrl: string;
  estimate: number | null;
  repoOwner: string;
  repoName: string;
  labels: IssueLabel[];
  assignees: IssueAssignee[];
  /** Issues blocking this one ("N Blocking" badge in the Zenhub UI). */
  blockedByCount: number;
  /** Issues this one blocks. */
  blocksCount: number;
  priority: string | null;
  parent: { number: number; title: string; htmlUrl: string } | null;
}

export interface WorkspaceUser {
  login: string;
  name: string | null;
}

export class ZenhubApiError extends Error {}

const WORKSPACE_QUERY = `
query($workspaceId: ID!) {
  workspace(id: $workspaceId) {
    name
    pipelinesConnection {
      nodes { id name }
    }
    repositoriesConnection {
      nodes { id name ownerName }
    }
  }
}`;

const ISSUES_QUERY = `
query($pipelineId: ID!, $workspaceId: ID!, $filters: IssueSearchFiltersInput!, $after: String) {
  searchIssuesByPipeline(pipelineId: $pipelineId, filters: $filters, first: 50, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      number
      title
      state
      htmlUrl
      zenhubUrl(workspaceId: $workspaceId)
      estimate { value }
      repository { ownerName name }
      labels { nodes { name color } }
      assignees { nodes { login name } }
      blockingIssues { nodes { number } }
      blockedIssues { nodes { number } }
      parentIssue { number title htmlUrl }
      pipelineIssue(workspaceId: $workspaceId) {
        priority { name }
      }
    }
  }
}`;

const USERS_QUERY = `
query($workspaceId: ID!) {
  workspace(id: $workspaceId) {
    assignees {
      nodes { login name }
    }
  }
}`;

const WORKSPACES_BY_REPO_QUERY = `
query($ghIds: [Int!]!) {
  repositoriesByGhId(ghIds: $ghIds) {
    workspacesConnection {
      nodes { id name }
    }
  }
}`;

const MAX_ISSUES = 200;

/** Read-only GraphQL client. Queries mirror the ones the zh CLI uses. */
export class ZenhubApi {
  constructor(private readonly token: string) {}

  private async gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30_000)
      });
    } catch (e) {
      const reason =
        (e as Error).name === 'TimeoutError' ? 'timed out after 30s' : (e as Error).message;
      throw new ZenhubApiError(`Could not reach the Zenhub API: ${reason}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ZenhubApiError(
        'Zenhub rejected the API token. Check ZH_TOKEN in ~/.config/zh/config.'
      );
    }
    if (!res.ok) {
      throw new ZenhubApiError(`Zenhub API returned HTTP ${res.status}.`);
    }
    const body = (await res.json()) as {
      data?: T;
      errors?: { message: string }[];
    };
    if (body.errors?.length) {
      throw new ZenhubApiError(body.errors.map((e) => e.message).join('; '));
    }
    if (!body.data) {
      throw new ZenhubApiError('Zenhub API returned an empty response.');
    }
    return body.data;
  }

  async getWorkspace(workspaceId: string): Promise<WorkspaceInfo> {
    const data = await this.gql<{
      workspace: {
        name: string;
        pipelinesConnection: { nodes: Pipeline[] };
        repositoriesConnection: { nodes: WorkspaceRepository[] };
      } | null;
    }>(WORKSPACE_QUERY, { workspaceId });
    if (!data.workspace) {
      throw new ZenhubApiError(`Workspace "${workspaceId}" was not found.`);
    }
    return {
      name: data.workspace.name,
      pipelines: data.workspace.pipelinesConnection.nodes,
      repositories: data.workspace.repositoriesConnection.nodes
    };
  }

  async getPipelineIssues(
    pipelineId: string,
    workspaceId: string,
    repositoryIds?: string[]
  ): Promise<ZenhubIssue[]> {
    interface RawIssue {
      id: string;
      number: number;
      title: string;
      state: string;
      htmlUrl: string;
      zenhubUrl: string;
      estimate: { value: number } | null;
      repository: { ownerName: string; name: string } | null;
      labels: { nodes: { name: string; color: string | null }[] };
      assignees: { nodes: { login: string; name: string | null }[] };
      blockingIssues: { nodes: { number: number }[] };
      blockedIssues: { nodes: { number: number }[] };
      parentIssue: { number: number; title: string; htmlUrl: string } | null;
      pipelineIssue: { priority: { name: string } | null } | null;
    }

    const filters = repositoryIds?.length ? { repositoryIds } : {};
    const issues: ZenhubIssue[] = [];
    let after: string | null = null;
    do {
      const data: {
        searchIssuesByPipeline: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: RawIssue[];
        };
      } = await this.gql(ISSUES_QUERY, { pipelineId, workspaceId, filters, after });
      const conn = data.searchIssuesByPipeline;
      for (const raw of conn.nodes) {
        issues.push({
          id: raw.id,
          number: raw.number,
          title: raw.title,
          state: raw.state,
          htmlUrl: raw.htmlUrl,
          zenhubUrl: raw.zenhubUrl,
          estimate: raw.estimate?.value ?? null,
          repoOwner: raw.repository?.ownerName ?? '',
          repoName: raw.repository?.name ?? '',
          labels: raw.labels.nodes,
          assignees: raw.assignees.nodes,
          blockedByCount: raw.blockingIssues.nodes.length,
          blocksCount: raw.blockedIssues.nodes.length,
          priority: raw.pipelineIssue?.priority?.name ?? null,
          parent: raw.parentIssue
        });
      }
      after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (after && issues.length < MAX_ISSUES);
    return issues;
  }

  async getWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
    const data = await this.gql<{
      workspace: { assignees: { nodes: WorkspaceUser[] } } | null;
    }>(USERS_QUERY, { workspaceId });
    return data.workspace?.assignees.nodes ?? [];
  }

  async getWorkspacesForRepo(repoGhId: number): Promise<{ id: string; name: string }[]> {
    const data = await this.gql<{
      repositoriesByGhId: { workspacesConnection: { nodes: { id: string; name: string }[] } }[];
    }>(WORKSPACES_BY_REPO_QUERY, { ghIds: [repoGhId] });
    return data.repositoriesByGhId[0]?.workspacesConnection.nodes ?? [];
  }
}
