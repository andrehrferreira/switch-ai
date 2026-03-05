export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Switch AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:       #0c0c0c;
    --surface:  #141414;
    --surface2: #1c1c1c;
    --border:   #2a2a2a;
    --border2:  #383838;
    --green:    #3ecf8e;
    --green-bg: rgba(62,207,142,0.08);
    --green-dim:#1a8a5e;
    --red:      #f87171;
    --red-bg:   rgba(248,113,113,0.08);
    --orange:   #fb923c;
    --text:     #e0e0e0;
    --text2:    #a0a0a0;
    --muted:    #606060;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    min-height: 100vh;
  }

  /* ── Topbar ── */
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; height: 56px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    position: sticky; top: 0; z-index: 100;
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .logo {
    display: flex; align-items: center; gap: 8px;
    font-family: 'DM Mono', monospace;
    font-size: 15px; font-weight: 500;
    color: #fff; letter-spacing: -0.01em;
  }
  .logo-icon {
    width: 28px; height: 28px; border-radius: 7px;
    background: var(--green);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; color: #0c0c0c;
  }
  .header-divider { width: 1px; height: 20px; background: var(--border2); }
  .header-title { font-size: 13px; color: var(--text2); font-weight: 400; }
  .header-right { display: flex; align-items: center; gap: 16px; }
  .live-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 20px;
    background: var(--green-bg); border: 1px solid rgba(62,207,142,0.2);
    font-size: 11px; font-weight: 500; color: var(--green);
    font-family: 'DM Mono', monospace; letter-spacing: 0.04em;
  }
  .live-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--green);
    animation: blink 2s ease-in-out infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  #clock { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted); }

  /* ── Layout ── */
  .layout { display: flex; min-height: calc(100vh - 56px); }

  /* ── Sidebar ── */
  aside {
    width: 220px; flex-shrink: 0;
    border-right: 1px solid var(--border);
    background: var(--surface);
    padding: 16px 0;
    display: flex; flex-direction: column; gap: 2px;
  }
  .aside-section { padding: 12px 16px 4px; }
  .aside-label {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--muted);
  }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 16px; font-size: 13px; color: var(--text2);
    cursor: pointer; transition: all .15s; text-decoration: none;
    border-right: 2px solid transparent;
  }
  .nav-item:hover { color: var(--text); background: var(--surface2); }
  .nav-item.active { color: var(--text); background: var(--surface2); border-right-color: var(--green); }
  .nav-icon { font-size: 13px; width: 18px; text-align: center; opacity: .7; }

  /* ── Main ── */
  main { flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }

  /* ── Page header ── */
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; }
  .page-title { font-size: 20px; font-weight: 600; color: #fff; }
  .page-sub { font-size: 13px; color: var(--text2); margin-top: 3px; }
  .refresh-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 6px; border: 1px solid var(--border2);
    background: var(--surface2); color: var(--text2);
    font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer;
    transition: all .15s;
  }
  .refresh-btn:hover { border-color: var(--green); color: var(--green); }

  /* ── Stats grid ── */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 16px 18px; transition: border-color .2s;
  }
  .stat-card:hover { border-color: var(--border2); }
  .stat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .stat-label { font-size: 12px; color: var(--text2); font-weight: 500; }
  .stat-icon { font-size: 14px; color: var(--muted); }
  .stat-value { font-family: 'DM Mono', monospace; font-size: 26px; font-weight: 500; color: #fff; line-height: 1; }
  .stat-value.green { color: var(--green); }
  .stat-footer { font-size: 11px; color: var(--muted); margin-top: 6px; }

  /* ── Row layouts ── */
  .row-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
  .row-3 { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 12px; }

  /* ── Card ── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; overflow: hidden;
  }
  .card-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid var(--border);
  }
  .card-title { font-size: 13px; font-weight: 600; color: var(--text); }
  .card-body { padding: 16px 18px; }
  .card-badge {
    font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500;
    padding: 2px 8px; border-radius: 20px;
    background: var(--surface2); color: var(--text2); border: 1px solid var(--border2);
  }

  /* ── Backends ── */
  .backends-grid { display: flex; flex-direction: column; gap: 8px; }
  .backend-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 12px; border-radius: 6px;
    background: var(--surface2); border: 1px solid var(--border);
    transition: border-color .2s;
  }
  .backend-row:hover { border-color: var(--border2); }
  .backend-left { display: flex; flex-direction: column; gap: 2px; }
  .backend-top { display: flex; align-items: center; gap: 6px; }
  .backend-name { font-size: 13px; font-weight: 500; color: var(--text); }
  .backend-type {
    font-family: 'DM Mono', monospace; font-size: 9px;
    padding: 1px 5px; border-radius: 3px;
    background: var(--surface); color: var(--muted); border: 1px solid var(--border2);
  }
  .backend-free { font-size: 10px; color: var(--green); }
  .backend-desc { font-size: 11px; color: var(--muted); }
  .status-pill {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 500; font-family: 'DM Mono', monospace;
    padding: 3px 10px; border-radius: 20px; white-space: nowrap;
  }
  .status-pill.ok  { color: var(--green); background: var(--green-bg); border: 1px solid rgba(62,207,142,.2); }
  .status-pill.off { color: var(--muted); background: var(--surface); border: 1px solid var(--border); }
  .status-pill .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

  /* ── Activity chart ── */
  .chart { display: flex; align-items: flex-end; gap: 3px; height: 72px; }
  .bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 3px; height: 100%; justify-content: flex-end; }
  .bar-fill {
    width: 100%; border-radius: 2px 2px 0 0; min-height: 2px;
    background: var(--green-dim); transition: background .15s;
  }
  .bar-fill:hover { background: var(--green); }
  .bar-lbl { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--muted); }

  /* ── Table ── */
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table th {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--muted); text-align: left;
    padding: 0 0 10px; border-bottom: 1px solid var(--border);
  }
  .data-table td {
    padding: 9px 0; border-bottom: 1px solid var(--border);
    font-size: 12px; color: var(--text2); vertical-align: middle;
  }
  .data-table tr:last-child td { border-bottom: none; }
  .model-id {
    font-family: 'DM Mono', monospace; font-size: 11px;
    max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;
  }
  .progress { height: 3px; border-radius: 2px; background: var(--border2); flex: 1; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 2px; background: var(--green); }
  .progress-fill.warn { background: var(--orange); }
  .progress-fill.bad  { background: var(--red); }
  .flex-row { display: flex; align-items: center; gap: 8px; }

  /* ── Request list ── */
  .req-list { display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; }
  .req-row {
    display: grid; grid-template-columns: 44px 1fr 58px 50px;
    gap: 8px; align-items: center; padding: 7px 10px;
    border-radius: 5px; background: var(--surface2);
    border: 1px solid var(--border); font-size: 11px;
    transition: border-color .15s;
  }
  .req-row:hover { border-color: var(--border2); }
  .badge {
    font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500;
    padding: 2px 6px; border-radius: 4px; text-align: center;
  }
  .badge.success { color: var(--green); background: var(--green-bg); }
  .badge.failure { color: var(--red); background: var(--red-bg); }
  .req-model { font-family: 'DM Mono', monospace; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .req-latency { font-family: 'DM Mono', monospace; color: var(--muted); text-align: right; }
  .req-time { font-family: 'DM Mono', monospace; color: var(--muted); font-size: 10px; text-align: right; }

  /* ── Blacklist ── */
  .bl-list { display: flex; flex-direction: column; gap: 6px; }
  .bl-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; border-radius: 6px;
    background: var(--red-bg); border: 1px solid rgba(248,113,113,.15);
  }
  .bl-name { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--red); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px; }
  .bl-until { font-size: 10px; color: var(--muted); white-space: nowrap; }

  /* ── Categories ── */
  .cat-list { display: flex; flex-direction: column; gap: 10px; }
  .cat-row { display: flex; flex-direction: column; gap: 5px; }
  .cat-meta { display: flex; justify-content: space-between; font-size: 12px; }
  .cat-name { color: var(--text); text-transform: capitalize; }
  .cat-stat { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); }
  .cat-track { height: 3px; border-radius: 2px; background: var(--border2); overflow: hidden; }
  .cat-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--green-dim), var(--green)); }

  /* ── Misc ── */
  .empty { color: var(--muted); font-size: 12px; text-align: center; padding: 20px 0; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
</style>
</head>
<body>

<header>
  <div class="header-left">
    <div class="logo">
      <div class="logo-icon">S</div>
      switch-ai
    </div>
    <div class="header-divider"></div>
    <span class="header-title">Operations</span>
  </div>
  <div class="header-right">
    <div class="live-chip"><div class="live-dot"></div> LIVE</div>
    <div id="clock">--:--:--</div>
  </div>
</header>

<div class="layout">
  <aside>
    <div class="aside-section"><div class="aside-label">Overview</div></div>
    <a class="nav-item active" href="#"><span class="nav-icon">◈</span> Dashboard</a>
    <div class="aside-section" style="margin-top:6px"><div class="aside-label">Data</div></div>
    <a class="nav-item" href="#"><span class="nav-icon">⟳</span> Requests</a>
    <a class="nav-item" href="#"><span class="nav-icon">◇</span> Models</a>
    <a class="nav-item" href="#"><span class="nav-icon">⊘</span> Blacklist</a>
    <div class="aside-section" style="margin-top:6px"><div class="aside-label">System</div></div>
    <a class="nav-item" href="#"><span class="nav-icon">⚙</span> Backends</a>
  </aside>

  <main>
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Proxy telemetry · auto-refreshes every 5s</div>
      </div>
      <button class="refresh-btn" onclick="refresh()">↺ Refresh</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header"><span class="stat-label">Total Requests</span><span class="stat-icon">◈</span></div>
        <div class="stat-value" id="sv-total">—</div>
        <div class="stat-footer" id="sf-total">loading...</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-label">Success Rate</span><span class="stat-icon">✓</span></div>
        <div class="stat-value green" id="sv-rate">—</div>
        <div class="stat-footer" id="sf-rate">loading...</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-label">Avg Latency</span><span class="stat-icon">◷</span></div>
        <div class="stat-value" id="sv-lat">—</div>
        <div class="stat-footer" id="sf-lat">loading...</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-label">Total Cost</span><span class="stat-icon">$</span></div>
        <div class="stat-value" id="sv-cost">—</div>
        <div class="stat-footer" id="sf-cost">loading...</div>
      </div>
    </div>

    <div class="row-2">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Activity · Last 24h</span>
          <span class="card-badge" id="activity-total">— req</span>
        </div>
        <div class="card-body">
          <div class="chart" id="chart"><div class="empty">loading...</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Backends</span>
          <span class="card-badge" id="backends-ok">loading...</span>
        </div>
        <div class="card-body">
          <div class="backends-grid" id="backends-list"><div class="empty">loading...</div></div>
        </div>
      </div>
    </div>

    <div class="row-3">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Requests</span></div>
        <div class="card-body" style="padding:12px 16px;">
          <div class="req-list" id="req-list"><div class="empty">loading...</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Model Performance</span></div>
        <div class="card-body">
          <table class="data-table">
            <thead><tr><th>Model</th><th>Rate</th><th>ms</th></tr></thead>
            <tbody id="model-tbody"><tr><td colspan="3" class="empty">loading...</td></tr></tbody>
          </table>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="card">
          <div class="card-header"><span class="card-title">Blacklist</span></div>
          <div class="card-body"><div class="bl-list" id="bl-list"><div class="empty">loading...</div></div></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Categories</span></div>
          <div class="card-body"><div class="cat-list" id="cat-list"><div class="empty">loading...</div></div></div>
        </div>
      </div>
    </div>
  </main>
</div>

<script>
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

async function fetchJSON(url) {
  try { const r = await fetch(url); return r.ok ? r.json() : null; }
  catch { return null; }
}

async function refreshStats() {
  const d = await fetchJSON('/api/stats');
  if (!d) return;
  document.getElementById('sv-total').textContent = d.totalRequests;
  document.getElementById('sf-total').textContent = d.requestsPerMinute + ' req/min';
  document.getElementById('sv-rate').textContent  = Number(d.successRate).toFixed(1) + '%';
  document.getElementById('sf-rate').textContent  = d.totalRequests + ' total';
  document.getElementById('sv-lat').textContent   = Math.round(d.avgLatencyMs) + 'ms';
  document.getElementById('sf-lat').textContent   = 'across all backends';
  document.getElementById('sv-cost').textContent  = '\$' + Number(d.totalCost).toFixed(4);
  document.getElementById('sf-cost').textContent  = '\$' + Number(d.avgCostPerRequest).toFixed(5) + ' avg/req';
}

async function refreshActivity() {
  const d = await fetchJSON('/api/activity');
  const el = document.getElementById('chart');
  if (!d || d.length === 0) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
  const max = Math.max(...d.map(x => x.count), 1);
  const total = d.reduce((s, x) => s + x.count, 0);
  document.getElementById('activity-total').textContent = total + ' req';
  el.innerHTML = d.map(x => {
    const h = Math.max(3, Math.round((x.count / max) * 68));
    return \`<div class="bar-col">
      <div class="bar-fill" style="height:\${h}px" title="\${x.hour}: \${x.count}"></div>
      <div class="bar-lbl">\${x.hour.slice(0,2)}</div>
    </div>\`;
  }).join('');
}

async function refreshBackends() {
  const d = await fetchJSON('/api/backends');
  const el = document.getElementById('backends-list');
  if (!d) { el.innerHTML = '<div class="empty">unavailable</div>'; return; }
  const ok = d.filter(b => b.available).length;
  document.getElementById('backends-ok').textContent = ok + ' / ' + d.length + ' active';
  el.innerHTML = d.map(b => {
    const pill = b.available
      ? \`<div class="status-pill ok"><div class="dot"></div>online</div>\`
      : \`<div class="status-pill off"><div class="dot"></div>offline</div>\`;
    const freeTag = b.free ? \`<span class="backend-free">free</span>\` : '';
    return \`<div class="backend-row">
      <div class="backend-left">
        <div class="backend-top">
          <span class="backend-name">\${b.name}</span>
          <span class="backend-type">\${b.type}</span>
          \${freeTag}
        </div>
        <div class="backend-desc">\${b.description}</div>
      </div>
      \${pill}
    </div>\`;
  }).join('');
}

async function refreshModels() {
  const d = await fetchJSON('/api/models');
  const tbody = document.getElementById('model-tbody');
  if (!d || d.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="empty">No data yet</td></tr>'; return; }
  tbody.innerHTML = d.slice(0, 8).map(m => {
    const rate = (m.success_rate ?? 0) * 100;
    const cls = rate >= 80 ? '' : rate >= 50 ? 'warn' : 'bad';
    const short = m.model.split('/').pop() || m.model;
    return \`<tr>
      <td><span class="model-id" title="\${m.model}">\${short}</span></td>
      <td><div class="flex-row">
        <div class="progress"><div class="progress-fill \${cls}" style="width:\${rate.toFixed(0)}%"></div></div>
        <span style="font-family:'DM Mono',monospace;font-size:11px;min-width:32px;text-align:right">\${rate.toFixed(0)}%</span>
      </div></td>
      <td style="font-family:'DM Mono',monospace">\${m.avg_latency_ms ? Math.round(m.avg_latency_ms) : '—'}</td>
    </tr>\`;
  }).join('');
}

async function refreshRequests() {
  const d = await fetchJSON('/api/requests?limit=20');
  const el = document.getElementById('req-list');
  if (!d || d.length === 0) { el.innerHTML = '<div class="empty">No requests yet</div>'; return; }
  el.innerHTML = d.map(r => {
    const model = (r.final_model || '—').split('/').pop();
    const lat = r.latency_ms ? r.latency_ms + 'ms' : '—';
    const t = r.timestamp ? r.timestamp.slice(11, 19) : '';
    return \`<div class="req-row">
      <span class="badge \${r.status}">\${r.status === 'success' ? 'OK' : 'ERR'}</span>
      <span class="req-model">\${model}</span>
      <span class="req-latency">\${lat}</span>
      <span class="req-time">\${t}</span>
    </div>\`;
  }).join('');
}

async function refreshBlacklist() {
  const d = await fetchJSON('/api/blacklist');
  const el = document.getElementById('bl-list');
  if (!d || d.length === 0) { el.innerHTML = '<div class="empty">No active blocks</div>'; return; }
  el.innerHTML = d.map(b => {
    const until = b.blacklist_until ? new Date(b.blacklist_until).toLocaleTimeString('en-GB', { hour12: false }) : '?';
    const model = (b.model || '').split('/').pop();
    return \`<div class="bl-row">
      <span class="bl-name" title="\${b.model}">\${model}</span>
      <span class="bl-until">until \${until}</span>
    </div>\`;
  }).join('');
}

async function refreshCategories() {
  const d = await fetchJSON('/api/categories');
  const el = document.getElementById('cat-list');
  if (!d || d.length === 0) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
  const max = Math.max(...d.map(x => x.count), 1);
  el.innerHTML = d.map(x => {
    const w = Math.round((x.count / max) * 100);
    return \`<div class="cat-row">
      <div class="cat-meta">
        <span class="cat-name">\${x.category}</span>
        <span class="cat-stat">\${x.count} · \${x.successRate ?? 0}%</span>
      </div>
      <div class="cat-track"><div class="cat-fill" style="width:\${w}%"></div></div>
    </div>\`;
  }).join('');
}

async function refresh() {
  await Promise.all([
    refreshStats(), refreshActivity(), refreshBackends(),
    refreshModels(), refreshRequests(), refreshBlacklist(), refreshCategories(),
  ]);
}

refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
}
