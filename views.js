/* =====================================================================
   FIREWISE EQUIPMENT CARE — views.js
   Navigation, routage et tableau de bord
===================================================================== */

/* ---------- 6. Navigation ---------- */
const NAV = [
  ['dashboard','Registre général','<rect x="2.5" y="3.5" width="11" height="9" rx="1"/><path d="M2.5 7h11M6.5 7v5.5"/>'],
  ['registry','Sites & matériel','<path d="M4 13V4h8v9M2.5 13h11M6 6.5h1.5M9 6.5h1.5M6 9h1.5M9 9h1.5M7.5 13v-2h1v2"/>'],
  ['reports','Rapports','<path d="M5 2.5h6l2.5 2.5v8.5H5zM11 2.5V5h2.5M7 7.5h4M7 10h4"/>'],
  ['settings','Réglages','<path d="M3 5h10M3 10.5h10"/><circle cx="7" cy="5" r="1.7"/><circle cx="10" cy="10.5" r="1.7"/>'],
];

function renderNav(){
  const cur = ui.view === 'report' ? 'reports' : ui.view;
  document.getElementById('nav').innerHTML = NAV.map(([id,label,icon]) => `
    <button class="nav-item ${cur===id?'active':''}" data-nav="${id}">
      <svg viewBox="0 0 16 16">${icon}</svg>${label}
      ${id==='reports' && state.reports.length ? `<span class="nav-count">${state.reports.length}</span>` : ''}
    </button>`).join('');
  document.getElementById('nav').querySelectorAll('[data-nav]').forEach(b => {
    b.onclick = () => go(b.dataset.nav);
  });
}

function go(view, opts = {}){
  ui.view = view;
  if('siteId' in opts) ui.siteId = opts.siteId;
  if('buildingId' in opts) ui.buildingId = opts.buildingId;
  if('reportId' in opts) ui.reportId = opts.reportId;
  render();
}

function render(){
  renderNav();
  const v = document.getElementById('view');
  if(ui.view === 'dashboard') renderDashboard(v);
  else if(ui.view === 'registry') renderRegistry(v);
  else if(ui.view === 'reports') renderReports(v);
  else if(ui.view === 'report') renderReportDetail(v);
  else if(ui.view === 'settings') renderSettings(v);
}

