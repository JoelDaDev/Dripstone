'use strict';

/* ================================================================
   DRIPSTONE DATA TERMINAL
   ================================================================ */

const INDEX_PATH = 'data/index.json';

class DripstoneApp {
  constructor() {
    this.index        = null;
    this.currentPath  = null;
    this.currentRaw   = null;
    this.allFiles     = [];

    this.$fileList    = document.getElementById('file-list');
    this.$fileCount   = document.getElementById('file-count');
    this.$pathText    = document.getElementById('path-text');
    this.$jsonView    = document.getElementById('json-view');
    this.$welcome     = document.getElementById('welcome-screen');
    this.$statusMsg   = document.getElementById('status-msg');
    this.$entryCount  = document.getElementById('entry-count');
    this.$actions     = document.getElementById('content-actions');
    this.$search      = document.getElementById('search-input');
    this.$clock       = document.getElementById('clock');

    this.init();
  }

  async init() {
    this.startClock();
    this.bindNav();
    this.bindActions();
    this.bindSearch();

    await this.loadIndex();

    // Handle URL hash for deep-linking to a file
    if (window.location.hash) {
      const hashPath = decodeURIComponent(window.location.hash.slice(1));
      const entry = this.allFiles.find(f => f.path === hashPath);
      if (entry) this.loadFile(entry);
    }

    window.addEventListener('hashchange', () => {
      if (!window.location.hash) return;
      const hashPath = decodeURIComponent(window.location.hash.slice(1));
      const entry = this.allFiles.find(f => f.path === hashPath);
      if (entry) this.loadFile(entry);
    });
  }

