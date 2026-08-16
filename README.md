# Issues for Zenhub (Unofficial)

Browse a Zenhub pipeline and act on its issues without leaving the editor. Issue actions run through the zh CLI, so the extension reuses your existing zh setup and token.

> This is an unofficial, community-built extension. It is not affiliated with, endorsed by, or sponsored by Zenhub Inc. "Zenhub" is a trademark of Zenhub Inc. and is used here only to describe what the extension works with.

## Features

- Pipeline dropdown, defaulting to Backlog; your last selection is remembered per workspace.
- Issue cards in board order showing assignee avatars (or an unassigned placeholder), repo and issue number (click to open on GitHub), title, high-priority flag, blocked/blocking counts, colored labels, estimate, and parent issue.
- Optional repository filter to limit the board to one repository in a multi-repo workspace.
- Per-issue options menu (entries can be hidden via settings):
  - Pin to top and set as high priority (`zh reorder` + `zh priority`)
  - Send to top / bottom (`zh reorder`)
  - Move to pipeline (`zh move`)
  - Duplicate issue (`zh create` with the same labels, estimate, and pipeline)
  - Close / reopen issue (`zh close` / `zh reopen`)
  - Set assignee (`zh assign` / `zh unassign`)
  - Set estimate (`zh estimate`)
  - Add comment (`zh comment`)
  - Set label / set sprint — not supported by the zh CLI, so these open the issue in Zenhub
  - Open in GitHub / Zenhub

Reads go straight to the Zenhub GraphQL API (using the token from the zh config) because zh's text output omits labels, blocked status, and priority. All writes go through zh.

## Requirements

- VS Code 1.85 or later.
- The `zh` CLI installed (on PATH, at `~/.zenhub-cli/zh`, or pointed at via `zhIssues.cliPath`) with `ZH_TOKEN` configured in `~/.config/zh/config`.
- A folder open in VS Code whose git remote points at the GitHub repository connected to your Zenhub workspace (or set `zhIssues.localRepoPath`).
- The `gh` CLI, only if you use the workspace auto-detect command.

## Installation

The extension is not on the Marketplace; install it from a `.vsix` package:

```sh
git clone https://github.com/nickcoyne/zh-issues.git
cd zh-issues
npm install
npx @vscode/vsce package
code --install-extension zh-issues-*.vsix
```

Or install the `.vsix` through the UI: Extensions view → `…` menu → **Install from VSIX…**

## Setup

1. Open the Issues for Zenhub icon in the activity bar.
2. Set `zhIssues.workspaceId` in settings (the gear icon in the view header opens them). It is the trailing hex string in your board URL: `app.zenhub.com/workspaces/<name>-<workspaceId>/board`. Or run **Issues for Zenhub: Detect Workspace from Repository**.

## Settings

| Setting | Purpose |
| --- | --- |
| `zhIssues.workspaceId` | Zenhub workspace to display. Accepts the bare ID, the URL slug, or the full board URL. |
| `zhIssues.localRepoPath` | Local checkout the zh CLI runs in. Defaults to the first workspace folder. |
| `zhIssues.cliPath` | Path to the zh binary if it isn't on PATH. |
| `zhIssues.repoFilter` | Show only issues from one repository (`owner/name` or `name`). |
| `zhIssues.defaultPipeline` | Pipeline selected on first load (default: Backlog). |
| `zhIssues.hiddenIssueOptions` | Menu entries to hide from the "Issue options" popover. |

## Caveats

- zh resolves issue numbers against the git remote of `zhIssues.localRepoPath`. In multi-repo workspaces, actions are disabled for issues from other repositories (browser links still work).
- zh acts on the first Zenhub workspace attached to the repository. If `zhIssues.workspaceId` points at a different workspace for the same repository, pipeline moves land on that first workspace's board.
- The board shows at most 200 issues per pipeline.

## Development

```sh
npm install
npm run compile   # or: npm run watch
npm test
```

Press F5 (Run Extension) to launch an Extension Development Host with the extension loaded.

Unit tests cover the pure logic in `src/core.ts` (remote parsing, workspace ID normalization, repo filtering, pipeline selection) and run with Node's built-in test runner — no extra dependencies.

To build an installable package, run `npx @vscode/vsce package`; bump `version` in `package.json` first when replacing an installed build.
