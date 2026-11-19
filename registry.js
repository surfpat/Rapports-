/* =====================================================================
   FIREWISE EQUIPMENT CARE — registry.js
   Vue registre (maître-détail) : sites > bâtiments > matériel
===================================================================== */

/* ---------- 8. Vue : Registre (maître-détail) ---------- */
function renderRegistry(v){
  const sites = state.sites;
  if(!sites.length){
    v.innerHTML = `
      <div class="view-head"><div><h1>Sites & matériel</h1><div class="sub">Aucun site enregistré</div></div>
      <div class="view-actions"><button class="btn primary" id="regAddSite">Nouveau site</button></div></div>
      <div class="panel"><div class="empty"><b>Aucun site</b><p>Créez un site pour y rattacher vos bâtiments et votre matériel SSI.</p></div></div>`;
    v.querySelector('#regAddSite').onclick = () => openSiteForm();
    return;
  }
  if(!state.sites.find(s => s.id === ui.siteId)){ ui.siteId = sites[0].id; ui.buildingId = null; }
  const site = sites.find(s => s.id === ui.siteId);
  const blds = state.buildings.filter(b => b.siteId === site.id);
  if(ui.buildingId && !blds.find(b => b.id === ui.buildingId)) ui.buildingId = null;

  let eq = state.equipment.filter(e => e.siteId === site.id);
  if(ui.buildingId) eq = eq.filter(e => e.buildingId === ui.buildingId);
  const q = ui.q.trim().toLowerCase();
  if(q) eq = eq.filter(e => [typeLabel(e.type), e.brand, e.model, e.serial, e.loc]
    .some(x => String(x||'').toLowerCase().includes(q)));

  const siteBld = b => state.buildings.find(x => x.id === b.buildingId);

  v.innerHTML = `
    <div class="view-head">
      <div><h1>Sites & matériel</h1><div class="sub">${state.sites.length} site(s) · ${state.equipment.length} matériel(s) SSI · ${state.catalog.length} marque(s) au catalogue</div></div>
      <div class="view-actions"><button class="btn" id="regAddSite">Nouveau site</button><button class="btn primary" id="regAddEq">Ajouter du matériel</button></div>
    </div>
    <div class="reg">
      <div class="reg-side">
        ${sites.map(s => `
          <button class="site-item ${s.id===site.id?'active':''}" data-sel-site="${s.id}">
            <div class="t1">${esc(s.name)}</div>
            <div class="t2">${esc(s.city||'')} · ${state.buildings.filter(b=>b.siteId===s.id).length} bât. · ${state.equipment.filter(e=>e.siteId===s.id).length} matériel(s)</div>
          </button>`).join('')}
        ${blds.length ? `<div class="bld-list"><div class="cap">Bâtiments — ${esc(site.name)}</div>
          <button class="bld-item ${!ui.buildingId?'active':''}" data-sel-bld=""><span>Tout le site</span><span class="n">${state.equipment.filter(e=>e.siteId===site.id).length}</span></button>
          ${blds.map(b => `
            <button class="bld-item ${ui.buildingId===b.id?'active':''}" data-sel-bld="${b.id}">
              <span>${esc(b.name)}</span><span class="n">${state.equipment.filter(e=>e.buildingId===b.id).length}</span>
            </button>`).join('')}
        </div>` : ''}
      </div>
      <div>
        <div class="site-head">
          <div>
            <h2>${esc(site.name)}</h2>
            <div class="meta">${esc([site.address, [site.zip, site.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Adresse non renseignée')}
            ${site.contact ? ` · Contact : ${esc(site.contact)}${site.phone ? ' (' + esc(site.phone) + ')' : ''}` : ''}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn" id="regEditSite">Modifier</button>
            <button class="btn" id="regAddBld">+ Bâtiment</button>
            <button class="btn danger" id="regDelSite">Supprimer</button>
          </div>
        </div>
        <div class="toolbar">
          ${ui.buildingId ? `<span class="chip">Bâtiment : ${esc((blds.find(b=>b.id===ui.buildingId)||{}).name||'')}<button id="chipClear" title="Retirer le filtre">×</button></span>` : ''}
          <input type="search" id="regQ" placeholder="Rechercher (type, marque, n° série…)" value="${esc(ui.q)}">
        </div>
        <div class="tblwrap"><table class="tbl">
          <thead><tr><th style="width:52px">Ph.</th><th>Type</th><th>Désignation</th><th>N° série</th><th>Localisation</th><th>Bâtiment</th><th>M.E.S.</th><th>État</th><th style="width:120px"></th></tr></thead>
          <tbody>
            ${eq.length ? eq.map(e => `
              <tr>
                <td>${e.photo
                  ? `<img src="${e.photo}" alt="" style="width:38px;height:29px;object-fit:cover;border-radius:3px;border:1px solid var(--line-2);display:block">`
                  : '<span class="dim">—</span>'}</td>
                <td>${esc(typeLabel(e.type))}</td>
                <td><b>${esc(e.brand||'—')}</b><div class="dim">${esc(e.model||'')}</div></td>
                <td class="mono">${esc(e.serial||'—')}</td>
                <td>${esc(e.loc||'—')}</td>
                <td class="dim">${esc((siteBld(e)||{}).name||'—')}</td>
                <td class="mono">${fmtDate(e.mes)}</td>
                <td>${statusBadge(e.status)}</td>
                <td><div style="display:flex;gap:6px;justify-content:flex-end">
                  <button class="mini" data-edit-eq="${e.id}">Modifier</button>
                  <button class="mini del" data-del-eq="${e.id}">Suppr.</button>
                </div></td>
              </tr>`).join('')
            : `<tr><td colspan="9"><div class="empty" style="padding:26px"><b>Aucun matériel${q||ui.buildingId ? ' ne correspond' : ''}</b><p>${q||ui.buildingId ? 'Ajustez la recherche ou le filtre de bâtiment.' : 'Ajoutez le premier équipement SSI de ce site.'}</p></div></td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>`;

  v.querySelector('#regAddSite').onclick = () => openSiteForm();
  v.querySelector('#regAddEq').onclick = () => openEquipmentForm();
  v.querySelector('#regEditSite').onclick = () => openSiteForm(site.id);
  v.querySelector('#regAddBld').onclick = () => openBuildingForm(site.id);
  v.querySelector('#regDelSite').onclick = () => {
    const n = state.buildings.filter(b => b.siteId === site.id).length + state.equipment.filter(e => e.siteId === site.id).length;
    confirmBox('Supprimer le site', `Supprimer <b>« ${esc(site.name)} »</b> ainsi que ses ${n} élément(s) rattaché(s) ?<br>Les rapports déjà créés seront conservés.`, () => {
      state.buildings = state.buildings.filter(b => b.siteId !== site.id);
      state.equipment = state.equipment.filter(e => e.siteId !== site.id);
      state.sites = state.sites.filter(s => s.id !== site.id);
      ui.siteId = null; ui.buildingId = null; save(); render();
      toast('Site supprimé.', true);
    });
  };
  const qInput = v.querySelector('#regQ');
  qInput.oninput = () => { ui.q = qInput.value; renderRegistry(v);
    const nq = v.querySelector('#regQ'); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); };
  const chip = v.querySelector('#chipClear'); if(chip) chip.onclick = () => { ui.buildingId = null; render(); };
  v.querySelectorAll('[data-sel-site]').forEach(b => b.onclick = () => go('registry', { siteId:b.dataset.selSite, buildingId:null }));
  v.querySelectorAll('[data-sel-bld]').forEach(b => b.onclick = () => { ui.buildingId = b.dataset.selBld || null; render(); });
  v.querySelectorAll('[data-edit-eq]').forEach(b => b.onclick = () => openEquipmentForm(b.dataset.editEq));
  v.querySelectorAll('[data-del-eq]').forEach(b => b.onclick = () => {
    const e = state.equipment.find(x => x.id === b.dataset.delEq);
    confirmBox('Supprimer le matériel', `Supprimer <b>${esc(typeLabel(e.type))} — ${esc(e.brand||'')} ${esc(e.model||'')}</b> (NS ${esc(e.serial||'—')}) ?`, () => {
      state.equipment = state.equipment.filter(x => x.id !== e.id); save(); render();
      toast('Matériel supprimé.', true);
    });
  });
}

/* ===== FIN DE registry.js ===== */