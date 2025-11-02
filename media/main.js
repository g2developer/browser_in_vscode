(function () {
  const input = document.getElementById('addr');
  const btn = document.getElementById('go');
  const btnReload = document.getElementById('btnReload');
  const frame = document.getElementById('view');
  const viewWrap = document.querySelector('.view-wrap');
  const hintEl = document.getElementById('hint');
  const recentLinksEl = document.getElementById('recentLinks');
  const hint = document.querySelector('.hint');
  const logsEl = document.getElementById('logs');
  const clearBtn = document.getElementById('clear');
  const autoEl = document.getElementById('autoscroll');
  const panel = document.getElementById('logPanel');
  const resizer = document.getElementById('panelResizer');
  const consoleWrap = document.getElementById('consoleWrap');
  const content = document.querySelector('.content');
  const overlay = document.getElementById('dragOverlay');
  const btnConsole = document.getElementById('btnConsole');
  const btnMobile = document.getElementById('btnMobile');
  const consoleGuideBanner = document.getElementById('consoleGuideBanner');
  const consoleGuideClose = document.getElementById('consoleGuideClose');

  let vscode;
  try {
    // acquireVsCodeApi is available inside VS Code webviews
    // eslint-disable-next-line no-undef
    vscode = acquireVsCodeApi();
  } catch (_) {
    vscode = null;
  }

  // Persisted state helpers (recents)
  const readState = () => {
    try { return (vscode && typeof vscode.getState === 'function') ? (vscode.getState() || null) : null; } catch { return null; }
  };
  const writeState = (s) => {
    try { if (vscode && typeof vscode.setState === 'function') vscode.setState(s); } catch {}
    try { window.localStorage.setItem('bisv_state', JSON.stringify(s)); } catch {}
  };
  const readFallback = () => {
    try { const raw = window.localStorage.getItem('bisv_state'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  let state = readState() || readFallback() || { recents: [] };
  if (!Array.isArray(state.recents)) state.recents = [];

  function addRecent(url) {
    if (!url || typeof url !== 'string') return;
    const norm = url.trim();
    if (!norm) return;
    const existing = state.recents.filter((u) => u !== norm);
    state.recents = [norm, ...existing].slice(0, 5);
    writeState(state);
    renderRecents();
  }

  function renderRecents() {
    if (!recentLinksEl) return;
    recentLinksEl.innerHTML = '';
    (state.recents || []).forEach((u) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'recent-link';
      b.textContent = u;
      b.title = u;
      b.style.padding = '4px 8px';
      b.style.borderRadius = '4px';
      b.style.border = '1px solid #444';
      b.style.background = '#2b2b2b';
      b.style.color = '#ddd';
      b.addEventListener('click', () => {
        input.value = u;
        navigate(u);
      });
      recentLinksEl.appendChild(b);
    });
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

  // Use ConsoleUtil from consoleUtil.js
  const appendLog = window.ConsoleUtil && window.ConsoleUtil.createLogAppender
    ? window.ConsoleUtil.createLogAppender(logsEl, autoEl)
    : function(level, args, origin) {
        // Fallback if ConsoleUtil is not available
        if (!logsEl) return;
        const item = document.createElement('div');
        item.className = `log ${level || 'log'}`;
        const msg = document.createElement('span');
        try {
          const texts = (args || []).map((a) => {
            if (typeof a === 'string') return a;
            try { return JSON.stringify(a); } catch { return String(a); }
          });
          msg.textContent = texts.join(' ');
        } catch {
          msg.textContent = '';
        }
        item.appendChild(msg);
        logsEl.appendChild(item);
        if (autoEl && autoEl.checked) {
          item.scrollIntoView({ block: 'nearest' });
        }
      };

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
    startLoadWatch(url);
    frame.src = url;
    appendLog('info', [`Navigate: ${url}`], 'webview');
  }

  btn.addEventListener('click', navigate);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate();
    }
  });

  clearBtn?.addEventListener('click', () => {
    if (logsEl) logsEl.innerHTML = '';
  });

  btnReload.addEventListener('click', () => {
    const url = frame.src;
    startLoadWatch(url);
    frame.src = url;
  });

  // Keyboard: F5 reloads the embedded browser (iframe), not VS Code
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      e.preventDefault();
      e.stopPropagation();
      frame.src = frame.src;
      appendLog('info', ['Reload (F5)'], 'webview');
    }
  }, true);

  // Toggle console window (resizer + panel) visibility
  if (btnConsole && consoleWrap) {
    btnConsole.setAttribute('aria-pressed', String(!consoleWrap.hidden));
    btnConsole.addEventListener('click', () => {
      const show = consoleWrap.hidden === true;
      consoleWrap.hidden = !show;
      btnConsole.setAttribute('aria-pressed', String(show));
    });
  }

  // Toggle mobile viewport emulation
  if (btnMobile && viewWrap) {
    const setMobileUI = (isMobile) => {
      btnMobile.textContent = isMobile ? '🖥PC' : '📱Mobile';
      btnMobile.setAttribute('aria-pressed', String(isMobile));
      viewWrap.classList.toggle('mobile', isMobile);
    };

    const initMobile = viewWrap.classList.contains('mobile');
    setMobileUI(initMobile);
    btnMobile.addEventListener('click', () => {
      const enable = !viewWrap.classList.contains('mobile');
      setMobileUI(enable);
    });
  }

  // Panel resize: robust with Pointer Events + overlay to avoid iframe capturing
  if (panel && resizer && content && overlay) {
    let dragging = false;
    let startX = 0;
    let startWidth = 0;
    let activePointerId = -1;

    const minWidth = 200; // px
    const computeMax = () => Math.max(minWidth, Math.floor((content.clientWidth || window.innerWidth) * 0.6));

    const onMove = (e) => {
      if (!dragging) return;
      const clientX = e.clientX ?? 0;
      const maxWidth = computeMax();
      const dx = startX - clientX;
      let next = startWidth + dx;
      if (next < minWidth) next = minWidth;
      if (next > maxWidth) next = maxWidth;
      panel.style.width = next + 'px';
      e.preventDefault();
      e.stopPropagation();
    };

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      activePointerId = -1;
      document.body.classList.remove('resizing');
      overlay.hidden = true;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };

    const onUp = (e) => {
      if (e.pointerId === activePointerId || activePointerId === -1) {
        try { resizer.releasePointerCapture(e.pointerId); } catch {}
        endDrag();
      }
      e.preventDefault();
      e.stopPropagation();
    };

    resizer.addEventListener('pointerdown', (e) => {
      dragging = true;
      activePointerId = e.pointerId;
      startX = e.clientX || 0;
      if (panel.hidden) {
        panel.hidden = false; // reveal panel when starting drag
        const inlineW = parseInt(panel.style.width || '', 10);
        startWidth = Number.isFinite(inlineW) ? inlineW : 360;
      } else {
        startWidth = panel.getBoundingClientRect().width;
      }
      document.body.classList.add('resizing');
      overlay.hidden = false; // block iframe from stealing events
      try { resizer.setPointerCapture(e.pointerId); } catch {}
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      e.preventDefault();
      e.stopPropagation();
    });

    resizer.addEventListener('lostpointercapture', endDrag);
    resizer.addEventListener('pointercancel', endDrag);

    // Double-click to reset
    resizer.addEventListener('dblclick', () => {
      if (panel.hidden) panel.hidden = false;
      panel.style.width = '360px';
    });
  }

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
    // Mark loaded for current request; keep check running to decide hint visibility
    requestLoaded = true;
    if (loadWatchTimer) { try { clearTimeout(loadWatchTimer); } catch {} loadWatchTimer = null; }
    addRecent(frame.src);
  });

  // Hint behavior: show only if page hasn't loaded for a short time
  let loadWatchTimer = null;
  let currentCheckAbort = null;
  let currentRequestId = 0;
  let requestLoaded = false;
  async function checkUrlAvailability(url) {
    try {
      const ctrl = new AbortController();
      currentCheckAbort = ctrl;
      const timeout = setTimeout(() => ctrl.abort(), 3500);
      try {
        // Prefer HEAD; fall back to GET no-cors
        const res = await fetch(url, { method: 'HEAD', cache: 'no-store', redirect: 'follow', signal: ctrl.signal, mode: 'no-cors' });
        clearTimeout(timeout);
        // Any resolved response indicates reachability (opaque allowed)
        return true;
      } catch {
        clearTimeout(timeout);
        // As a fallback, try GET no-cors
        try {
          const ctrl2 = new AbortController();
          currentCheckAbort = ctrl2;
          const t2 = setTimeout(() => ctrl2.abort(), 3500);
          await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow', signal: ctrl2.signal, mode: 'no-cors' });
          clearTimeout(t2);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  function startLoadWatch(url) {
    if (!url) url = frame.getAttribute('src') || '';
    // Bump request id and reset loading state
    currentRequestId++;
    const reqId = currentRequestId;
    requestLoaded = false;
    if (loadWatchTimer) { try { clearTimeout(loadWatchTimer); } catch {} loadWatchTimer = null; }
    try { currentCheckAbort && currentCheckAbort.abort && currentCheckAbort.abort(); } catch {}
    // Show the overlay only if we're still loading after a short delay
    loadWatchTimer = window.setTimeout(() => {
      if (reqId !== currentRequestId || requestLoaded) return;
      if (hintEl) hintEl.hidden = false;
      renderRecents();
    }, 800);
    // Run availability check and update overlay for this request
    checkUrlAvailability(url).then((ok) => {
      if (reqId !== currentRequestId) return;
      if (hintEl) hintEl.hidden = !!ok;
      renderRecents();
    });
  }

  // Initial render of recents and load watch for initial src
  renderRecents();
  startLoadWatch();

  // Receive messages from the extension host
  window.addEventListener('message', (ev) => {
    const data = ev.data || {};
    if (!data || typeof data.type !== 'string') return;
    if (data.type === 'consoleGuide') {
      if (consoleGuideBanner) consoleGuideBanner.hidden = false;
    }
  });

  // Notify extension that the webview is ready to receive messages
  try { vscode && vscode.postMessage && vscode.postMessage({ type: 'webviewReady' }); } catch {}

  // Close action for console guide banner
  if (consoleGuideClose && consoleGuideBanner) {
    consoleGuideClose.addEventListener('click', () => {
      consoleGuideBanner.hidden = true;
    });
  }
})();
