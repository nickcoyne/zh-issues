import * as vscode from 'vscode';
import * as cp from 'child_process';
import {
  defaultPipeline,
  gitRepoInfo,
  hiddenIssueOptions,
  readZhToken,
  repoDir,
  repoFilter,
  resolveZhPath,
  workspaceId,
  RepoInfo
} from './config';
import { choosePipeline, matchRepoFilter } from './core';
import { Pipeline, WorkspaceRepository, ZenhubApi, ZenhubIssue } from './zenhubApi';
import { ZhCli } from './zhCli';

interface BoardState {
  phase: 'setup' | 'loading' | 'error' | 'ready';
  setupProblems?: string[];
  message?: string;
  workspaceName?: string;
  pipelines?: Pipeline[];
  currentPipelineId?: string;
  issues?: (ZenhubIssue & { canAct: boolean })[];
  hiddenOptions?: string[];
}

interface WebviewMessage {
  type: string;
  pipelineId?: string;
  url?: string;
  action?: string;
  issueId?: string;
}

const ESTIMATE_CHOICES = ['1', '2', '3', '5', '8', '13', '21', '40'];

export class BoardViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'zhIssues.pipeline';

  private view?: vscode.WebviewView;
  private pipelines: Pipeline[] = [];
  private repositories: WorkspaceRepository[] = [];
  private issues: ZenhubIssue[] = [];
  private currentPipelineId?: string;
  private localRepo?: RepoInfo;
  private loadGeneration = 0;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };
    view.webview.html = this.renderHtml(view.webview);
    view.webview.onDidReceiveMessage((msg: WebviewMessage) => this.onMessage(msg));
  }

  refresh(): void {
    void this.load();
  }

  private post(state: BoardState): void {
    void this.view?.webview.postMessage({ type: 'state', state });
  }

  private async onMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
      case 'refresh':
        await this.load();
        break;
      case 'selectPipeline':
        if (msg.pipelineId) {
          this.currentPipelineId = msg.pipelineId;
          await this.context.workspaceState.update(this.pipelineStateKey(), msg.pipelineId);
          await this.loadIssues();
        }
        break;
      case 'open':
        if (msg.url && /^https:\/\//.test(msg.url)) {
          void vscode.env.openExternal(vscode.Uri.parse(msg.url));
        }
        break;
      case 'openSettings':
        void vscode.commands.executeCommand('workbench.action.openSettings', 'zhIssues');
        break;
      case 'action':
        if (msg.action && msg.issueId) {
          await this.runAction(msg.action, msg.issueId);
        }
        break;
    }
  }

  private pipelineStateKey(): string {
    return `zhIssues.lastPipeline.${workspaceId()}`;
  }

  /** Missing prerequisites, or undefined when everything needed is present. */
  private setupProblems(): string[] | undefined {
    const problems: string[] = [];
    if (!resolveZhPath()) {
      problems.push(
        'The zh CLI was not found. Install it, or point the "zhIssues.cliPath" setting at the binary.'
      );
    }
    if (!readZhToken()) {
      problems.push(
        'No Zenhub token found. Set ZH_TOKEN in ~/.config/zh/config (the zh CLI config).'
      );
    }
    if (!workspaceId()) {
      problems.push(
        'No workspace configured. Set "zhIssues.workspaceId", or run "Issues for Zenhub: Detect Workspace from Repository".'
      );
    }
    return problems.length ? problems : undefined;
  }

  private api(): ZenhubApi {
    return new ZenhubApi(readZhToken() ?? '');
  }

  private cli(): ZhCli | undefined {
    const bin = resolveZhPath();
    const dir = repoDir();
    if (!bin || !dir) {
      return undefined;
    }
    return new ZhCli(bin, dir);
  }

  private async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    const problems = this.setupProblems();
    if (problems) {
      this.post({ phase: 'setup', setupProblems: problems });
      return;
    }
    this.post({ phase: 'loading' });

    const dir = repoDir();
    this.localRepo = dir ? gitRepoInfo(dir) : undefined;

    try {
      const workspace = await this.api().getWorkspace(workspaceId());
      if (generation !== this.loadGeneration) {
        return;
      }
      this.pipelines = workspace.pipelines;
      this.repositories = workspace.repositories;
      this.currentPipelineId = this.pickPipeline();
      await this.loadIssues(workspace.name);
    } catch (e) {
      if (generation === this.loadGeneration) {
        this.post({ phase: 'error', message: (e as Error).message });
      }
    }
  }

  /** Last selection if still valid, then the configured default (Backlog), then the first pipeline. */
  private pickPipeline(): string | undefined {
    const saved = this.context.workspaceState.get<string>(this.pipelineStateKey());
    return choosePipeline(this.pipelines, saved, defaultPipeline());
  }

  private async loadIssues(workspaceName?: string): Promise<void> {
    const generation = ++this.loadGeneration;
    if (!this.currentPipelineId) {
      this.post({ phase: 'error', message: 'This workspace has no pipelines.' });
      return;
    }
    const filter = matchRepoFilter(repoFilter(), this.repositories);
    if (filter.error) {
      this.post({ phase: 'error', message: filter.error });
      return;
    }
    this.post({
      phase: 'loading',
      workspaceName,
      pipelines: this.pipelines,
      currentPipelineId: this.currentPipelineId
    });
    try {
      const issues = await this.api().getPipelineIssues(
        this.currentPipelineId,
        workspaceId(),
        filter.ids
      );
      if (generation !== this.loadGeneration) {
        return;
      }
      this.issues = issues;
      this.post({
        phase: 'ready',
        workspaceName,
        pipelines: this.pipelines,
        currentPipelineId: this.currentPipelineId,
        issues: issues.map((issue) => ({ ...issue, canAct: this.canActOn(issue) })),
        hiddenOptions: hiddenIssueOptions()
      });
    } catch (e) {
      if (generation === this.loadGeneration) {
        this.post({ phase: 'error', message: (e as Error).message });
      }
    }
  }

  /**
   * zh resolves issue numbers against the git remote of its working directory,
   * so CLI actions are only safe for issues that live in that repository.
   */
  private canActOn(issue: ZenhubIssue): boolean {
    if (!this.localRepo) {
      return false;
    }
    return (
      issue.repoOwner.toLowerCase() === this.localRepo.owner.toLowerCase() &&
      issue.repoName.toLowerCase() === this.localRepo.name.toLowerCase()
    );
  }

  private currentPipelineName(): string {
    return this.pipelines.find((p) => p.id === this.currentPipelineId)?.name ?? '';
  }

  private async runAction(action: string, issueId: string): Promise<void> {
    const issue = this.issues.find((i) => i.id === issueId);
    if (!issue) {
      return;
    }

    // Browser-backed actions work for any issue.
    switch (action) {
      case 'openGithub':
        void vscode.env.openExternal(vscode.Uri.parse(issue.htmlUrl));
        return;
      case 'openZenhub':
        void vscode.env.openExternal(vscode.Uri.parse(issue.zenhubUrl));
        return;
      case 'setLabel':
      case 'setSprint': {
        const what = action === 'setLabel' ? 'Labels' : 'Sprints';
        void vscode.window.showInformationMessage(
          `${what} can't be set through the zh CLI yet — opening the issue in Zenhub.`
        );
        void vscode.env.openExternal(vscode.Uri.parse(issue.zenhubUrl));
        return;
      }
    }

    const cli = this.cli();
    if (!cli) {
      void vscode.window.showErrorMessage('The zh CLI is not available.');
      return;
    }
    if (!this.canActOn(issue)) {
      const message = this.localRepo
        ? `zh runs against ${this.localRepo.owner}/${this.localRepo.name}, but #${issue.number} lives in ` +
          `${issue.repoOwner}/${issue.repoName}. Point "zhIssues.localRepoPath" at a checkout of that repository to act on it.`
        : `No GitHub remote found in the zh working directory. Point "zhIssues.localRepoPath" at a checkout of ` +
          `${issue.repoOwner}/${issue.repoName} to act on its issues.`;
      const choice = await vscode.window.showWarningMessage(message, 'Open in Zenhub');
      if (choice) {
        void vscode.env.openExternal(vscode.Uri.parse(issue.zenhubUrl));
      }
      return;
    }

    const n = String(issue.number);
    try {
      switch (action) {
        case 'pinTop':
          await this.withProgress(`Pinning #${n} to top…`, async () => {
            await cli.run(['reorder', n, 'top']);
            await cli.run(['priority', n, 'high']);
          });
          break;
        case 'sendTop':
          await this.withProgress(`Sending #${n} to top…`, () => cli.run(['reorder', n, 'top']));
          break;
        case 'sendBottom':
          await this.withProgress(`Sending #${n} to bottom…`, () =>
            cli.run(['reorder', n, 'bottom'])
          );
          break;
        case 'clearPriority':
          await this.withProgress(`Clearing priority on #${n}…`, () =>
            cli.run(['priority', n, 'clear'])
          );
          break;
        case 'move': {
          const target = await vscode.window.showQuickPick(
            this.pipelines.filter((p) => p.id !== this.currentPipelineId).map((p) => p.name),
            { placeHolder: `Move #${n} to pipeline…` }
          );
          if (!target) {
            return;
          }
          await this.withProgress(`Moving #${n} to ${target}…`, () =>
            cli.run(['move', n, target])
          );
          break;
        }
        case 'estimate': {
          const pick = await vscode.window.showQuickPick(
            [...ESTIMATE_CHOICES, 'Custom…', 'Clear estimate'],
            { placeHolder: `Set estimate for #${n}` }
          );
          if (!pick) {
            return;
          }
          let value = pick === 'Clear estimate' ? 'clear' : pick;
          if (pick === 'Custom…') {
            const typed = await vscode.window.showInputBox({
              prompt: 'Story points',
              validateInput: (v) => (/^\d+(\.\d+)?$/.test(v.trim()) ? undefined : 'Enter a number')
            });
            if (!typed) {
              return;
            }
            value = typed.trim();
          }
          await this.withProgress(`Setting estimate on #${n}…`, () =>
            cli.run(['estimate', n, value])
          );
          break;
        }
        case 'assign': {
          const users = await this.api().getWorkspaceUsers(workspaceId());
          const items: vscode.QuickPickItem[] = users.map((u) => ({
            label: u.login,
            description: u.name ?? undefined
          }));
          items.push({ label: 'Remove all assignees', description: 'zh unassign' });
          const pick = await vscode.window.showQuickPick(items, {
            placeHolder: `Assign #${n} to…`
          });
          if (!pick) {
            return;
          }
          if (pick.label === 'Remove all assignees') {
            await this.withProgress(`Unassigning #${n}…`, () => cli.run(['unassign', n]));
          } else {
            await this.withProgress(`Assigning #${n} to ${pick.label}…`, () =>
              cli.run(['assign', n, pick.label])
            );
          }
          break;
        }
        case 'close': {
          const confirmed = await vscode.window.showWarningMessage(
            `Close issue #${n} "${issue.title}"?`,
            { modal: true },
            'Close Issue'
          );
          if (confirmed !== 'Close Issue') {
            return;
          }
          await this.withProgress(`Closing #${n}…`, () => cli.run(['close', n]));
          break;
        }
        case 'reopen':
          await this.withProgress(`Reopening #${n}…`, () => cli.run(['reopen', n]));
          break;
        case 'duplicate': {
          const title = await vscode.window.showInputBox({
            prompt: 'Title for the duplicated issue',
            value: issue.title
          });
          if (!title) {
            return;
          }
          const args = ['create', title, '-p', this.currentPipelineName()];
          if (issue.labels.length) {
            args.push('-l', issue.labels.map((l) => l.name).join(','));
          }
          if (issue.estimate !== null) {
            args.push('-e', String(issue.estimate));
          }
          await this.withProgress('Creating duplicate issue…', () => cli.run(args));
          break;
        }
        case 'comment': {
          const text = await vscode.window.showInputBox({
            prompt: `Comment on #${n}`,
            ignoreFocusOut: true
          });
          if (!text) {
            return;
          }
          await this.withProgress(`Commenting on #${n}…`, () =>
            cli.run(['comment', n, '-m', text])
          );
          break;
        }
        default:
          return;
      }
      await this.loadIssues();
    } catch (e) {
      void vscode.window.showErrorMessage(`Zenhub action failed: ${(e as Error).message}`);
    }
  }

  private withProgress<T>(title: string, task: () => Promise<T>): Promise<T> {
    return Promise.resolve(
      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title },
        () => task()
      )
    );
  }

  /** Resolve the workspace ID from the repo's GitHub ID (needs the gh CLI, like zh itself). */
  async detectWorkspace(): Promise<void> {
    const dir = repoDir();
    if (!dir) {
      void vscode.window.showErrorMessage('Open a folder (or set "zhIssues.localRepoPath") first.');
      return;
    }
    const repo = gitRepoInfo(dir);
    if (!repo) {
      void vscode.window.showErrorMessage(`No GitHub remote found in ${dir}.`);
      return;
    }
    let ghId: number;
    try {
      const out = await this.withProgress(
        `Looking up ${repo.owner}/${repo.name} on GitHub…`,
        () =>
          new Promise<string>((resolve, reject) => {
            cp.execFile(
              'gh',
              ['api', `repos/${repo.owner}/${repo.name}`, '--jq', '.id'],
              { encoding: 'utf8', timeout: 15_000 },
              (error, stdout) => (error ? reject(error) : resolve(String(stdout)))
            );
          })
      );
      ghId = parseInt(out.trim(), 10);
      if (Number.isNaN(ghId)) {
        throw new Error('unexpected gh output');
      }
    } catch {
      void vscode.window.showErrorMessage(
        'Could not look up the repository ID (is the gh CLI installed and authenticated?).'
      );
      return;
    }
    try {
      const workspaces = await this.api().getWorkspacesForRepo(ghId);
      if (!workspaces.length) {
        void vscode.window.showWarningMessage(
          `No Zenhub workspaces found for ${repo.owner}/${repo.name}.`
        );
        return;
      }
      const pick =
        workspaces.length === 1
          ? workspaces[0]
          : await vscode.window
              .showQuickPick(
                workspaces.map((w) => ({ label: w.name, description: w.id, id: w.id })),
                { placeHolder: 'Select a Zenhub workspace' }
              )
              .then((p) => (p ? { id: p.id, name: p.label } : undefined));
      if (!pick) {
        return;
      }
      await vscode.workspace
        .getConfiguration('zhIssues')
        .update('workspaceId', pick.id, vscode.ConfigurationTarget.Workspace);
      void vscode.window.showInformationMessage(`Zenhub workspace set to "${pick.name}".`);
      await this.load();
    } catch (e) {
      void vscode.window.showErrorMessage((e as Error).message);
    }
  }

  private renderHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css')
    );
    const nonce = Array.from({ length: 32 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36))
    ).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Zenhub Board</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
