export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Switch AI · Operations</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:       #080c14;
    --panel:    #0d1424;
    --border:   #1a2a45;
    --border2:  #243555;
    --cyan:     #00e5ff;
    --cyan-dim: #0097aa;
    --green:    #2ed573;
    --red:      #ff4757;
    --orange:   #ffa502;
    --text:     #c8d8f0;
    --muted:    #4a6080;
    --label:    #7a9fc0;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    min-height: 100vh;
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,229,255,0.04) 0%, transparent 100%),
      url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='none'/%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%231a2a45' opacity='0.4'/%3E%3C/svg%3E");
  }

  /* ── Topbar ── */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 28px;
    border-bottom: 1px solid var(--border);
    background: rgba(13,20,36,0.9);
    backdrop-filter: blur(8px);
    position: sticky; top: 0; z-index: 100;
  }
  .logo {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 17px;
    letter-spacing: 0.04em;
    color: #fff;
    display: flex; align-items: center; gap: 10px;
  }
  .logo span { color: var(--cyan); }
  .live-badge {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; color: var(--green);
    font-weight: 500; letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,100% { opacity:1; box-shadow: 0 0 8px var(--green); }
    50%      { opacity:.4; box-shadow: 0 0 3px var(--green); }
  }
  #clock { color: var(--muted); font-size: 11px; letter-spacing: 0.06em; }

  /* ── Layout ── */
  main { padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; }

  /* ── Stat cards ── */
  .stats-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
  .stat-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 18px 20px;
    position: relative; overflow: hidden;
    transition: border-color .2s;
  }
  .stat-card:hover { border-color: var(--border2); }
  .stat-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--cyan), transparent);
    opacity: 0; transition: opacity .3s;
  }
  .stat-card:hover::before { opacity: 1; }
  .stat-label {
    font-family: 'Syne', sans-serif;
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); margin-bottom: 10px;
  }
  .stat-value {
    font-size: 28px; font-weight: 700;
    color: #fff; letter-spacing: -0.01em;
    line-height: 1;
  }
  .stat-value.cyan { color: var(--cyan); }
  .stat-value.green { color: var(--green); }
  .stat-sub { font-size: 11px; color: var(--muted); margin-top: 6px; }

  /* ── Panels ── */
  .row-2 { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; }
  .row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .panel-title {
    font-family: 'Syne', sans-serif;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--label);
    border-bottom: 1px solid var(--border);
    padding-bottom: 10px;
  }

  /* ── Bar chart (activity) ── */
  .bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 80px; }
  .bar-wrap { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 4px; height: 100%; justify-content: flex-end; }
  .bar {
    width: 100%; border-radius: 3px 3px 0 0;
    background: linear-gradient(180deg, var(--cyan) 0%, var(--cyan-dim) 100%);
    min-height: 2px;
    transition: height .6s ease;
    position: relative;
  }
  .bar:hover { background: var(--cyan); }
  .bar-label { font-size: 9px; color: var(--muted); white-space: nowrap; }

  /* ── Model table ── */
  .model-table { width: 100%; border-collapse: collapse; }
  .model-table th {
    font-family: 'Syne', sans-serif;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--muted); text-align: left;
    padding: 4px 0 8px;
    border-bottom: 1px solid var(--border);
  }
  .model-table td {
    padding: 7px 0;
    border-bottom: 1px solid rgba(26,42,69,0.5);
    color: var(--text); font-size: 12px;
    vertical-align: middle;
  }
  .model-table tr:last-child td { border-bottom: none; }
  .model-name { color: #fff; font-size: 11px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rate-bar-wrap { display: flex; align-items: center; gap: 8px; }
  .rate-bar { height: 4px; border-radius: 2px; background: var(--border); flex: 1; overflow: hidden; }
  .rate-fill { height: 100%; border-radius: 2px; background: var(--green); transition: width .6s ease; }
  .rate-fill.med  { background: var(--orange); }
  .rate-fill.low  { background: var(--red); }
  .pct { font-size: 11px; color: var(--text); min-width: 38px; text-align: right; }

  /* ── Recent requests ── */
  .req-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; max-height: 260px; }
  .req-item {
    display: grid; grid-template-columns: 60px 1fr auto auto;
    gap: 10px; align-items: center;
    padding: 7px 10px; border-radius: 5px;
    background: rgba(26,42,69,0.3);
    font-size: 11px;
    border-left: 2px solid transparent;
    transition: background .15s;
  }
  .req-item:hover { background: rgba(26,42,69,0.6); }
  .req-item.success { border-left-color: var(--green); }
  .req-item.failure { border-left-color: var(--red); }
  .req-status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .req-status.success { color: var(--green); }
  .req-status.failure { color: var(--red); }
  .req-model { color: var(--cyan); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .req-latency { color: var(--muted); text-align: right; }
  .req-time { color: var(--muted); font-size: 10px; text-align: right; }

  /* ── Blacklist ── */
  .bl-list { display: flex; flex-direction: column; gap: 6px; }
  .bl-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 10px; border-radius: 5px;
    background: rgba(255,71,87,0.08); border: 1px solid rgba(255,71,87,0.2);
  }
  .bl-model { color: var(--red); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bl-timer { font-size: 10px; color: var(--orange); white-space: nowrap; }
  .bl-empty { color: var(--muted); font-size: 11px; text-align: center; padding: 16px 0; }

  /* ── Category bars ── */
  .cat-list { display: flex; flex-direction: column; gap: 10px; }
  .cat-row { display: flex; flex-direction: column; gap: 4px; }
  .cat-header { display: flex; justify-content: space-between; }
  .cat-name { color: var(--text); font-size: 11px; text-transform: capitalize; }
  .cat-count { color: var(--muted); font-size: 10px; }
  .cat-bar { height: 5px; border-radius: 3px; background: var(--border); overflow: hidden; }
  .cat-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--cyan-dim), var(--cyan)); transition: width .6s ease; }

  /* ── Empty / error ── */
  .empty { color: var(--muted); font-size: 11px; text-align: center; padding: 24px 0; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
</style>
</head>
<body>
<header>
  <div class="logo">SWITCH <span>AI</span> &nbsp;·&nbsp; OPS CENTER</div>
  <div class="live-badge"><div class="live-dot"></div> LIVE</div>
  <div id="clock">--:--:--</div>
</header>

<main>
  <!-- Stat cards -->
  <div class="stats-row" id="stats-row">
    ${['TOTAL REQUESTS','SUCCESS RATE','AVG LATENCY','TOTAL COST'].map(l => `
    <div class="stat-card">
      <div class="stat-label">${l}</div>
      <div class="stat-value" id="stat-${l.replace(/ /g,'_')}">—</div>
      <div class="stat-sub" id="sub-${l.replace(/ /g,'_')}">loading...</div>
    </div>`).join('')}
  </div>

  <!-- Activity + Models -->
  <div class="row-2">
    <div class="panel">
      <div class="panel-title">Requests · Last 24h</div>
      <div class="bar-chart" id="activity-chart"><div class="empty">loading...</div></div>
    </div>
    <div class="panel">
      <div class="panel-title">Model Performance</div>
      <table class="model-table">
        <thead><tr>
          <th>Model</th>
          <th>Success</th>
          <th>Lat ms</th>
        </tr></thead>
        <tbody id="model-tbody"><tr><td colspan="3" class="empty">loading...</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Requests + Blacklist + Categories -->
  <div class="row-3">
    <div class="panel" style="grid-column: span 1;">
      <div class="panel-title">Recent Requests</div>
      <div class="req-list" id="req-list"><div class="empty">loading...</div></div>
    </div>
    <div class="panel">
      <div class="panel-title">Blacklisted Models</div>
      <div class="bl-list" id="bl-list"><div class="empty">loading...</div></div>
    </div>
    <div class="panel">
      <div class="panel-title">Categories</div>
      <div class="cat-list" id="cat-list"><div class="empty">loading...</div></div>
    </div>
  </div>
</main>

<script>
// Clock
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function refreshStats() {
  const data = await fetchJSON('/api/stats');
  if (!data) return;
  const map = {
    'TOTAL_REQUESTS':    [data.totalRequests, 0, '', ''],
    'SUCCESS_RATE':      [data.successRate, 1, '', '%'],
    'AVG_LATENCY':       [data.avgLatencyMs, 0, '', 'ms'],
    'TOTAL_COST':        [data.totalCost, 4, '$', ''],
  };
  for (const [key, [val, dec, pre, suf]] of Object.entries(map)) {
    const el = document.getElementById('stat-' + key);
    if (el) el.textContent = pre + Number(val).toFixed(dec) + suf;
  }
  document.getElementById('sub-TOTAL_REQUESTS').textContent = data.requestsPerMinute + ' req/min now';
  document.getElementById('sub-SUCCESS_RATE').textContent = data.totalRequests + ' total';
  document.getElementById('sub-AVG_LATENCY').textContent   = 'across all models';
  document.getElementById('sub-TOTAL_COST').textContent    = '\$' + data.avgCostPerRequest.toFixed(5) + ' avg/req';
}

async function refreshActivity() {
  const data = await fetchJSON('/api/activity');
  const el = document.getElementById('activity-chart');
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
  const max = Math.max(...data.map(d => d.count), 1);
  el.innerHTML = data.map(d => {
    const h = Math.max(4, Math.round((d.count / max) * 76));
    return \`<div class="bar-wrap">
      <div class="bar" style="height:\${h}px" title="\${d.hour}: \${d.count} req"></div>
      <div class="bar-label">\${d.hour.slice(0,2)}</div>
    </div>\`;
  }).join('');
}

async function refreshModels() {
  const data = await fetchJSON('/api/models');
  const tbody = document.getElementById('model-tbody');
  if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="empty">No data yet</td></tr>'; return; }
  tbody.innerHTML = data.slice(0, 10).map(m => {
    const rate = (m.success_rate ?? 0) * 100;
    const cls = rate >= 80 ? '' : rate >= 50 ? 'med' : 'low';
    const short = m.model.split('/').pop() || m.model;
    return \`<tr>
      <td><div class="model-name" title="\${m.model}">\${short}</div></td>
      <td><div class="rate-bar-wrap">
        <div class="rate-bar"><div class="rate-fill \${cls}" style="width:\${rate.toFixed(0)}%"></div></div>
        <span class="pct">\${rate.toFixed(0)}%</span>
      </div></td>
      <td style="color:var(--muted)">\${m.avg_latency_ms ? Math.round(m.avg_latency_ms) : '—'}</td>
    </tr>\`;
  }).join('');
}

async function refreshRequests() {
  const data = await fetchJSON('/api/requests?limit=20');
  const el = document.getElementById('req-list');
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty">No requests yet</div>'; return; }
  el.innerHTML = data.map(r => {
    const model = (r.final_model || '—').split('/').pop();
    const lat = r.latency_ms ? r.latency_ms + 'ms' : '—';
    const t = r.timestamp ? r.timestamp.slice(11,19) : '';
    return \`<div class="req-item \${r.status}">
      <span class="req-status \${r.status}">\${r.status}</span>
      <span class="req-model">\${model}</span>
      <span class="req-latency">\${lat}</span>
      <span class="req-time">\${t}</span>
    </div>\`;
  }).join('');
}

async function refreshBlacklist() {
  const data = await fetchJSON('/api/blacklist');
  const el = document.getElementById('bl-list');
  if (!data || data.length === 0) { el.innerHTML = '<div class="bl-empty">No active blacklists</div>'; return; }
  el.innerHTML = data.map(b => {
    const until = b.blacklist_until ? new Date(b.blacklist_until).toLocaleTimeString('en-GB', { hour12: false }) : '?';
    const model = (b.model || '').split('/').pop();
    return \`<div class="bl-item">
      <span class="bl-model" title="\${b.model}">\${model}</span>
      <span class="bl-timer">until \${until}</span>
    </div>\`;
  }).join('');
}

async function refreshCategories() {
  const data = await fetchJSON('/api/categories');
  const el = document.getElementById('cat-list');
  if (!data || data.length === 0) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
  const max = Math.max(...data.map(d => d.count), 1);
  el.innerHTML = data.map(d => {
    const w = Math.round((d.count / max) * 100);
    return \`<div class="cat-row">
      <div class="cat-header">
        <span class="cat-name">\${d.category}</span>
        <span class="cat-count">\${d.count}</span>
      </div>
      <div class="cat-bar"><div class="cat-fill" style="width:\${w}%"></div></div>
    </div>\`;
  }).join('');
}

async function refresh() {
  await Promise.all([
    refreshStats(),
    refreshActivity(),
    refreshModels(),
    refreshRequests(),
    refreshBlacklist(),
    refreshCategories(),
  ]);
}

refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
}
