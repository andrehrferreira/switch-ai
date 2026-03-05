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

  /* -- Topbar -- */
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

  /* -- Layout -- */
  .layout { display: flex; min-height: calc(100vh - 56px); }

  /* -- Sidebar -- */
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

  /* -- Main -- */
  main { flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }

  /* -- Page header -- */
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; }
  .page-title { font-size: 20px; font-weight: 600; color: #fff; }
  .page-sub { font-size: 13px; color: var(--text2); margin-top: 3px; }
  .controls { display: flex; gap: 8px; align-items: center; }
  .refresh-btn, .debug-btn, .export-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 6px; border: 1px solid var(--border2);
    background: var(--surface2); color: var(--text2);
    font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer;
    transition: all .15s;
  }
  .refresh-btn:hover { border-color: var(--green); color: var(--green); }
  .debug-btn:hover { border-color: var(--orange); color: var(--orange); }
  .debug-btn.active { border-color: var(--orange); color: var(--orange); background: rgba(251,146,60,0.08); }
  .export-btn:hover { border-color: var(--green); color: var(--green); }
  .backend-select {
    padding: 7px 12px; border-radius: 6px; border: 1px solid var(--border2);
    background: var(--surface2); color: var(--text2);
    font-family: 'DM Mono', monospace; font-size: 12px; cursor: pointer;
    transition: all .15s; outline: none; appearance: none;
    -webkit-appearance: none; -moz-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23606060'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    padding-right: 28px;
  }
  .backend-select:hover { border-color: var(--green); color: var(--green); }
  .backend-select.forced { border-color: var(--green); color: var(--green); background-color: var(--green-bg); }
  .backend-label { font-size: 11px; color: var(--muted); font-weight: 500; }

  /* -- Stats grid -- */
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

  /* -- Row layouts -- */
  .row-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
  .row-3 { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 12px; }

  /* -- Card -- */
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

  /* -- Backends -- */
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

  /* -- Activity chart -- */
  .chart { display: flex; align-items: flex-end; gap: 3px; height: 72px; }
  .bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 3px; height: 100%; justify-content: flex-end; }
  .bar-fill {
    width: 100%; border-radius: 2px 2px 0 0; min-height: 2px;
    background: var(--green-dim); transition: background .15s;
  }
  .bar-fill:hover { background: var(--green); }
  .bar-lbl { font-family: 'DM Mono', monospace; font-size: 9px; color: var(--muted); }

  /* -- Table -- */
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

  /* -- Request list (dashboard compact) -- */
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

  /* -- Blacklist -- */
  .bl-list { display: flex; flex-direction: column; gap: 6px; }
  .bl-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; border-radius: 6px;
    background: var(--red-bg); border: 1px solid rgba(248,113,113,.15);
  }
  .bl-name { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--red); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px; }
  .bl-until { font-size: 10px; color: var(--muted); white-space: nowrap; }

  /* -- Categories -- */
  .cat-list { display: flex; flex-direction: column; gap: 10px; }
  .cat-row { display: flex; flex-direction: column; gap: 5px; }
  .cat-meta { display: flex; justify-content: space-between; font-size: 12px; }
  .cat-name { color: var(--text); text-transform: capitalize; }
  .cat-stat { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); }
  .cat-track { height: 3px; border-radius: 2px; background: var(--border2); overflow: hidden; }
  .cat-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--green-dim), var(--green)); }

  /* -- View sections -- */
  .view-section { display: none; flex-direction: column; gap: 20px; width: 100%; }
  .view-section.active { display: flex; }

  /* -- Filters bar (requests view) -- */
  .filters-bar {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    padding: 14px 18px; border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .filter-input, .filter-select {
    padding: 7px 12px; border-radius: 6px; border: 1px solid var(--border2);
    background: var(--surface2); color: var(--text);
    font-family: 'DM Mono', monospace; font-size: 12px; outline: none;
    transition: border-color .15s;
  }
  .filter-input:focus, .filter-select:focus { border-color: var(--green); }
  .filter-input { width: 200px; }
  .filter-input::placeholder { color: var(--muted); }
  .filter-select {
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23606060'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    padding-right: 28px; cursor: pointer;
  }
  .filter-label { font-size: 11px; color: var(--muted); font-weight: 500; }

  /* -- Full requests table -- */
  .full-req-table { width: 100%; border-collapse: collapse; }
  .full-req-table th {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--muted); text-align: left;
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .full-req-table td {
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    font-size: 12px; color: var(--text2); vertical-align: middle;
  }
  .full-req-table tr:hover td { background: var(--surface2); }
  .full-req-table .mono {
    font-family: 'DM Mono', monospace; font-size: 11px;
  }

  /* -- Pagination -- */
  .pagination {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-top: 1px solid var(--border);
  }
  .pagination-info { font-size: 12px; color: var(--muted); font-family: 'DM Mono', monospace; }
  .pagination-btns { display: flex; gap: 6px; }
  .page-btn {
    padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border2);
    background: var(--surface2); color: var(--text2);
    font-family: 'DM Sans', sans-serif; font-size: 12px; cursor: pointer;
    transition: all .15s;
  }
  .page-btn:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
  .page-btn:disabled { opacity: .3; cursor: default; }

  /* -- Misc -- */
  .empty { color: var(--muted); font-size: 12px; text-align: center; padding: 20px 0; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  /* -- Responsive -- */
  @media (max-width: 1100px) {
    .row-3 { grid-template-columns: 1fr; }
    .row-2 { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    aside { display: none; }
    main { padding: 16px; }
    .stats-grid { grid-template-columns: 1fr 1fr; }
    header { padding: 0 12px; }
    .controls { flex-wrap: wrap; }
    .filters-bar { flex-direction: column; align-items: stretch; }
    .filter-input { width: 100%; }
    .full-req-table th:nth-child(n+5), .full-req-table td:nth-child(n+5) { display: none; }
  }
  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: 1fr; }
    .page-header { flex-direction: column; gap: 12px; }
  }
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
    <span class="header-title" id="header-title">Operations</span>
  </div>
  <div class="header-right">
    <span class="backend-label">Backend:</span>
    <select class="backend-select" id="backend-select" onchange="changeBackend(this.value)">
      <option value="auto">auto</option>
      <option value="claude-cli">claude-cli</option>
      <option value="gemini-cli">gemini-cli</option>
      <option value="cursor-cli">cursor-agent</option>
      <option value="gemini-api">gemini-api</option>
      <option value="openrouter">openrouter</option>
    </select>
    <div class="header-divider"></div>
    <div class="live-chip"><div class="live-dot"></div> LIVE</div>
    <div id="clock">--:--:--</div>
  </div>
