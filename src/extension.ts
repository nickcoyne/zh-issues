import * as vscode from 'vscode';
import { BoardViewProvider } from './boardViewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new BoardViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(BoardViewProvider.viewId, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('zhIssues.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('zhIssues.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:codevader.zh-issues')
    ),
    vscode.commands.registerCommand('zhIssues.detectWorkspace', () => provider.detectWorkspace()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('zhIssues')) {
        provider.refresh();
      }
    })
  );
}

export function deactivate(): void {}
