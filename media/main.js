// @ts-check
(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById('app');

  /** @type {any} */
  let state = { phase: 'loading' };

  const ICONS = {
    github:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
    kebab:
      '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="13" r="1.4"/></svg>',
    warn:
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2 1.5 13.5h13L8 2z" stroke-linejoin="round"/><path d="M8 6.5v3.5"/><circle cx="8" cy="12" r="0.4" fill="currentColor"/></svg>',
    pin:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m9.5 2 4.5 4.5-2 .6-2.5 2.5-.4 3-2.5-2.5L3 13.7 2.3 13l3.6-3.6L3.4 6.9l3-.4L8.9 4l.6-2z" stroke-linejoin="round"/></svg>',
    top:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 2.5h10M8 13V5.5M4.5 9 8 5.5 11.5 9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bottom:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 13.5h10M8 3v7.5M4.5 7 8 10.5 11.5 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    move:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="2.5" width="5" height="11" rx="1"/><rect x="9.5" y="2.5" width="5" height="11" rx="1"/></svg>',
    estimate:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5" stroke-linecap="round"/></svg>',
    person:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="5" r="2.8"/><path d="M2.5 14c.7-2.6 2.9-4 5.5-4s4.8 1.4 5.5 4" stroke-linecap="round"/></svg>',
    tag:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 2h5.2c.3 0 .5.1.7.3l6 6c.4.4.4 1 0 1.4l-4.2 4.2c-.4.4-1 .4-1.4 0l-6-6a1 1 0 0 1-.3-.7V2z" stroke-linejoin="round"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none"/></svg>',
    sprint:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 1.5 3.5 9H7l-1 5.5L11.5 7H8l1-5.5z" stroke-linejoin="round"/></svg>',
    close:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4 4 8 8M12 4l-8 8" stroke-linecap="round"/></svg>',
    reopen:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.7h-2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copy:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H3.5A1.5 1.5 0 0 0 2 3v5.5A1.5 1.5 0 0 0 3.5 10H4" stroke-linecap="round"/></svg>',
    comment:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 10.5a1.5 1.5 0 0 1-1.5 1.5H6l-3.5 2.5V4A1.5 1.5 0 0 1 4 2.5h8.5A1.5 1.5 0 0 1 14 4v6.5z" stroke-linejoin="round"/></svg>',
    external:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6.5 3.5H3A1.5 1.5 0 0 0 1.5 5v8A1.5 1.5 0 0 0 3 14.5h8A1.5 1.5 0 0 0 12.5 13V9.5M9.5 1.5h5v5M14 2 7.5 8.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    parent:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none"/></svg>',
    flagOff:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.5 14V2.5c2.5-1.3 4.5 1.3 7 0V9c-2.5 1.3-4.5-1.3-7 0" stroke-linejoin="round"/><path d="m1.5 1.5 13 13" stroke-linecap="round"/></svg>'
  };

  function esc(s) {
    return String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function post(msg) {
    vscode.postMessage(msg);
  }

  // ---------------------------------------------------------------- rendering

  function render() {
    closeMenu();
    switch (state.phase) {
      case 'setup':
        app.innerHTML = renderSetup();
        break;
      case 'loading':
        app.innerHTML = renderToolbar() + '<div class="status">Loading…</div>';
        break;
      case 'error':
        app.innerHTML =
          renderToolbar() +
          '<div class="status error">' +
          esc(state.message || 'Something went wrong.') +
          '</div>';
        break;
      case 'ready':
        app.innerHTML = renderToolbar() + renderCards();
        break;
    }
    wire();
  }

  function renderSetup() {
    const items = (state.setupProblems || []).map((p) => '<li>' + esc(p) + '</li>').join('');
    return (
      '<div class="setup"><h3>Zenhub setup needed</h3><ul>' +
      items +
      '</ul><button class="action" data-cmd="openSettings">Open Settings</button></div>'
    );
  }

  function renderToolbar() {
    const pipelines = state.pipelines || [];
    if (!pipelines.length) {
      return '';
    }
    const options = pipelines
      .map(
        (p) =>
          '<option value="' +
          esc(p.id) +
          '"' +
          (p.id === state.currentPipelineId ? ' selected' : '') +
          '>' +
          esc(p.name.trim()) +
          '</option>'
      )
      .join('');
    const count =
      state.phase === 'ready'
        ? '<span class="count">' + (state.issues || []).length + ' issues</span>'
        : '';
    return '<div class="toolbar"><select id="pipeline">' + options + '</select>' + count + '</div>';
  }

  function renderCards() {
    const issues = state.issues || [];
    if (!issues.length) {
      return '<div class="empty">No issues in this pipeline.</div>';
    }
    return '<div class="cards">' + issues.map(renderCard).join('') + '</div>';
  }

  function initials(login) {
    return esc(login.slice(0, 2).toUpperCase());
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) {
      return [0, 0, l];
    }
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    return [h / 6, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [
      Math.round(channel(h + 1 / 3) * 255),
      Math.round(channel(h) * 255),
      Math.round(channel(h - 1 / 3) * 255)
    ];
  }

  /**
   * Zenhub-style label colors: a light pastel pill (label hue at high
   * lightness) with a darker solid dot, and black or white text picked from
   * the pill background's luminance.
   */
  function labelColors(hex) {
    if (!/^[0-9a-fA-F]{6}$/.test(hex || '')) {
      return null;
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const dark =
      document.body.classList.contains('vscode-dark') ||
      document.body.classList.contains('vscode-high-contrast');
    const [h, s, l] = rgbToHsl(r, g, b);
    const [br, bg, bb] = hslToRgb(h, s, dark ? 0.8 : 0.86);
    // Cap the dot's lightness so pale label colors still show a visible dot.
    const [dr, dg, db] = hslToRgb(h, s, Math.min(l, 0.5));
    const luminance = (br * 299 + bg * 587 + bb * 114) / 1000;
    return {
      bg: 'rgb(' + br + ',' + bg + ',' + bb + ')',
      text: luminance >= 140 ? '#000000' : '#ffffff',
      dot: 'rgb(' + dr + ',' + dg + ',' + db + ')'
    };
  }

  function renderCard(issue, index) {
    const assignees = issue.assignees || [];
    const avatars = assignees.length
      ? assignees
          .slice(0, 3)
          .map(
            (a) =>
              '<span class="avatar" title="' +
              esc(a.login) +
              '"><img src="https://github.com/' +
              encodeURIComponent(a.login) +
              '.png?size=64" alt="' +
              esc(a.login) +
              '" data-initials="' +
              initials(a.login) +
              '"></span>'
          )
          .join('')
      : '<span class="avatar placeholder" title="Unassigned">' + ICONS.person + '</span>';

    const chips = [];
    if (issue.priority) {
      chips.push('<span class="chip priority">' + ICONS.pin + esc(issue.priority) + '</span>');
    }
    if (issue.blockedByCount > 0) {
      chips.push(
        '<span class="chip">' + ICONS.warn + ' ' + issue.blockedByCount + ' Blocking</span>'
      );
    }
    if (issue.blocksCount > 0) {
      chips.push('<span class="chip">' + ICONS.warn + ' Blocks ' + issue.blocksCount + '</span>');
    }
    if (issue.estimate !== null && issue.estimate !== undefined) {
      chips.push('<span class="chip estimate">' + esc(issue.estimate) + ' pts</span>');
    }

    const labels = (issue.labels || [])
      .map((l) => {
        const c = labelColors(l.color);
        const style = c ? 'background:' + c.bg + ';color:' + c.text + ';' : '';
        const dot = c ? '<span class="label-dot" style="background:' + c.dot + '"></span>' : '';
        return '<span class="label-pill" style="' + style + '">' + dot + esc(l.name) + '</span>';
      })
      .join('');

    return (
      '<div class="card" data-index="' +
      index +
      '"><div class="card-head">' +
      '<span class="avatars">' +
      avatars +
      '</span>' +
      '<a class="repo-link" data-url="' +
      esc(issue.htmlUrl) +
      '" title="Open on GitHub">' +
      ICONS.github +
      '<span>' +
      esc(issue.repoName) +
      ' #' +
      issue.number +
      '</span></a><span class="spacer"></span><button class="kebab" data-index="' +
      index +
      '" title="Issue options">' +
      ICONS.kebab +
      '</button></div><div class="card-title' +
      (issue.state === 'CLOSED' ? ' closed' : '') +
      '">' +
      esc(issue.title) +
      '</div>' +
      (chips.length ? '<div class="chips">' + chips.join('') + '</div>' : '') +
      (labels
        ? '<div class="chips"><span class="row-icon">' + ICONS.tag + '</span>' + labels + '</div>'
        : '') +
      (issue.parent
        ? '<a class="parent-row" data-url="' +
          esc(issue.parent.htmlUrl) +
          '" title="Parent issue #' +
          issue.parent.number +
          '">' +
          ICONS.parent +
          '<span>' +
          esc(issue.parent.title) +
          '</span></a>'
        : '') +
      '</div>'
    );
  }

  // ------------------------------------------------------------------- wiring

  function wire() {
    const select = document.getElementById('pipeline');
    if (select) {
      select.addEventListener('change', () =>
        post({ type: 'selectPipeline', pipelineId: /** @type {any} */ (select).value })
      );
    }
    app.querySelectorAll('[data-cmd="openSettings"]').forEach((el) =>
      el.addEventListener('click', () => post({ type: 'openSettings' }))
    );
    app.querySelectorAll('.repo-link, .parent-row').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        post({ type: 'open', url: el.getAttribute('data-url') });
      })
    );
    app.querySelectorAll('.kebab').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const issue = (state.issues || [])[Number(el.getAttribute('data-index'))];
        if (issue) {
          openMenu(issue, el.getBoundingClientRect());
        }
      })
    );
    app.querySelectorAll('.avatar img').forEach((img) =>
      img.addEventListener('error', () => {
        const span = img.parentElement;
        if (span) {
          span.textContent = img.getAttribute('data-initials') || '?';
        }
      })
    );
  }

  // -------------------------------------------------------------- issue menu

  let menuEls = null;

  function closeMenu() {
    if (menuEls) {
      menuEls.forEach((el) => el.remove());
      menuEls = null;
    }
  }

  // Actions that mutate via the zh CLI, so they need the issue to live in the
  // configured local repository. Browser-backed actions are always available.
  const CLI_ACTIONS = [
    'pinTop',
    'clearPriority',
    'sendTop',
    'sendBottom',
    'move',
    'duplicate',
    'close',
    'reopen',
    'assign',
    'estimate',
    'comment'
  ];

  function menuItems(issue) {
    const closed = issue.state === 'CLOSED';
    /** @type {(({action:string,label:string,icon:string})|'sep')[]} */
    const items = [
      { action: 'pinTop', label: 'Pin to top and set as high priority', icon: ICONS.pin }
    ];
    if (issue.priority) {
      items.push({ action: 'clearPriority', label: 'Clear priority', icon: ICONS.flagOff });
    }
    items.push(
      { action: 'sendTop', label: 'Send to top', icon: ICONS.top },
      { action: 'sendBottom', label: 'Send to bottom', icon: ICONS.bottom },
      { action: 'move', label: 'Move to pipeline…', icon: ICONS.move },
      'sep',
      { action: 'duplicate', label: 'Duplicate issue', icon: ICONS.copy },
      closed
        ? { action: 'reopen', label: 'Reopen issue', icon: ICONS.reopen }
        : { action: 'close', label: 'Close issue', icon: ICONS.close },
      'sep',
      { action: 'assign', label: 'Set assignee…', icon: ICONS.person },
      { action: 'estimate', label: 'Set estimate…', icon: ICONS.estimate },
      { action: 'setLabel', label: 'Set label', icon: ICONS.tag },
      { action: 'setSprint', label: 'Set sprint', icon: ICONS.sprint },
      { action: 'comment', label: 'Add comment…', icon: ICONS.comment },
      'sep',
      { action: 'openGithub', label: 'Open in GitHub', icon: ICONS.github },
      { action: 'openZenhub', label: 'Open in Zenhub', icon: ICONS.external }
    );

    const hidden = state.hiddenOptions || [];
    const visible = items.filter((item) => item === 'sep' || !hidden.includes(item.action));
    // Drop separators left dangling or doubled by hidden items.
    return visible.filter(
      (item, i) =>
        item !== 'sep' ||
        (i > 0 && i < visible.length - 1 && visible[i - 1] !== 'sep')
    );
  }

  function openMenu(issue, anchor) {
    closeMenu();

    const backdrop = document.createElement('div');
    backdrop.className = 'menu-backdrop';
    backdrop.addEventListener('click', closeMenu);

    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.innerHTML =
      '<div class="menu-header"><span>Issue options</span>' +
      '<button class="menu-close" title="Close">✕</button></div>' +
      menuItems(issue)
        .map((item) => {
          if (item === 'sep') {
            return '<div class="menu-sep"></div>';
          }
          const disabled = issue.canAct === false && CLI_ACTIONS.includes(item.action);
          return (
            '<button class="menu-item" data-action="' +
            item.action +
            '"' +
            (disabled
              ? ' disabled title="Unavailable: the zh CLI only acts on issues in the configured local repository (zhIssues.localRepoPath)"'
              : '') +
            '>' +
            item.icon +
            '<span>' +
            esc(item.label) +
            '</span></button>'
          );
        })
        .join('');

    document.body.append(backdrop, menu);
    menuEls = [backdrop, menu];

    // Position near the kebab, clamped to the viewport.
    const rect = menu.getBoundingClientRect();
    let left = Math.min(anchor.right - rect.width, window.innerWidth - rect.width - 8);
    left = Math.max(8, left);
    let top = anchor.bottom + 4;
    if (top + rect.height > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - rect.height - 8);
    }
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    menu.querySelector('.menu-close').addEventListener('click', closeMenu);
    menu.querySelectorAll('.menu-item').forEach((el) =>
      el.addEventListener('click', () => {
        const action = el.getAttribute('data-action');
        closeMenu();
        // Send the Zenhub issue id — numbers are only unique per repository.
        post({ type: 'action', action, issueId: issue.id });
      })
    );
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });

  // ------------------------------------------------------------------ startup

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg && msg.type === 'state') {
      state = msg.state;
      render();
    }
  });

  render();
  post({ type: 'ready' });
})();
