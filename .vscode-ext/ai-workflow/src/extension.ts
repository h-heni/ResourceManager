import * as vscode from 'vscode';

// ─── State file path ─────────────────────────────────────────────
const STATE_FILENAME = '.ai-workflow-state.json';

interface WorkflowState {
  action: 'next' | 'reinvestigate' | 'idle';
  timestamp: string;
  message?: string;
}

function getStateUri(): vscode.Uri | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  return vscode.Uri.joinPath(folders[0].uri, STATE_FILENAME);
}

async function writeState(state: WorkflowState): Promise<void> {
  const uri = getStateUri();
  if (!uri) return;
  const content = JSON.stringify(state, null, 2);
  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
}

// ─── Webview HTML ─────────────────────────────────────────────────
function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    h2 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    p {
      margin: 0 0 16px 0;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-align: center;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn:active { opacity: 0.7; }
    .btn-next {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-reinvestigate {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border, transparent);
    }
    .status {
      margin-top: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      display: none;
    }
    .status.visible { display: block; }
    .status-next {
      background: var(--vscode-testing-iconPassed);
      color: var(--vscode-editor-background);
    }
    .status-reinvestigate {
      background: var(--vscode-editorWarning-foreground);
      color: var(--vscode-editor-background);
    }
    .divider {
      height: 1px;
      background: var(--vscode-widget-border);
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <h2>AI Workflow Decision</h2>
  <p>After Copilot completes verification, choose an action:</p>

  <button class="btn btn-next" onclick="handleAction('next')">
    ✅ Next — Verify &amp; Complete
  </button>

  <div class="divider"></div>

  <button class="btn btn-reinvestigate" onclick="handleAction('reinvestigate')">
    🔍 Reinvestigate — Deeper Debugging
  </button>

  <div id="status" class="status"></div>

  <script>
    const vscode = acquireVsCodeApi();

    function handleAction(action) {
      vscode.postMessage({ command: action });
      const el = document.getElementById('status');
      el.className = 'status visible ' + (action === 'next' ? 'status-next' : 'status-reinvestigate');
      el.textContent = action === 'next'
        ? '✅ Task marked as verified and complete.'
        : '🔍 Reinvestigation triggered — Copilot will re-run debugging.';
    }
  </script>
</body>
</html>`;
}

// ─── Webview Provider ─────────────────────────────────────────────
class AiWorkflowViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aiWorkflow.panel';

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getWebviewContent();

    webviewView.webview.onDidReceiveMessage(async (message: { command: string }) => {
      if (message.command === 'next') {
        await writeState({
          action: 'next',
          timestamp: new Date().toISOString(),
          message: 'User verified and completed the task.',
        });
        vscode.window.showInformationMessage('✅ AI Workflow: Task marked as verified and complete.');
      } else if (message.command === 'reinvestigate') {
        await writeState({
          action: 'reinvestigate',
          timestamp: new Date().toISOString(),
          message: 'User requested deeper investigation.',
        });
        vscode.window.showWarningMessage('🔍 AI Workflow: Reinvestigation requested. Copilot will re-run debugging.');
      }
    });
  }
}

// ─── Extension Lifecycle ──────────────────────────────────────────
export function activate(context: vscode.ExtensionContext): void {
  // Register the webview panel in the activity bar
  const provider = new AiWorkflowViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AiWorkflowViewProvider.viewType, provider),
  );

  // Command: Show Panel (focus the sidebar panel)
  context.subscriptions.push(
    vscode.commands.registerCommand('aiWorkflow.showPanel', () => {
      vscode.commands.executeCommand('aiWorkflow.panel.focus');
    }),
  );

  // Command: Next (programmatic)
  context.subscriptions.push(
    vscode.commands.registerCommand('aiWorkflow.next', async () => {
      await writeState({
        action: 'next',
        timestamp: new Date().toISOString(),
        message: 'User verified via command palette.',
      });
      vscode.window.showInformationMessage('✅ AI Workflow: Task verified and complete.');
    }),
  );

  // Command: Reinvestigate (programmatic)
  context.subscriptions.push(
    vscode.commands.registerCommand('aiWorkflow.reinvestigate', async () => {
      await writeState({
        action: 'reinvestigate',
        timestamp: new Date().toISOString(),
        message: 'Reinvestigation requested via command palette.',
      });
      vscode.window.showWarningMessage('🔍 AI Workflow: Reinvestigation triggered.');
    }),
  );
}

export function deactivate(): void {}