  /* ── Clock ── */
  startClock() {
    const tick = () => {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      this.$clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ── Nav view switching ── */
  bindNav() {
    document.querySelectorAll('.t-nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        document.querySelectorAll('.t-nav-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        document.querySelectorAll('.view').forEach(v => {
          v.classList.toggle('active', v.id === `view-${view}`);
        });
      });
    });
  }

  /* ── Action buttons ── */
  bindActions() {
    document.getElementById('btn-copy-url').addEventListener('click', () => {
      if (!this.currentPath) return;
      const url = `${location.origin}${location.pathname}#${encodeURIComponent(this.currentPath)}`;
      navigator.clipboard.writeText(url).then(() => this.flash('btn-copy-url', 'COPIED!'));
    });

    document.getElementById('btn-copy-json').addEventListener('click', () => {
      if (!this.currentRaw) return;
      navigator.clipboard.writeText(JSON.stringify(this.currentRaw, null, 2))
        .then(() => this.flash('btn-copy-json', 'COPIED!'));
    });

    document.getElementById('btn-collapse').addEventListener('click', () => {
      this.$jsonView.querySelectorAll('.jn-children').forEach(el => el.classList.add('collapsed'));
      this.$jsonView.querySelectorAll('.jn-toggle').forEach(el => el.textContent = '▶');
    });

    document.getElementById('btn-expand').addEventListener('click', () => {
      this.$jsonView.querySelectorAll('.jn-children').forEach(el => el.classList.remove('collapsed'));
      this.$jsonView.querySelectorAll('.jn-toggle').forEach(el => el.textContent = '▼');
    });
  }

  flash(id, text) {
    const btn = document.getElementById(id);
    const orig = btn.textContent;
    btn.textContent = text;
    btn.classList.add('flash');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('flash'); }, 1400);
  }

  /* ── Search ── */
  bindSearch() {
    this.$search.addEventListener('input', () => {
      const q = this.$search.value.trim().toLowerCase();
      this.renderFileList(q);
    });
  }

  /* ── Load index.json ── */
  async loadIndex() {
    this.setStatus('LOADING INDEX...');
    try {
      const res = await fetch(INDEX_PATH);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.index = await res.json();
      this.allFiles = this.index.files || [];
      this.renderFileList('');
      const count = this.allFiles.length;
      this.$fileCount.textContent = `${count} file${count !== 1 ? 's' : ''}`;
      this.setStatus('READY');
    } catch (err) {
      this.$fileList.innerHTML = `<div class="list-msg">ERROR: ${esc(err.message)}</div>`;
      this.setStatus(`INDEX LOAD FAILED`);
    }
  }

  /* ── Render sidebar file list ── */
  renderFileList(query) {
    const files = query
      ? this.allFiles.filter(f =>
          (f.name        || '').toLowerCase().includes(query) ||
          (f.description || '').toLowerCase().includes(query) ||
          (f.category    || '').toLowerCase().includes(query) ||
          (f.tags || []).some(t => t.toLowerCase().includes(query))
        )
      : this.allFiles;

    if (files.length === 0) {
      this.$fileList.innerHTML = `<div class="list-msg">NO RESULTS</div>`;
      return;
    }

    // Group by category
    const groups = {};
    files.forEach(f => {
      const cat = f.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    });

    let html = '';
    for (const [cat, entries] of Object.entries(groups)) {
      html += `<div class="cat-group">`;
      html += `<div class="cat-label">${esc(cat)}</div>`;
      entries.forEach(f => {
        const isActive = f.path === this.currentPath;
        const tags = (f.tags || []).map(t => `<span class="fe-tag">${esc(t)}</span>`).join('');
        html += `
          <div class="file-entry" data-path="${esc(f.path)}" role="option" aria-selected="${isActive}" tabindex="0">
            <div class="fe-name">${esc(f.name || f.id)}</div>
            ${f.description ? `<div class="fe-desc">${esc(f.description)}</div>` : ''}
            ${tags ? `<div class="fe-tags">${tags}</div>` : ''}
          </div>`;
      });
      html += `</div>`;
    }

    this.$fileList.innerHTML = html;

    // Bind click events
    this.$fileList.querySelectorAll('.file-entry').forEach(el => {
      const onClick = () => {
        const path = el.dataset.path;
        const entry = this.allFiles.find(f => f.path === path);
        if (entry) this.loadFile(entry);
      };
      el.addEventListener('click', onClick);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onClick(); });
    });
  }

  /* ── Load and display a data file ── */
  async loadFile(entry) {
    this.currentPath = entry.path;
    this.setStatus(`LOADING ${entry.name.toUpperCase()}...`);
    this.$entryCount.textContent = '';
    this.$pathText.textContent = entry.path;
    this.$welcome.style.display = 'none';
    this.$jsonView.innerHTML = '<div class="list-msg">FETCHING DATA...</div>';
    this.$actions.classList.remove('visible');

    // Update sidebar selection
    this.$fileList.querySelectorAll('.file-entry').forEach(el => {
      const active = el.dataset.path === entry.path;
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    // Update URL hash silently
    history.replaceState(null, '', `#${encodeURIComponent(entry.path)}`);

    try {
      const res = await fetch(entry.path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.currentRaw = data;

      this.$jsonView.innerHTML = this.renderJSON(data);
      this.bindToggleNodes();

      this.$actions.classList.add('visible');
      const entryCount = this.countEntries(data);
      this.$entryCount.textContent = entryCount;
      this.setStatus('LOADED');
    } catch (err) {
      this.$jsonView.innerHTML = `<div class="list-msg" style="color:#f08070">ERROR: ${esc(err.message)}</div>`;
      this.setStatus('LOAD FAILED');
    }
  }

  countEntries(data) {
    if (Array.isArray(data)) return `${data.length} entries`;
    if (typeof data === 'object' && data !== null) {
      const k = Object.keys(data).length;
      return `${k} key${k !== 1 ? 's' : ''}`;
    }
    return '';
  }

  /* ── Toggle collapse/expand on click ── */
  bindToggleNodes() {
    this.$jsonView.querySelectorAll('.jn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const children = btn.closest('.jn-node').querySelector(':scope > .jn-children');
        if (!children) return;
        const collapsed = children.classList.toggle('collapsed');
        btn.textContent = collapsed ? '▶' : '▼';
        const summary = btn.closest('.jn-row').querySelector('.jn-summary');
        if (summary) summary.style.display = collapsed ? '' : 'none';
      });
    });
  }

  /* ── JSON renderer ── */
  renderJSON(value, key = null, isLast = true, depth = 0) {
    const comma = isLast ? '' : `<span class="jn-comma">,</span>`;
    const keyHtml = key !== null
      ? `<span class="jn-key">"${esc(String(key))}"</span><span class="jn-colon">:</span>`
      : '';

    // Primitives
    if (value === null)
      return `<div class="jn-row"><span class="jn-leaf">${keyHtml}<span class="jn-null">null</span>${comma}</span></div>`;
    if (typeof value === 'boolean')
      return `<div class="jn-row"><span class="jn-leaf">${keyHtml}<span class="jn-bool">${value}</span>${comma}</span></div>`;
    if (typeof value === 'number')
      return `<div class="jn-row"><span class="jn-leaf">${keyHtml}<span class="jn-num">${value}</span>${comma}</span></div>`;
    if (typeof value === 'string')
      return `<div class="jn-row"><span class="jn-leaf">${keyHtml}<span class="jn-str">"${esc(value)}"</span>${comma}</span></div>`;

    // Array
    if (Array.isArray(value)) {
      const len = value.length;
      if (len === 0)
        return `<div class="jn-row"><span class="jn-leaf">${keyHtml}<span class="jn-brak">[]</span>${comma}</span></div>`;

      const summary = `<span class="jn-summary">${len} item${len !== 1 ? 's' : ''}</span>`;
      const children = value.map((v, i) => this.renderJSON(v, null, i === len - 1, depth + 1)).join('');
      return `
        <div class="jn-node">
          <div class="jn-row">
            <button class="jn-toggle" aria-label="Toggle">▼</button>
            ${keyHtml}<span class="jn-brak">[</span>${summary}
          </div>
          <div class="jn-children">${children}</div>
          <div class="jn-row"><span class="jn-brak">]</span>${comma}</div>
        </div>`;
    }

    // Object
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0)
        return `<div class="jn-row"><span class="jn-leaf">${keyHtml}<span class="jn-brak">{}</span>${comma}</span></div>`;

      const summary = `<span class="jn-summary">${keys.length} key${keys.length !== 1 ? 's' : ''}</span>`;
      const children = keys.map((k, i) => this.renderJSON(value[k], k, i === keys.length - 1, depth + 1)).join('');
      return `
        <div class="jn-node">
          <div class="jn-row">
            <button class="jn-toggle" aria-label="Toggle">▼</button>
            ${keyHtml}<span class="jn-brak">{</span>${summary}
          </div>
          <div class="jn-children">${children}</div>
          <div class="jn-row"><span class="jn-brak">}</span>${comma}</div>
        </div>`;
    }

    return '';
  }

  setStatus(msg) { this.$statusMsg.textContent = msg; }
}

/* ── Utility: HTML-escape ── */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => new DripstoneApp());
