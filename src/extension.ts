import * as vscode from 'vscode';
import * as fs from 'fs';

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

  const openWebview = vscode.commands.registerCommand('browser-in-vscode.openWebview', () => {
    const panel = vscode.window.createWebviewPanel(
      'browserInVscodeWebview',
      'Browser in VS Code',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg && msg.type === 'info' && typeof msg.text === 'string') {
        vscode.window.showInformationMessage(msg.text);
      }
    });
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