</header>

<div class="layout">
  <aside>
    <div class="aside-section"><div class="aside-label">Overview</div></div>
    <a class="nav-item active" data-view="dashboard" href="javascript:void(0)" onclick="switchView('dashboard')"><span class="nav-icon">&#9672;</span> Dashboard</a>
    <div class="aside-section" style="margin-top:6px"><div class="aside-label">Data</div></div>
    <a class="nav-item" data-view="requests" href="javascript:void(0)" onclick="switchView('requests')"><span class="nav-icon">&#10227;</span> Requests</a>
    <a class="nav-item" data-view="models" href="javascript:void(0)" onclick="switchView('models')"><span class="nav-icon">&#9671;</span> Models</a>
    <a class="nav-item" data-view="blacklist" href="javascript:void(0)" onclick="switchView('blacklist')"><span class="nav-icon">&#8856;</span> Blacklist</a>
    <div class="aside-section" style="margin-top:6px"><div class="aside-label">System</div></div>
    <a class="nav-item" data-view="backends" href="javascript:void(0)" onclick="switchView('backends')"><span class="nav-icon">&#9881;</span> Backends</a>
  </aside>

  <main>
    <div class="page-header">
      <div>
        <div class="page-title" id="page-title">Dashboard</div>
        <div class="page-sub" id="page-sub">Proxy telemetry &middot; auto-refreshes every 5s</div>
      </div>
      <div class="controls">
        <button class="refresh-btn" onclick="refresh()">&#8634; Refresh</button>
      </div>
    </div>

    <!-- ======== DASHBOARD VIEW ======== -->
    <div class="view-section active" id="view-dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header"><span class="stat-label">Total Requests</span><span class="stat-icon">&#9672;</span></div>
          <div class="stat-value" id="sv-total">&mdash;</div>
          <div class="stat-footer" id="sf-total">loading...</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-label">Success Rate</span><span class="stat-icon">&#10003;</span></div>
          <div class="stat-value green" id="sv-rate">&mdash;</div>
          <div class="stat-footer" id="sf-rate">loading...</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-label">Avg Latency</span><span class="stat-icon">&#9719;</span></div>
          <div class="stat-value" id="sv-lat">&mdash;</div>
          <div class="stat-footer" id="sf-lat">loading...</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-label">Total Cost</span><span class="stat-icon">$</span></div>
          <div class="stat-value" id="sv-cost">&mdash;</div>
          <div class="stat-footer" id="sf-cost">loading...</div>
        </div>
      </div>

      <div class="row-2">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Activity &middot; Last 24h</span>
            <span class="card-badge" id="activity-total">&mdash; req</span>
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
    </div>

    <!-- ======== REQUESTS VIEW ======== -->
    <div class="view-section" id="view-requests">
      <div class="card" style="overflow:visible;">
        <div class="filters-bar">
          <input class="filter-input" id="f-search" type="text" placeholder="Search requests..." oninput="debouncedReqSearch()">
          <select class="filter-select" id="f-model" onchange="loadFullRequests(0)">
            <option value="">All models</option>
          </select>
          <select class="filter-select" id="f-status" onchange="loadFullRequests(0)">
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
          <span class="filter-label">From:</span>
          <input class="filter-input" id="f-from" type="datetime-local" style="width:auto;" onchange="loadFullRequests(0)">
          <span class="filter-label">To:</span>
          <input class="filter-input" id="f-to" type="datetime-local" style="width:auto;" onchange="loadFullRequests(0)">
          <button class="export-btn" onclick="exportRequests('csv')">&#8615; CSV</button>
          <button class="export-btn" onclick="exportRequests('json')">&#8615; JSON</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="full-req-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Model</th>
                <th>Category</th>
                <th>Latency</th>
                <th>Cost</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody id="full-req-tbody">
              <tr><td colspan="6" class="empty">loading...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <span class="pagination-info" id="req-pagination-info">—</span>
          <div class="pagination-btns">
            <button class="page-btn" id="req-prev" onclick="reqPagePrev()" disabled>&#8592; Prev</button>
            <button class="page-btn" id="req-next" onclick="reqPageNext()">Next &#8594;</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ======== MODELS VIEW ======== -->
    <div class="view-section" id="view-models">
      <div class="card">
        <div class="card-header">
          <span class="card-title">All Model Performance</span>
          <span class="card-badge" id="models-count">—</span>
        </div>
        <div class="card-body">
          <table class="data-table" style="width:100%;">
            <thead>
              <tr>
                <th>Model</th>
                <th>Category</th>
                <th>Success Rate</th>
                <th>Avg Latency</th>
                <th>Avg Cost</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody id="full-model-tbody">
              <tr><td colspan="6" class="empty">loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ======== BLACKLIST VIEW ======== -->
    <div class="view-section" id="view-blacklist">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Active Model Blocks</span>
          <span class="card-badge" id="bl-count">—</span>
        </div>
        <div class="card-body">
          <div id="full-bl-list"><div class="empty">loading...</div></div>
        </div>
      </div>
    </div>

    <!-- ======== BACKENDS VIEW ======== -->
    <div class="view-section" id="view-backends">
      <div class="card">
        <div class="card-header">
          <span class="card-title">All Backends</span>
          <span class="card-badge" id="full-backends-ok">—</span>
        </div>
        <div class="card-body">
          <div class="backends-grid" id="full-backends-list"><div class="empty">loading...</div></div>
        </div>
      </div>
    </div>
  </main>
