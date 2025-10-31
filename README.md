# Browser in VS Code

English | [한국어](README.ko.md)

## Overview

This extension lets you open and debug URLs (e.g., localhost) inside a VS Code Webview. It is a minimal example extension.

- Command: `Browser in VS Code: Open Webview` — opens a webview with a simple address bar and an iframe.

Note: Many websites block iframe embedding via security policies (CSP / X-Frame-Options). Some URLs may not load inside the webview.

If you want to view console logs from the embedded page, include the script below in your `index.html`:
<code><script src="https://unpkg.com/iframe-console-relay/dist/index.umd.min.js"></script></code>

For npm usage and details, see:
https://github.com/g2developer/iframe-console-relay

## Development

1. Install dependencies: `npm install`
2. Build: `npm run compile` or `npm run watch`
3. Package VSIX: `npm run build` (or `npm run build:install` to also install)
4. Press F5 to launch the Extension Host, then run the command from the Command Palette.

Development conveniences:
- Editing files under `media/*` automatically reloads the webview.
- Saving under `src` (which updates `out/*`) automatically reloads the VS Code window (restarts the extension host) so changes apply without reinstalling.

### Build/Install scripts
- `npm run build`: compile TypeScript and create a VSIX
- `npm run build:install`: create a VSIX and install to VS Code (`--force` to reinstall), or manually install the built `browser-in-vscode.vsix`
