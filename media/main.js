(function () {
  const input = document.getElementById('addr');
  const btn = document.getElementById('go');
  const frame = document.getElementById('view');
  const hint = document.querySelector('.hint');
  const logsEl = document.getElementById('logs');
  const clearBtn = document.getElementById('clear');
  const autoEl = document.getElementById('autoscroll');

  let vscode;
  try {
    // acquireVsCodeApi is available inside VS Code webviews
    // eslint-disable-next-line no-undef
    vscode = acquireVsCodeApi();
  } catch (_) {
    vscode = null;
  }

  // Parent helper: attachIframeConsoleRelay (API compatible with request)
  function attachIframeConsoleRelay(options = {}) {
    const allowed = Array.isArray(options.allowedOrigins) && options.allowedOrigins.length ? options.allowedOrigins : null;
    const targetFrame = options.iframe || null;
    const targetWin = targetFrame && targetFrame.contentWindow ? targetFrame.contentWindow : null;
    const forward = options.forwardToConsole === true;
    const cb = typeof options.onEvent === 'function' ? options.onEvent : null;

    const isAllowedOrigin = (origin) => {
      if (!allowed) return true; // allow all
      if (allowed.includes('*')) return true;
      return allowed.includes(origin);
    };

    const handler = (e) => {
      if (!isAllowedOrigin(e.origin)) return;
      if (targetWin && e.source !== targetWin) return;
      const data = e.data || {};
      let level, args;
      if (data && (data.type === 'iframe-log' || data.type === 'iframeLog')) {
        level = data.level || 'log';
        args = Array.isArray(data.args) ? data.args : [data.message ?? data.text ?? ''];
      } else if (data && data.type === 'IFRAME_CONSOLE_RELAY') {
        // Support iframe-console-relay package (newer shape)
        level = data.level || 'log';
        args = Array.isArray(data.args) ? data.args : [];
      } else if (data && typeof data.type === 'string' && ['log','info','warn','error'].includes(data.type) && 'data' in data) {
        // Support iframe-console package (older shape)
        level = data.type;
        args = [data.data];
      } else {
        return; // not a console relay event
      }
      const evt = {
        level,
        args,
        timestamp: Date.now(),
        origin: e.origin,
        frameUrl: targetFrame ? targetFrame.src : undefined,
      };
      if (forward && console[level]) {
        try { console[level]('[iframe]', ...args); } catch {}
      }
      if (cb) {
        try { cb(evt); } catch {}
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }

  function appendLog(level, args, origin) {
    if (!logsEl) return;
    const ts = new Date();
    const time = ts.toLocaleTimeString();
    const item = document.createElement('div');
    item.className = `log ${level || 'log'}`;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `[${time}]${origin ? ` [${origin}]` : ''} ${level || 'log'}:`;
    const msg = document.createElement('span');
    try {
      // stringify each arg safely
      const texts = (args || []).map((a) => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      });
      msg.textContent = ' ' + texts.join(' ');
    } catch {
      msg.textContent = '';
    }
    item.appendChild(meta);
    item.appendChild(msg);
    logsEl.appendChild(item);
    if (autoEl && autoEl.checked) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }

  // Mirror webview's own console into the panel (optional helper)
  ['log', 'info', 'warn', 'error'].forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...a) => {
      try { orig(...a); } catch {}
      appendLog(level, a, 'webview');
      if (vscode) vscode.postMessage({ type: 'webviewLog', level, args: a });
    };
  });

  function navigate() {
    let url = input.value.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    frame.src = url;
    appendLog('info', [`Navigate: ${url}`], 'webview');
    // if (hint) hint.textContent = 'Navigating: ' + url + ' (some sites block iframes)';
  }

  btn.addEventListener('click', navigate);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate();
      if (vscode) vscode.postMessage({ type: 'info', text: `Enter pressed. Navigating to ${input.value}` });
    }
  });

  clearBtn?.addEventListener('click', () => {
    if (logsEl) logsEl.innerHTML = '';
  });

  // Attach relay to current iframe and feed into panel
  const detachRelay = attachIframeConsoleRelay({
    allowedOrigins: ['*'],
    iframe: frame,
    forwardToConsole: false,
    onEvent: (ev) => {
      appendLog(ev.level, ev.args, ev.origin || 'iframe');
      if (vscode) vscode.postMessage({ type: 'iframeLog', level: ev.level, args: ev.args, origin: ev.origin });
    },
  });

  frame.addEventListener('load', () => {
    appendLog('info', [`Loaded: ${frame.src}`], 'webview');
    // if (hint) hint.textContent = 'Loaded: ' + frame.src;
  });
})();