</div>

<script>
/* ── State ── */
let currentView = 'dashboard';
let reqOffset = 0;
const reqLimit = 30;
let reqTotal = 0;
let searchTimeout = null;

/* ── Clock ── */
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

/* ── Navigation ── */
const viewTitles = {
  dashboard: ['Dashboard', 'Proxy telemetry \\u00b7 auto-refreshes every 5s'],
  requests: ['Requests', 'Browse, filter and export all proxy requests'],
  models: ['Models', 'Model performance metrics across all categories'],
  blacklist: ['Blacklist', 'Currently blocked models due to repeated failures'],
  backends: ['Backends', 'Backend availability and configuration'],
};

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  const [title, sub] = viewTitles[view] || ['Dashboard', ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent = sub;
  document.getElementById('header-title').textContent = title;
  if (view === 'requests') { loadFullRequests(0); populateModelFilter(); }
  if (view === 'models') loadFullModels();
  if (view === 'blacklist') loadFullBlacklist();
  if (view === 'backends') loadFullBackends();
}

/* ── Fetch helper ── */
async function fetchJSON(url) {
  try { const r = await fetch(url); return r.ok ? r.json() : null; }
  catch { return null; }
}

/* ── Dashboard refreshers ── */
async function refreshStats() {
  const d = await fetchJSON('/api/stats');
  if (!d) return;
  document.getElementById('sv-total').textContent = d.totalRequests;
  document.getElementById('sf-total').textContent = d.requestsPerMinute + ' req/min';
  document.getElementById('sv-rate').textContent  = Number(d.successRate).toFixed(1) + '%';
  document.getElementById('sf-rate').textContent  = d.totalRequests + ' total';
  document.getElementById('sv-lat').textContent   = Math.round(d.avgLatencyMs) + 'ms';
  document.getElementById('sf-lat').textContent   = 'across all backends';
  document.getElementById('sv-cost').textContent  = '\\$' + Number(d.totalCost).toFixed(4);
  document.getElementById('sf-cost').textContent  = '\\$' + Number(d.avgCostPerRequest).toFixed(5) + ' avg/req';
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
  el.innerHTML = renderBackendsList(d);
}

