/* ============================================
   Statusbird — Frontend Application
   ============================================ */

const STATUS_LABELS = {
  operational: 'Operational',
  degraded: 'Degraded',
  partial_outage: 'Partial Outage',
  major_outage: 'Major Outage',
  unknown: 'Unknown',
  pending: 'Checking...',
};

const App = {
  state: {
    services: [],
    selected: new Set(),
    statuses: {},
    suggestions: [],
    votedSuggestions: new Set(JSON.parse(localStorage.getItem('votedSuggestions') || '[]')),
    region: 'eu',
    sort: 'popular',
    showAll: false,
    refreshTimer: null,
  },

  // --- Initialization ---

  async init() {
    this.loadFromUrl();
    this.bindEvents();
    await this.verifyAdminSecret();
    await this.fetchServices();
    if (this.state.selected.size > 0) {
      await this.fetchStatuses();
    }
    this.fetchSuggestions();
    this.fetchChangelog();
    this.startAutoRefresh();
  },

  async verifyAdminSecret() {
    const secret = sessionStorage.getItem('adminSecret');
    if (!secret) return;
    try {
      const res = await fetch('/api/admin/ping', {
        headers: { 'X-Admin-Secret': secret },
      });
      if (!res.ok) sessionStorage.removeItem('adminSecret');
    } catch {
      sessionStorage.removeItem('adminSecret');
    }
  },


  // --- URL Sync ---

  loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get('services');
    if (ids) ids.split(',').filter(Boolean).forEach((id) => this.state.selected.add(id));

    const region = params.get('region') || localStorage.getItem('region') || 'eu';
    this.state.region = region;
    document.getElementById('region-select').value = region;
  },

  updateUrl() {
    const params = new URLSearchParams();
    if (this.state.selected.size > 0) params.set('services', [...this.state.selected].join(','));
    if (this.state.region !== 'eu') params.set('region', this.state.region);
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  },

  // --- Events ---

  bindEvents() {
    document.getElementById('service-search').addEventListener('input', (e) => {
      this.filterServices(e.target.value);
    });

    document.getElementById('suggest-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitSuggestion();
    });


    document.getElementById('region-select').addEventListener('change', (e) => {
      this.state.region = e.target.value;
      localStorage.setItem('region', this.state.region);
      this.updateUrl();
      this.fetchStatuses();
    });

    document.getElementById('deselect-all').addEventListener('click', () => {
      this.deselectAll();
    });

    document.querySelectorAll('.sort-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.sort = btn.dataset.sort;
        document.querySelectorAll('.sort-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderServiceList();
      });
    });
  },

  // --- Services ---

  async fetchServices() {
    try {
      const res = await fetch('/api/services');
      this.state.services = await res.json();
      this.renderServiceList();
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  },

  renderServiceList() {
    const container = document.getElementById('service-list');
    container.innerHTML = '';

    const countEl = document.getElementById('service-count');
    if (countEl) countEl.textContent = this.state.services.length;

    const sorted = [...this.state.services].sort((a, b) => {
      if (this.state.sort === 'popular') {
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const svc of sorted) {
      const chip = document.createElement('div');
      chip.className = `service-chip${this.state.selected.has(svc.id) ? ' active' : ''}`;
      chip.dataset.id = svc.id;
      chip.dataset.name = svc.name.toLowerCase();
      chip.dataset.category = (svc.category || '').toLowerCase();

      const logoUrl = this.getLogoUrl(svc.logoDomain || svc.statusPageUrl);
      chip.innerHTML = `
        <div class="chip-avatar" style="background:${svc.color}">
          ${logoUrl ? `<img src="${logoUrl}" alt="" class="chip-logo" onerror="this.style.display='none'">` : ''}
          <span>${svc.name.charAt(0)}</span>
        </div>
        <span class="chip-name">${esc(svc.name)}</span>
      `;

      chip.addEventListener('click', () => this.toggleService(svc.id, chip));
      container.appendChild(chip);
    }

    this.updateDeselectBtn();
    this._setupServiceListToggle();
  },

  _setupServiceListToggle() {
    const container = document.getElementById('service-list');
    document.getElementById('service-list-toggle')?.remove();
    document.getElementById('service-list-toggle-bottom')?.remove();

    // Clear any previously hidden overflow chips
    container.querySelectorAll('[data-overflow]').forEach((c) => {
      delete c.dataset.overflow;
      c.style.display = '';
    });

    requestAnimationFrame(() => {
      const chips = [...container.querySelectorAll('.service-chip:not(.hidden)')];
      if (chips.length === 0) return;

      // Find which chips are in row 3+ by comparing offsetTop
      const rowTops = [];
      const overflowChips = [];
      for (const chip of chips) {
        const top = chip.offsetTop;
        if (!rowTops.some((t) => Math.abs(top - t) < 4)) rowTops.push(top);
        if (rowTops.length > 2) overflowChips.push(chip);
      }
      if (overflowChips.length === 0) return;

      // Hide row 3+ chips
      overflowChips.forEach((c) => { c.dataset.overflow = 'true'; c.style.display = 'none'; });

      const makeBtn = (id) => {
        const b = document.createElement('button');
        b.id = id;
        b.className = 'service-list-toggle';
        return b;
      };

      const btnTop = makeBtn('service-list-toggle');
      const btnBottom = makeBtn('service-list-toggle-bottom');

      let collapsed = !this.state.showAll;
      if (!collapsed) overflowChips.forEach((c) => { c.style.display = ''; });

      const render = () => {
        const label = collapsed ? 'Show all' : 'Show less';
        btnTop.textContent = label;
        btnBottom.textContent = label;
      };
      render();

      const toggle = () => {
        collapsed = !collapsed;
        this.state.showAll = !collapsed;
        overflowChips.forEach((c) => { c.style.display = collapsed ? 'none' : ''; });
        render();
      };
      btnTop.addEventListener('click', toggle);
      btnBottom.addEventListener('click', toggle);

      const titleActions = document.querySelector('.title-actions');
      const deselectBtn = document.getElementById('deselect-all');
      titleActions.insertBefore(btnTop, deselectBtn);

      const wrap = document.getElementById('service-list-toggle-wrap');
      wrap.innerHTML = '';
      wrap.appendChild(btnBottom);
    });
  },

  toggleService(id, chip) {
    if (this.state.selected.has(id)) {
      this.state.selected.delete(id);
      chip.classList.remove('active');
    } else {
      this.state.selected.add(id);
      chip.classList.add('active');
    }
    this.updateDeselectBtn();
    this.updateUrl();
    this.fetchStatuses();
  },

  deselectAll() {
    this.state.selected.clear();
    document.querySelectorAll('.service-chip.active').forEach((c) => c.classList.remove('active'));
    this.updateDeselectBtn();
    this.updateUrl();
    this.fetchStatuses();
  },

  updateDeselectBtn() {
    const btn = document.getElementById('deselect-all');
    if (btn) btn.style.display = this.state.selected.size > 0 ? '' : 'none';
  },

  filterServices(query) {
    const q = query.toLowerCase().trim();

    // Temporarily show all overflow chips so search can find them
    const container = document.getElementById('service-list');
    container.querySelectorAll('[data-overflow]').forEach((c) => { c.style.display = ''; });

    const chips = document.querySelectorAll('.service-chip');
    chips.forEach((chip) => {
      const match =
        !q ||
        chip.dataset.name.includes(q) ||
        chip.dataset.category.includes(q);
      chip.classList.toggle('hidden', !match);
    });

    const toggleBtn = document.getElementById('service-list-toggle');
    if (q) {
      if (toggleBtn) toggleBtn.style.display = 'none';
    } else {
      // Re-hide overflow chips and restore toggle
      container.querySelectorAll('[data-overflow]').forEach((c) => { c.style.display = 'none'; });
      if (toggleBtn) toggleBtn.style.display = '';
    }
  },

  // --- Status ---

  async fetchStatuses() {
    const section = document.getElementById('status-section');
    if (this.state.selected.size === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    const ids = [...this.state.selected].join(',');
    try {
      const res = await fetch(`/api/status?ids=${ids}&region=${this.state.region}`);
      this.state.statuses = await res.json();
      this.renderStatusGrid();
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  },

  renderSummary() {
    const el = document.getElementById('status-summary');
    const statuses = Object.values(this.state.statuses);
    if (statuses.length === 0) { el.style.display = 'none'; return; }

    const counts = { operational: 0, degraded: 0, partial_outage: 0, major_outage: 0, unknown: 0 };
    for (const s of statuses) counts[s.status || 'unknown'] = (counts[s.status || 'unknown'] || 0) + 1;

    const issues = counts.degraded + counts.partial_outage + counts.major_outage;
    let level, text;

    if (issues === 0 && counts.unknown === statuses.length) {
      level = 'unknown'; text = 'Status unavailable';
    } else if (issues === 0) {
      level = 'ok'; text = 'All systems operational';
    } else {
      level = counts.major_outage > 0 ? 'error' : counts.partial_outage > 0 ? 'warning' : 'caution';
      const parts = [];
      if (counts.major_outage)  parts.push(`${counts.major_outage} Major Outage${counts.major_outage  > 1 ? 's' : ''}`);
      if (counts.partial_outage) parts.push(`${counts.partial_outage} Partial Outage${counts.partial_outage > 1 ? 's' : ''}`);
      if (counts.degraded)      parts.push(`${counts.degraded} Degraded`);
      if (counts.operational)   parts.push(`${counts.operational} Operational`);
      text = parts.join(' · ');
    }

    el.className = `status-summary ${level}`;
    el.style.display = 'flex';
    el.innerHTML = `<span class="summary-dot ${level}"></span><span class="summary-text">${text}</span>`;
  },

  renderStatusGrid() {
    const grid = document.getElementById('status-grid');
    grid.innerHTML = '';

    this.renderSummary();

    if (this.state.selected.size === 0) {
      grid.innerHTML = '<div class="empty-state"><p>Select services above to see their status.</p></div>';
      return;
    }

    for (const id of this.state.selected) {
      const svc = this.state.services.find((s) => s.id === id);
      if (!svc) continue;

      const status = this.state.statuses[id];
      const statusKey = status?.status || 'unknown';
      const description = status?.description || 'Checking...';
      const updatedAt = status?.updatedAt;
      const incidents = status?.incidents || [];

      const card = document.createElement('div');
      card.className = 'status-card';

      // Main body
      const logoUrl = this.getLogoUrl(svc.logoDomain || svc.statusPageUrl);
      card.innerHTML = `
        <div class="status-card-body">
          <div class="status-card-header">
            <div class="chip-avatar" style="background:${svc.color};width:28px;height:28px;font-size:0.75rem;">
              ${logoUrl ? `<img src="${logoUrl}" alt="" class="chip-logo" onerror="this.style.display='none'">` : ''}
              <span>${svc.name.charAt(0)}</span>
            </div>
            <span class="status-card-name">${esc(svc.name)}</span>
            <a class="report-btn" href="https://github.com/NukeMyDay/pingfalcon/issues/new?title=${encodeURIComponent(`Service report: ${svc.name}`)}&body=${encodeURIComponent(`**Service:** ${svc.name}\n**Status:** ${statusKey}\n**Message:** ${description}\n**Status page:** ${svc.statusPageUrl || 'N/A'}\n\n**Issue description:**\n<!-- Please describe the issue here -->`)}" target="_blank" rel="noopener" title="Report an issue">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M14.5 2H2.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 1 0V9h11.5a.5.5 0 0 0 .4-.8l-2-2.7 2-2.7a.5.5 0 0 0-.4-.8ZM3 8V3h10.3l-1.6 2.2a.5.5 0 0 0 0 .6L13.3 8H3Z"/></svg>
            </a>
          </div>
          <div class="status-indicator">
            <span class="status-dot ${statusKey}"></span>
            <span class="status-label ${statusKey}">${STATUS_LABELS[statusKey] || statusKey}</span>
          </div>
          <div class="status-meta">${esc(description)}</div>
          ${updatedAt ? `<div class="status-meta" data-timestamp="${updatedAt}">Updated ${timeAgo(updatedAt)}</div>` : ''}
          ${svc.statusPageUrl ? `<a class="status-link" href="${esc(svc.statusPageUrl)}" target="_blank" rel="noopener">Status Page &nearr;</a>` : ''}
        </div>
      `;

      // Expandable incidents section
      if (incidents.length > 0) {
        const toggle = document.createElement('button');
        toggle.className = 'status-card-toggle';
        toggle.innerHTML = `
          <span>${incidents.length} active incident${incidents.length > 1 ? 's' : ''}</span>
          <svg class="toggle-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        `;
        toggle.addEventListener('click', () => card.classList.toggle('expanded'));

        const details = document.createElement('div');
        details.className = 'incident-details';
        details.innerHTML = incidents.map((inc) => `
          <div class="incident-item">
            <div class="incident-title">${esc(inc.name)}</div>
            <div class="incident-meta">
              <span class="incident-badge ${inc.status || 'investigating'}">${esc(inc.status || 'investigating')}</span>
              ${inc.impact ? `<span class="incident-impact">Impact: ${esc(inc.impact)}</span>` : ''}
              ${inc.updatedAt ? `<span class="incident-time">${timeAgo(inc.updatedAt)}</span>` : ''}
              ${inc.url ? `<a class="incident-link" href="${esc(inc.url)}" target="_blank" rel="noopener">Details &nearr;</a>` : ''}
            </div>
          </div>
        `).join('');

        card.appendChild(toggle);
        card.appendChild(details);
      }

      grid.appendChild(card);
    }

  },

  // --- Changelog ---

  async fetchChangelog() {
    const CACHE_KEY = 'pf_changelog';
    const CACHE_TTL = 5 * 60 * 1000;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { this.renderChangelog(data); return; }
      }
      const res = await fetch('https://api.github.com/repos/NukeMyDay/pingfalcon/commits?per_page=5');
      const data = await res.json();
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      this.renderChangelog(data);
    } catch { /* silently fail */ }
  },

  renderChangelog(commits) {
    const el = document.getElementById('changelog-list');
    if (!el || !Array.isArray(commits)) return;
    const items = commits.map((c) => {
      const sha = c.sha.slice(0, 7);
      const msg = c.commit.message.split('\n')[0].slice(0, 72);
      const date = timeAgo(c.commit.author.date);
      return `<div class="changelog-item">
        <a class="changelog-sha" href="${c.html_url}" target="_blank" rel="noopener">${sha}</a>
        <span class="changelog-msg">${esc(msg)}</span>
        <span class="changelog-date">${date}</span>
      </div>`;
    }).join('');
    el.innerHTML = items + `<a class="changelog-all-link" href="https://github.com/NukeMyDay/pingfalcon/commits/master" target="_blank" rel="noopener">View full changelog on GitHub →</a>`;
  },

  startAutoRefresh() {
    // Refresh every 60 seconds
    this.state.refreshTimer = setInterval(() => {
      if (this.state.selected.size > 0) {
        this.fetchStatuses();
      }
    }, 60000);

    // Update "time ago" labels every second
    setInterval(() => {
      document.querySelectorAll('[data-timestamp]').forEach((el) => {
        el.textContent = `Updated ${timeAgo(el.dataset.timestamp)}`;
      });
    }, 1000);
  },

  // --- Helpers ---

  getLogoUrl(input) {
    if (!input) return null;
    try {
      let domain;
      if (input.includes('://')) {
        const { hostname } = new URL(input);
        const parts = hostname.split('.');
        domain = parts.length > 2 ? parts.slice(-2).join('.') : hostname;
      } else {
        domain = input;
      }
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  },

  // --- Suggestions ---

  async fetchSuggestions() {
    try {
      const res = await fetch('/api/suggestions');
      this.state.suggestions = await res.json();
      this.renderSuggestions();
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    }
  },

  renderSuggestions() {
    const list = document.getElementById('suggestions-list');
    list.innerHTML = '';

    if (this.state.suggestions.length === 0) {
      list.innerHTML = '<p class="text-secondary" style="font-size:0.85rem;margin-top:8px;">No suggestions yet. Be the first!</p>';
      return;
    }

    const adminSecret = sessionStorage.getItem('adminSecret');

    for (const s of this.state.suggestions) {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `
        <div>
          <div class="suggestion-name">${esc(s.name)}</div>
        </div>
        <div class="suggestion-right">
          <span class="vote-count">${s.votes}</span>
          <button class="btn-vote${this.state.votedSuggestions.has(s.id) ? ' voted' : ''}" data-id="${s.id}" title="Upvote">${this.state.votedSuggestions.has(s.id) ? 'Voted' : '+1'}</button>
          ${adminSecret ? `<button class="btn-delete-suggestion" data-id="${s.id}" title="Delete">×</button>` : ''}
        </div>
      `;

      item.querySelector('.btn-vote').addEventListener('click', (e) => {
        this.vote(s.id, e.target);
      });

      if (adminSecret) {
        item.querySelector('.btn-delete-suggestion').addEventListener('click', () => {
          this.deleteSuggestion(s.id, item, adminSecret);
        });
      }

      list.appendChild(item);
    }
  },

  async submitSuggestion() {
    const nameEl = document.getElementById('suggest-name');
    const msgEl = document.getElementById('suggest-msg');

    const name = nameEl.value.trim();

    if (!name) return;

    // Check if the name matches an already-monitored service
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = this.state.services.find(
      (s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
    );
    if (existing) {
      this.state.selected.add(existing.id);
      this.updateUrl();
      this.updateDeselectBtn();
      // Move chip to first position so it's visible even in collapsed view
      const container = document.getElementById('service-list');
      const chip = container.querySelector(`.service-chip[data-id="${existing.id}"]`);
      if (chip) {
        chip.classList.add('active');
        container.prepend(chip);
        this._setupServiceListToggle();
      }
      // Immediately fetch status so the monitoring card appears right away
      this.fetchStatuses();
      nameEl.value = '';
      msgEl.textContent = 'Service already exists — selected for you.';
      msgEl.className = 'form-hint success';
      setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'form-hint'; }, 5000);
      return;
    }

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (res.ok) {
        msgEl.textContent = data.message;
        msgEl.className = 'form-hint success';
        nameEl.value = '';
        this.fetchSuggestions();
      } else {
        msgEl.textContent = data.error || 'Something went wrong.';
        msgEl.className = 'form-hint error';
      }
    } catch {
      msgEl.textContent = 'Network error. Please try again.';
      msgEl.className = 'form-hint error';
    }

    setTimeout(() => {
      msgEl.textContent = '';
      msgEl.className = 'form-hint';
    }, 5000);
  },

  async deleteSuggestion(id, itemEl, secret) {
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Secret': secret },
      });
      if (res.ok) {
        itemEl.remove();
        this.state.suggestions = this.state.suggestions.filter((s) => s.id !== id);
      } else {
        alert('Delete failed. Check your admin secret.');
      }
    } catch {
      alert('Network error.');
    }
  },

  async vote(suggestionId, btn) {
    const isVoted = this.state.votedSuggestions.has(suggestionId);
    try {
      const res = await fetch(`/api/suggestions/${suggestionId}/vote`, {
        method: isVoted ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        if (isVoted) {
          this.state.votedSuggestions.delete(suggestionId);
        } else {
          this.state.votedSuggestions.add(suggestionId);
        }
        localStorage.setItem('votedSuggestions', JSON.stringify([...this.state.votedSuggestions]));
        await this.fetchSuggestions();
      } else if (res.status === 409 && !isVoted) {
        // Already voted server-side — sync local state
        this.state.votedSuggestions.add(suggestionId);
        localStorage.setItem('votedSuggestions', JSON.stringify([...this.state.votedSuggestions]));
        btn.classList.add('voted');
        btn.textContent = 'Voted';
      }
    } catch {
      // Silent fail
    }
  },
};

// --- Helpers ---

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 2) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// --- Theme ---

const Theme = {
  init() {
    this.update();
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      this.update();
    });
  },
  update() {
    const isDark = document.documentElement.classList.contains('dark');
    document.getElementById('theme-label').textContent = isDark ? 'Light mode' : 'Dark mode';
  },
};

// --- Copy code snippets ---

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;

function copyCode(btn) {
  const code = btn.closest('.code-block').querySelector('code');
  navigator.clipboard.writeText(code.textContent.trim()).then(() => {
    btn.innerHTML = CHECK_ICON;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = COPY_ICON;
      btn.classList.remove('copied');
    }, 1500);
  });
}

// --- Boot ---

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  App.init();
});
