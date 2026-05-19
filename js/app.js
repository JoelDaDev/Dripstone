'use strict';

const INDEX_PATH = 'data/index.json';

class DripstoneApp {
  constructor() {
    this.index       = null;
    this.currentPath = null;
    this.currentRaw  = null;
    this.allFiles    = [];

    this.$fileList   = document.getElementById('file-list');
    this.$fileCount  = document.getElementById('file-count');
    this.$title      = document.getElementById('content-title');
    this.$subtitle   = document.getElementById('content-subtitle');
    this.$dataView   = document.getElementById('data-view');
    this.$welcome    = document.getElementById('welcome-screen');
    this.$statusMsg  = document.getElementById('status-msg');
    this.$entryCount = document.getElementById('entry-count');
    this.$actions    = document.getElementById('content-actions');
    this.$search     = document.getElementById('search-input');
    this.$dataFilter = document.getElementById('data-filter');

    this.init();
  }

  async init() {
    this.bindNav();
    this.bindActions();
    this.bindSearch();
    this.bindDataFilter();

    await this.loadIndex();

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

  /* ── Nav view switching ── */
  bindNav() {
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b =>
          b.classList.toggle('active', b === btn)
        );
        document.querySelectorAll('.view').forEach(v =>
          v.classList.toggle('active', v.id === `view-${btn.dataset.view}`)
        );
      });
    });
  }

  /* ── Action buttons ── */
  bindActions() {
    document.getElementById('btn-copy-url').addEventListener('click', () => {
      if (!this.currentPath) return;
      const url = `${location.origin}${location.pathname}#${encodeURIComponent(this.currentPath)}`;
      navigator.clipboard.writeText(url).then(() => this.flash('btn-copy-url', 'Copied!'));
    });

    document.getElementById('btn-copy-json').addEventListener('click', () => {
      if (!this.currentRaw) return;
      navigator.clipboard.writeText(JSON.stringify(this.currentRaw, null, 2))
        .then(() => this.flash('btn-copy-json', 'Copied!'));
    });
  }

  flash(id, text) {
    const btn = document.getElementById(id);
    const orig = btn.textContent;
    btn.textContent = text;
    btn.classList.add('flash');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('flash'); }, 1400);
  }

  /* ── File search ── */
  bindSearch() {
    this.$search.addEventListener('input', () => {
      this.renderFileList(this.$search.value.trim().toLowerCase());
    });
  }

  /* ── Data filter (filters chips/rows in the current file view) ── */
  bindDataFilter() {
    this.$dataFilter.addEventListener('input', () => {
      const q = this.$dataFilter.value.toLowerCase().trim();

      this.$dataView.querySelectorAll('.chip').forEach(chip => {
        chip.classList.toggle('hidden', q !== '' && !chip.textContent.toLowerCase().includes(q));
      });

      this.$dataView.querySelectorAll('.data-section').forEach(section => {
        const total   = section.querySelectorAll('.chip').length;
        const visible = section.querySelectorAll('.chip:not(.hidden)').length;
        const badge   = section.querySelector('.data-section-count');
        if (badge) badge.textContent = q ? `${visible} / ${total}` : String(total);
      });

      const total   = this.$dataView.querySelectorAll('.chip').length;
      const visible = this.$dataView.querySelectorAll('.chip:not(.hidden)').length;
      this.$entryCount.textContent = q && total > 0 ? `${visible} of ${total} shown` : '';
    });
  }

  /* ── Load index.json ── */
  async loadIndex() {
    this.setStatus('Loading…');
    try {
      const res = await fetch(INDEX_PATH);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.index     = await res.json();
      this.allFiles  = this.index.files || [];
      this.renderFileList('');
      const n = this.allFiles.length;
      this.$fileCount.textContent = String(n);
      this.setStatus('');
    } catch (err) {
      this.$fileList.innerHTML = `<div class="list-msg">Failed to load index: ${esc(err.message)}</div>`;
      this.setStatus('Error loading index');
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
      this.$fileList.innerHTML = `<div class="list-msg">No results</div>`;
      return;
    }

    const groups = {};
    files.forEach(f => {
      const cat = f.category || 'General';
      (groups[cat] = groups[cat] || []).push(f);
    });

    let html = '';
    for (const [cat, entries] of Object.entries(groups)) {
      html += `<div class="cat-group">`;
      html += `<div class="cat-label">${esc(cat)}</div>`;
      entries.forEach(f => {
        const isActive = f.path === this.currentPath;
        const tags = (f.tags || []).map(t => `<span class="fe-tag">${esc(t)}</span>`).join('');
        html += `
          <div class="file-entry${isActive ? ' active' : ''}" data-path="${esc(f.path)}" role="option" aria-selected="${isActive}" tabindex="0">
            <div class="fe-name">${esc(f.name || f.id)}</div>
            ${f.description ? `<div class="fe-desc">${esc(f.description)}</div>` : ''}
            ${tags ? `<div class="fe-tags">${tags}</div>` : ''}
          </div>`;
      });
      html += `</div>`;
    }

    this.$fileList.innerHTML = html;

    this.$fileList.querySelectorAll('.file-entry').forEach(el => {
      const onClick = () => {
        const entry = this.allFiles.find(f => f.path === el.dataset.path);
        if (entry) this.loadFile(entry);
      };
      el.addEventListener('click', onClick);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onClick(); });
    });
  }

  /* ── Load and display a data file ── */
  async loadFile(entry) {
    this.currentPath = entry.path;
    this.$dataFilter.value = '';
    this.$title.textContent = entry.name || entry.id;
    this.$subtitle.textContent = '';
    this.$welcome.style.display = 'none';
    this.$dataView.innerHTML = '<div class="list-msg">Loading…</div>';
    this.$actions.classList.remove('visible');
    this.$entryCount.textContent = '';
    this.setStatus('Loading…');

    this.$fileList.querySelectorAll('.file-entry').forEach(el => {
      el.classList.toggle('active', el.dataset.path === entry.path);
      el.setAttribute('aria-selected', el.dataset.path === entry.path ? 'true' : 'false');
    });

    history.replaceState(null, '', `#${encodeURIComponent(entry.path)}`);

    try {
      const res = await fetch(entry.path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.currentRaw = data;

      this.$dataView.innerHTML = this.renderData(data);
      this.$actions.classList.add('visible');

      const summary = this.dataSummary(data);
      this.$subtitle.textContent = summary;
      this.$entryCount.textContent = '';
      this.setStatus('');
    } catch (err) {
      this.$dataView.innerHTML = `<div class="list-msg" style="color:#e07070">Error: ${esc(err.message)}</div>`;
      this.setStatus('Load failed');
    }
  }

  dataSummary(data) {
    if (Array.isArray(data)) return `${data.length} items`;
    if (typeof data !== 'object' || data === null) return '';
    const keys = Object.keys(data);
    if (keys.every(k => Array.isArray(data[k]))) {
      const total = keys.reduce((n, k) => n + data[k].length, 0);
      return `${keys.length} categories · ${total} items`;
    }
    return `${keys.length} entries`;
  }

  /* ── Smart data renderer ── */
  renderData(data) {
    if (typeof data !== 'object' || data === null) {
      return `<div class="list-msg">${esc(String(data))}</div>`;
    }

    const keys = Object.keys(data);

    // All values are string arrays → categorised chip grids
    if (!Array.isArray(data) && keys.length > 0 &&
        keys.every(k => Array.isArray(data[k]) && data[k].every(v => typeof v === 'string'))) {
      return this.renderChipSections(data);
    }

    // Flat string array
    if (Array.isArray(data) && data.every(v => typeof v === 'string')) {
      return `<div class="data-section">${this.renderChipGrid(data)}</div>`;
    }

    // Single key whose value is an object of objects (e.g. version_list.json)
    if (!Array.isArray(data) && keys.length === 1) {
      const inner = data[keys[0]];
      if (typeof inner === 'object' && !Array.isArray(inner) && inner !== null) {
        const innerKeys = Object.keys(inner);
        if (innerKeys.every(k => typeof inner[k] === 'object' && inner[k] !== null && !Array.isArray(inner[k]))) {
          return this.renderObjectCards(inner);
        }
      }
    }

    // Generic object fallback
    return this.renderGenericObject(data);
  }

  renderChipSections(data) {
    return Object.entries(data).map(([key, arr]) => {
      const title = key.replace(/_/g, ' ');
      return `
        <div class="data-section">
          <div class="data-section-header">
            <span class="data-section-title">${esc(title)}</span>
            <span class="data-section-count">${arr.length}</span>
          </div>
          ${this.renderChipGrid(arr)}
        </div>`;
    }).join('');
  }

  renderChipGrid(arr) {
    const chips = arr.map(v => `<span class="chip">${esc(v)}</span>`).join('');
    return `<div class="chip-grid">${chips}</div>`;
  }

  renderObjectCards(obj) {
    const cards = Object.entries(obj).map(([name, data]) => {
      const rows = Object.entries(data).map(([k, v]) => {
        const displayKey = k.replace(/_/g, ' ');
        const displayVal = Array.isArray(v) ? v.join(', ') : String(v);
        return `
          <div class="version-card-row">
            <span class="version-card-key">${esc(displayKey)}</span>
            <span class="version-card-val">${esc(displayVal)}</span>
          </div>`;
      }).join('');
      return `
        <div class="version-card">
          <div class="version-card-title">${esc(name)}</div>
          ${rows}
        </div>`;
    }).join('');
    return `<div class="version-grid">${cards}</div>`;
  }

  renderGenericObject(data) {
    const rows = Object.entries(data).map(([k, v]) => {
      const displayKey = k.replace(/_/g, ' ');
      const displayVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `
        <div class="version-card-row">
          <span class="version-card-key">${esc(displayKey)}</span>
          <span class="version-card-val">${esc(displayVal)}</span>
        </div>`;
    }).join('');
    return `
      <div class="version-card" style="max-width:600px">
        ${rows}
      </div>`;
  }

  setStatus(msg) { this.$statusMsg.textContent = msg; }
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => new DripstoneApp());