function renderBackendsList(d) {
  return d.map(b => {
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
      <td style="font-family:'DM Mono',monospace">\${m.avg_latency_ms ? Math.round(m.avg_latency_ms) : '\\u2014'}</td>
    </tr>\`;
  }).join('');
}

async function refreshRequests() {
  const d = await fetchJSON('/api/requests?limit=20');
  const el = document.getElementById('req-list');
  if (!d || !d.rows || d.rows.length === 0) { el.innerHTML = '<div class="empty">No requests yet</div>'; return; }
  el.innerHTML = d.rows.map(r => {
    const model = (r.final_model || '\\u2014').split('/').pop();
    const lat = r.latency_ms ? r.latency_ms + 'ms' : '\\u2014';
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
  el.innerHTML = renderBlacklist(d);
}

function renderBlacklist(d) {
  return d.map(b => {
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
        <span class="cat-stat">\${x.count} \\u00b7 \${x.successRate ?? 0}%</span>
      </div>
      <div class="cat-track"><div class="cat-fill" style="width:\${w}%"></div></div>
    </div>\`;
  }).join('');
}

/* ── Dashboard refresh all ── */
async function refresh() {
  if (currentView === 'dashboard') {
    await Promise.all([
      refreshStats(), refreshActivity(), refreshBackends(),
      refreshModels(), refreshRequests(), refreshBlacklist(), refreshCategories(),
    ]);
  } else if (currentView === 'requests') {
    loadFullRequests(reqOffset);
  } else if (currentView === 'models') {
    loadFullModels();
  } else if (currentView === 'blacklist') {
    loadFullBlacklist();
  } else if (currentView === 'backends') {
    loadFullBackends();
  }
}

/* ── Backend select ── */
async function refreshBackendSelect() {
  const d = await fetchJSON('/api/backend');
  if (!d) return;
  const sel = document.getElementById('backend-select');
  sel.value = d.backend;
  sel.className = 'backend-select' + (d.backend !== 'auto' ? ' forced' : '');
}

async function changeBackend(value) {
  try {
    const r = await fetch('/api/backend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backend: value }),
    });
    if (r.ok) await refreshBackendSelect();
  } catch {}
}

/* ── Debug toggle ── */
async function refreshDebug() {
  const d = await fetchJSON('/api/debug');
  if (!d) return;
  const btn = document.getElementById('debug-btn');
  const isDebug = d.level === 'debug';
  btn.textContent = isDebug ? '\\u26a1 Debug: ON' : '\\u26a1 Debug: OFF';
  btn.className = 'debug-btn' + (isDebug ? ' active' : '');
}

async function toggleDebug() {
  try {
    const r = await fetch('/api/debug', { method: 'POST' });
    if (r.ok) await refreshDebug();
  } catch {}
}

/* ── Full Requests View ── */
function getRequestFilters() {
  const params = new URLSearchParams();
  params.set('limit', reqLimit);
  const search = document.getElementById('f-search').value.trim();
  const model = document.getElementById('f-model').value;
  const status = document.getElementById('f-status').value;
  const from = document.getElementById('f-from').value;
  const to = document.getElementById('f-to').value;
  if (search) params.set('search', search);
  if (model) params.set('model', model);
  if (status) params.set('status', status);
  if (from) params.set('from', from.replace('T', ' '));
  if (to) params.set('to', to.replace('T', ' '));
  return params;
}

async function loadFullRequests(offset) {
  reqOffset = offset;
  const params = getRequestFilters();
  params.set('offset', offset);
  const d = await fetchJSON('/api/requests?' + params.toString());
  const tbody = document.getElementById('full-req-tbody');
  if (!d || !d.rows || d.rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No requests found</td></tr>';
    document.getElementById('req-pagination-info').textContent = '0 results';
    document.getElementById('req-prev').disabled = true;
    document.getElementById('req-next').disabled = true;
    return;
  }
  reqTotal = d.total;
  tbody.innerHTML = d.rows.map(r => {
    const model = (r.final_model || '\\u2014').split('/').pop();
    const ts = r.timestamp ? r.timestamp.replace('T', ' ').slice(0, 19) : '';
    const cost = r.cost != null ? '\\$' + Number(r.cost).toFixed(5) : '\\u2014';
    return \`<tr>
      <td><span class="badge \${r.status}">\${r.status === 'success' ? 'OK' : 'ERR'}</span></td>
      <td class="mono" title="\${r.final_model || ''}">\${model}</td>
      <td>\${r.category || '\\u2014'}</td>
      <td class="mono">\${r.latency_ms ? r.latency_ms + 'ms' : '\\u2014'}</td>
      <td class="mono">\${cost}</td>
      <td class="mono">\${ts}</td>
    </tr>\`;
  }).join('');
  const from = offset + 1;
  const to = Math.min(offset + d.rows.length, reqTotal);
  document.getElementById('req-pagination-info').textContent = from + '\\u2013' + to + ' of ' + reqTotal;
  document.getElementById('req-prev').disabled = offset === 0;
  document.getElementById('req-next').disabled = offset + reqLimit >= reqTotal;
}

function reqPagePrev() { if (reqOffset > 0) loadFullRequests(Math.max(0, reqOffset - reqLimit)); }
function reqPageNext() { if (reqOffset + reqLimit < reqTotal) loadFullRequests(reqOffset + reqLimit); }

function debouncedReqSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadFullRequests(0), 300);
}

async function populateModelFilter() {
  const sel = document.getElementById('f-model');
  if (sel.options.length > 1) return;
  const d = await fetchJSON('/api/models');
  if (!d) return;
  const models = [...new Set(d.map(m => m.model))];
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.split('/').pop() || m;
    opt.textContent = m.split('/').pop() || m;
    sel.appendChild(opt);
  });
}

function exportRequests(format) {
  const params = getRequestFilters();
  params.delete('limit');
  params.delete('offset');
  params.set('format', format);
  window.open('/api/requests/export?' + params.toString(), '_blank');
}

/* ── Full Models View ── */
async function loadFullModels() {
  const d = await fetchJSON('/api/models');
  const tbody = document.getElementById('full-model-tbody');
  if (!d || d.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No model data yet</td></tr>';
    document.getElementById('models-count').textContent = '0';
    return;
  }
  document.getElementById('models-count').textContent = d.length + ' models';
  tbody.innerHTML = d.map(m => {
    const rate = (m.success_rate ?? 0) * 100;
    const cls = rate >= 80 ? '' : rate >= 50 ? 'warn' : 'bad';
    const short = m.model.split('/').pop() || m.model;
    return \`<tr>
      <td><span class="model-id" title="\${m.model}">\${short}</span></td>
      <td>\${m.category || '\\u2014'}</td>
      <td><div class="flex-row">
        <div class="progress"><div class="progress-fill \${cls}" style="width:\${rate.toFixed(0)}%"></div></div>
        <span style="font-family:'DM Mono',monospace;font-size:11px;min-width:36px;text-align:right">\${rate.toFixed(1)}%</span>
      </div></td>
      <td class="mono">\${m.avg_latency_ms ? Math.round(m.avg_latency_ms) + 'ms' : '\\u2014'}</td>
      <td class="mono">\${m.avg_cost != null ? '\\$' + Number(m.avg_cost).toFixed(5) : '\\u2014'}</td>
      <td class="mono">\${m.total_requests ?? '\\u2014'}</td>
    </tr>\`;
  }).join('');
}

/* ── Full Blacklist View ── */
async function loadFullBlacklist() {
  const d = await fetchJSON('/api/blacklist');
  const el = document.getElementById('full-bl-list');
  if (!d || d.length === 0) {
    el.innerHTML = '<div class="empty">No active model blocks</div>';
    document.getElementById('bl-count').textContent = '0';
    return;
  }
  document.getElementById('bl-count').textContent = d.length + ' blocked';
  el.innerHTML = '<div class="bl-list">' + renderBlacklist(d) + '</div>';
}

/* ── Full Backends View ── */
async function loadFullBackends() {
  const d = await fetchJSON('/api/backends');
  const el = document.getElementById('full-backends-list');
  if (!d) { el.innerHTML = '<div class="empty">unavailable</div>'; return; }
  const ok = d.filter(b => b.available).length;
  document.getElementById('full-backends-ok').textContent = ok + ' / ' + d.length + ' active';
  el.innerHTML = renderBackendsList(d);
}

/* ── Init ── */
refresh();
refreshDebug();
refreshBackendSelect();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
}
