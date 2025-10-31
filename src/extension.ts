import * as vscode from 'vscode';
import * as fs from 'fs';

let currentPanel: vscode.WebviewPanel | undefined;
let devOutWatcher: fs.FSWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  const hello = vscode.commands.registerCommand('browser-in-vscode.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from Browser in VS Code!');
  });

  // Open VS Code's built-in Simple Browser in the editor area
  const openSimpleBrowser = vscode.commands.registerCommand('browser-in-vscode.openSimpleBrowser', async () => {
    const url = await vscode.window.showInputBox({
      value: 'http://localhost:5173/',
      prompt: 'Open URL in Simple Browser',
      placeHolder: 'http://localhost:5173/',
      validateInput: (v) => v.trim().length === 0 ? 'Enter a URL' : undefined
    });
    if (!url) { return; }
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    await vscode.commands.executeCommand('simpleBrowser.show', finalUrl);
  });

  const initPanel = (panel: vscode.WebviewPanel) => {
    currentPanel = panel;
    panel.onDidDispose(() => { currentPanel = undefined; });

    const reload = () => {
      panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
    };

    reload();

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg && msg.type === 'info' && typeof msg.text === 'string') {
        vscode.window.showInformationMessage(msg.text);
      }
      if (msg && msg.type === 'webviewReady') {
        try { panel.webview.postMessage({ type: 'consoleGuide' }); } catch {}
      }
    });

    // Auto-reload in development
    if (context.extensionMode === vscode.ExtensionMode.Development) {
      try {
        const mediaPath = vscode.Uri.joinPath(context.extensionUri, 'media').fsPath;
        let timer: NodeJS.Timeout | undefined;
        const watcher = fs.watch(mediaPath, { recursive: true }, () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            if (currentPanel) {
              reload();
              vscode.window.setStatusBarMessage('$(refresh) Webview reloaded (media changed)', 2000);
            }
          }, 100);
        });
        panel.onDidDispose(() => watcher.close());
      } catch {
        // ignore watcher errors
      }
    }
  };

  const openWebview = vscode.commands.registerCommand('browser-in-vscode.openWebview', () => {
    if (currentPanel) {
      currentPanel.reveal(vscode.ViewColumn.Active);
      currentPanel.webview.html = getWebviewContent(currentPanel.webview, context.extensionUri);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'browserInVscodeWebview',
      'Browser in VS Code',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    initPanel(panel);
  });

  // Quick helper: open localhost in the Simple Browser
  const openLocalhost = vscode.commands.registerCommand('browser-in-vscode.openLocalhost', async () => {
    const input = await vscode.window.showInputBox({
      value: 'http://localhost:3000',
      prompt: 'Open Localhost in Simple Browser',
      placeHolder: 'http://localhost:3000',
      validateInput: (v) => v.trim().length === 0 ? 'Enter a URL' : undefined
    });
    if (!input) { return; }
    let finalUrl = input.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'http://' + finalUrl;
    }
    await vscode.commands.executeCommand('simpleBrowser.show', finalUrl);
  });

  context.subscriptions.push(hello, openSimpleBrowser, openWebview, openLocalhost);

  // Restore webview after window reloads/restarts
  try {
    const serializer = vscode.window.registerWebviewPanelSerializer('browserInVscodeWebview', {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel) {
        panel.webview.options = { enableScripts: true };
        panel.title = 'Browser in VS Code';
        initPanel(panel);
      }
    });
    context.subscriptions.push(serializer);
  } catch {
    // older VS Code versions may not support serializer
  }

  // Global: in development, watch compiled output and reload the window automatically
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    try {
      if (!devOutWatcher) {
        const outPath = vscode.Uri.joinPath(context.extensionUri, 'out').fsPath;
        let reloadTimer: NodeJS.Timeout | undefined;
        let lastReload = 0;
        const triggerWindowReload = () => {
          const now = Date.now();
          if (now - lastReload < 2000) return;
          lastReload = now;
          vscode.window.setStatusBarMessage('$(refresh) Extension updated — reloading window…', 1500);
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        };
        devOutWatcher = fs.watch(outPath, { recursive: true }, () => {
          if (reloadTimer) clearTimeout(reloadTimer);
          reloadTimer = setTimeout(triggerWindowReload, 150);
        });
        context.subscriptions.push(new vscode.Disposable(() => devOutWatcher?.close()));
      }
    } catch {
      // ignore watcher errors
    }
  }
}

export function deactivate() {}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));
  // Add a simple cache-buster so local resource edits reflect immediately in the webview
  const cacheBust = Date.now().toString();
  const scriptUriBusted = scriptUri.with({ query: cacheBust });
  const styleUriBusted = styleUri.with({ query: cacheBust });
  const htmlUri = vscode.Uri.joinPath(extensionUri, 'media', 'webview.html');

  const rawHtml = fs.readFileSync(htmlUri.fsPath, 'utf8');
  return rawHtml
    .replace(/%CSP_SOURCE%/g, webview.cspSource)
    .replace(/%NONCE%/g, nonce)
    .replace(/%SCRIPT_URI%/g, String(scriptUriBusted))
    .replace(/%STYLE_URI%/g, String(styleUriBusted));
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