/* ---------- 7. Vue : Tableau de bord ---------- */
function renderDashboard(v){
  const hs = state.equipment.filter(e => e.status === 'hs');
  const byType = {};
  state.equipment.forEach(e => { const l = typeLabel(e.type); byType[l] = (byType[l]||0)+1; });
  const typeRows = Object.entries(byType).sort((a,b) => b[1]-a[1]).slice(0,6);
  const stCounts = { service:0, verif:0, hs:0 };
  state.equipment.forEach(e => stCounts[e.status] = (stCounts[e.status]||0)+1);
  const lastReports = [...state.reports].sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.createdAt||0)-(a.createdAt||0)).slice(0,6);
  const maxT = typeRows.length ? typeRows[0][1] : 1;

  const hasData = state.sites.length || state.reports.length;
  v.innerHTML = `
    <div class="view-head">
      <div><h1>Registre général</h1><div class="sub">Vue du ${fmtDate(todayISO())} — parc SSI et interventions récentes</div></div>
      <div class="view-actions">
        ${state.sites.length ? `<button class="btn" id="dashEq">Ajouter du matériel</button>` : ''}
        <button class="btn primary" id="dashRep">Nouveau rapport</button>
      </div>
    </div>
    ${!hasData ? `
      <div class="panel"><div class="empty">
        <b>Bienvenue dans Firewise Equipment Care</b>
        <p>Commencez par créer votre premier site, puis ajoutez vos bâtiments et le matériel SSI associé.<br>Un jeu de démonstration est également disponible dans les Réglages.</p>
        <button class="btn primary" id="dashSite">Créer un premier site</button>
      </div></div>` : `
    <div class="statline">
      <div class="stat"><b>${state.sites.length}</b><span>Sites</span></div>
      <div class="stat"><b>${state.buildings.length}</b><span>Bâtiments</span></div>
      <div class="stat"><b>${state.equipment.length}</b><span>Matériel SSI</span></div>
      <div class="stat hl"><b>${hs.length}</b><span>Hors service</span></div>
      <div class="stat"><b>${state.reports.length}</b><span>Rapports</span></div>
    </div>
    <div class="dash-grid">
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="panel">
          <div class="panel-h"><h2>Derniers rapports</h2><button class="mini" id="dashAll">Tout voir</button></div>
          <div class="panel-b">
            ${lastReports.length ? lastReports.map(r => `
              <div class="line-row">
                <div class="grow">
                  <div class="t1"><span style="color:var(--accent);font-weight:650">${esc(r.no)}</span> — ${esc(REPORT_TYPES[r.type]||'')}</div>
                  <div class="t2">${esc(r.siteName||'')}${r.equipmentDesc ? ' · ' + esc(r.equipmentDesc) : ''}</div>
                </div>
                <div class="r"><div class="t1" style="font-size:13px">${fmtDate(r.date)}</div><button class="mini" data-open-r="${r.id}">Ouvrir</button></div>
              </div>`).join('') : `<div class="empty" style="padding:20px"><p>Aucun rapport enregistré pour le moment.</p></div>`}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h2>Matériel hors service</h2></div>
          <div class="panel-b">
            ${hs.length ? hs.map(e => {
              const s = state.sites.find(x => x.id === e.siteId), b = state.buildings.find(x => x.id === e.buildingId);
              return `<div class="line-row">
                <div class="grow"><div class="t1">${esc(typeLabel(e.type))} <span style="color:var(--ink-3);font-weight:400">— ${esc(e.brand||'')} ${esc(e.model||'')}</span></div>
                <div class="t2">${esc(s ? s.name : '')} · ${esc(b ? b.name : '')} · ${esc(e.loc||'')}</div></div>
                <button class="mini" data-goto-reg="${e.siteId}">Voir</button>
              </div>`;}).join('') : `<div class="empty" style="padding:20px"><p>Aucun matériel hors service.</p></div>`}
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="panel">
          <div class="panel-h"><h2>Répartition par état</h2></div>
          <div class="panel-b" style="padding-top:10px">
            ${['service','verif','hs'].map(s => `
              <div class="hbar"><span class="lab">${STATUS[s]}</span>
                <div class="track"><div class="fill ${s==='service'?'ok':s==='verif'?'warn':'bad'}" style="width:${state.equipment.length ? Math.round(stCounts[s]/state.equipment.length*100) : 0}%"></div></div>
                <span class="n">${stCounts[s]||0}</span></div>`).join('')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h2>Par type de matériel</h2></div>
          <div class="panel-b" style="padding-top:10px">
            ${typeRows.length ? typeRows.map(([l,n]) => `
              <div class="hbar"><span class="lab" title="${esc(l)}">${esc(l)}</span>
                <div class="track"><div class="fill" style="width:${Math.round(n/maxT*100)}%"></div></div>
                <span class="n">${n}</span></div>`).join('') : `<div class="empty" style="padding:16px"><p>Aucun matériel enregistré.</p></div>`}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h2>Dernier matériel ajouté</h2></div>
          <div class="panel-b">
            ${[...state.equipment].slice(-4).reverse().map(e => `
              <div class="line-row"><div class="grow"><div class="t1">${esc(typeLabel(e.type))}</div>
              <div class="t2">${esc(e.brand||'')} ${esc(e.model||'')} · ${esc(e.loc||'—')}</div></div>${statusBadge(e.status)}</div>`).join('')
              || `<div class="empty" style="padding:16px"><p>—</p></div>`}
          </div>
        </div>
      </div>
    </div>`}
  `;
  const bind = (id, fn) => { const el = v.querySelector(id); if(el) el.onclick = fn; };
  bind('#dashRep', () => openReportForm());
  bind('#dashSite', () => openSiteForm());
  bind('#dashEq', () => openEquipmentForm());
  bind('#dashAll', () => go('reports'));
  v.querySelectorAll('[data-open-r]').forEach(b => b.onclick = () => go('report', { reportId:b.dataset.openR }));
  v.querySelectorAll('[data-goto-reg]').forEach(b => b.onclick = () => go('registry', { siteId:b.dataset.gotoReg, buildingId:null }));
}

/* ===== FIN DE views.js ===== */