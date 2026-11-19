/* =====================================================================
   FIREWISE EQUIPMENT CARE — reports.js
   Liste des rapports + feuille de rapport (écran & export) + détail
===================================================================== */

/* ---------- 10. Vue : Liste des rapports ---------- */
function renderReports(v){
  const q = ui.q.trim().toLowerCase();
  let list = [...state.reports].sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.createdAt||0)-(a.createdAt||0));
  if(ui.typeFilter) list = list.filter(r => r.type === ui.typeFilter);
  if(q) list = list.filter(r => [r.no, r.siteName, r.buildingName, r.equipmentDesc, r.tech]
    .some(x => String(x||'').toLowerCase().includes(q)));

  v.innerHTML = `
    <div class="view-head">
      <div><h1>Rapports d’intervention</h1><div class="sub">${state.reports.length} rapport(s) archivé(s) localement</div></div>
      <div class="view-actions"><button class="btn primary" id="repNew">Nouveau rapport</button></div>
    </div>
    <div class="toolbar">
      <input type="search" id="repQ" placeholder="Rechercher (n°, site, technicien…)" value="${esc(ui.q)}">
      <select id="repType" class="mini" style="padding:7px 10px">
        <option value="">Tous les types</option>
        ${Object.entries(REPORT_TYPES).map(([k,l]) => `<option value="${k}" ${ui.typeFilter===k?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="tblwrap"><table class="tbl">
      <thead><tr><th>N°</th><th>Date</th><th>Type</th><th>Objet</th><th>Technicien</th><th>Anomalies</th><th style="width:210px"></th></tr></thead>
      <tbody>
        ${list.length ? list.map(r => `
          <tr>
            <td class="no" data-open-r="${r.id}">${esc(r.no)}</td>
            <td class="mono">${fmtDate(r.date)}</td>
            <td>${esc(REPORT_TYPES[r.type]||r.type)}</td>
            <td>${esc([r.siteName, r.buildingName].filter(Boolean).join(' — ') || '—')}${r.equipmentDesc ? `<div class="dim">${esc(r.equipmentDesc)}</div>` : ''}</td>
            <td>${esc(r.tech||'—')}</td>
            <td>${(r.anomalies||'').trim() ? '<span class="badge bad">Oui</span>' : '<span class="dim">Non</span>'}</td>
            <td><div style="display:flex;gap:6px;justify-content:flex-end">
              <button class="mini" data-open-r="${r.id}">Voir</button>
              <button class="mini" data-pdf-r="${r.id}">PDF</button>
              <button class="mini" data-docx-r="${r.id}">Word</button>
              <button class="mini del" data-del-r="${r.id}">Suppr.</button>
            </div></td>
          </tr>`).join('')
        : `<tr><td colspan="7"><div class="empty" style="padding:30px"><b>Aucun rapport</b><p>${q||ui.typeFilter ? 'Aucun résultat pour ces filtres.' : 'Créez votre premier rapport d’intervention.'}</p></div></td></tr>`}
      </tbody>
    </table></div>`;

  v.querySelector('#repNew').onclick = () => openReportForm();
  const qInput = v.querySelector('#repQ');
  qInput.oninput = () => { ui.q = qInput.value; renderReports(v);
    const nq = v.querySelector('#repQ'); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); };
  v.querySelector('#repType').onchange = e => { ui.typeFilter = e.target.value; renderReports(v); };
  v.querySelectorAll('[data-open-r]').forEach(b => b.onclick = () => go('report', { reportId:b.dataset.openR }));
  v.querySelectorAll('[data-pdf-r]').forEach(b => b.onclick = () => exportPDF(b.dataset.pdfR));
  v.querySelectorAll('[data-docx-r]').forEach(b => b.onclick = () => exportDOCX(b.dataset.docxR));
  v.querySelectorAll('[data-del-r]').forEach(b => b.onclick = () => {
    const r = state.reports.find(x => x.id === b.dataset.delR);
    confirmBox('Supprimer le rapport', `Supprimer définitivement le rapport <b>${esc(r.no)}</b> ?`, () => {
      state.reports = state.reports.filter(x => x.id !== r.id); save(); render();
      toast('Rapport supprimé.', true);
    });
  });
}

/* ---------- 12. Feuille de rapport (réutilisée à l'écran et pour l'export) ---------- */
function reportObjet(r){
  const parts = [r.siteName, r.buildingName, r.equipmentDesc].filter(Boolean);
  return parts.length ? parts.join(' — ') : '—';
}

function reportSheetHTML(r){
  const pieces = (r.pieces || []);
  const tests = (r.tests || []);
  const batteries = (r.batteries || []);
  const resColor = { conforme:'#2e7d4f', surveil:'#a86a08', nonconforme:'#c1272d', remplacer:'#c1272d' };
  const resCell = res => `<td style="color:${resColor[res]||'#333'};font-weight:${res?'600':'400'}">${esc(TEST_RESULTS[res]||BATTERY_RESULTS[res]||'—')}</td>`;
  return `
  <div class="rp">
    <div class="rp-head">
      <div class="rp-brand"><span class="rp-mark"></span>FIREWISE — EQUIPMENT CARE</div>
      <div class="rp-doc">
        <div class="rp-title">RAPPORT D’INTERVENTION SSI</div>
        <div class="rp-no">N° ${esc(r.no)}</div>
      </div>
    </div>
    <table class="rp-meta">
      <tr><th>Type</th><td>${esc(REPORT_TYPES[r.type]||'')}</td><th>Date</th><td>${fmtDate(r.date)}</td><th>Technicien</th><td>${esc(r.tech||'')}</td></tr>
      <tr><th>Objet</th><td colspan="5">${esc(reportObjet(r))}</td></tr>
    </table>
    <div class="rp-sec"><h3>Observations / constat</h3><p>${esc(r.obs) || '—'}</p></div>
    <div class="rp-sec"><h3>Anomalies constatées</h3><p>${esc(r.anomalies) || 'Aucune anomalie relevée.'}</p></div>
    <div class="rp-sec"><h3>Actions réalisées</h3><p>${esc(r.actions) || '—'}</p></div>
    <div class="rp-sec"><h3>Pièces remplacées</h3>
      ${pieces.length ? `<table class="rp-pieces">
        <tr><th>Désignation</th><th>Référence</th><th style="width:60px">Qté</th></tr>
        ${pieces.map(p => `<tr><td>${esc(p.d)}</td><td>${esc(p.r||'—')}</td><td>${esc(p.q||'—')}</td></tr>`).join('')}
      </table>` : '<p>Aucune pièce remplacée.</p>'}
    </div>
    <div class="rp-sec"><h3>Matériel testé</h3>
      ${tests.length ? `<table class="rp-pieces">
        <tr><th>Matériel testé</th><th style="width:90px">Résultat</th><th>Observation</th></tr>
        ${tests.map(t => `<tr><td>${esc(t.label)||'—'}</td>${resCell(t.res)}<td>${esc(t.note)||'—'}</td></tr>`).join('')}
      </table>` : '<p>Aucun matériel testé.</p>'}
    </div>
        <div class="rp-sec"><h3>Mesures batteries</h3>
      ${batteries.length ? `<table class="rp-pieces">
        <tr><th>Matériel</th><th>Batteries</th><th>Charge (U / I)</th><th>Test (I absorbée · U t0 → t+1 h)</th><th>Capacité restante / autonomie</th><th>Résultat</th><th>Observation</th></tr>
        ${batteries.map(b => {
          const chargeTxt = [b.vch ? b.vch + ' V' : '', b.ich ? b.ich + ' A' : ''].filter(Boolean).join(' / ') || '—';
          const batTxt = [b.bat, b.cnom ? b.cnom + ' Ah' : '', b.unom ? b.unom + ' V' : ''].filter(Boolean).join(' · ') || '—';
          const testTxt = [b.iabs ? 'I ' + b.iabs + ' A' : '', (b.ut0 || b.ut1) ? (b.ut0||'?') + ' → ' + (b.ut1||'?') + ' V' : ''].filter(Boolean).join(' · ') || '—';
          const capTxt = [b.cmes ? b.cmes + ' % restant' : '', b.aut ? b.aut + ' h autonomie' : '', b.q1h ? b.q1h + ' Ah consommés (1 h)' : ''].filter(Boolean).join(' · ') || '—';
          return `<tr><td>${esc(b.mat)||'—'}</td><td>${esc(batTxt)}</td><td>${esc(chargeTxt)}</td><td>${esc(testTxt)}</td><td>${esc(capTxt)}</td>${resCell(b.res)}<td>${esc(b.note)||'—'}</td></tr>`;
        }).join('')}
      </table>` : '<p>Aucune mesure de batterie relevée.</p>'}
    </div>
    <div class="rp-sec"><h3>Recommandations</h3><p>${esc(r.reco) || '—'}</p></div>
    <div class="rp-sec"><h3>Prochaine visite</h3><p>${r.nextVisit ? fmtDate(r.nextVisit) : 'Non planifiée.'}</p></div>
    <div class="rp-sigs">
      <div class="rp-sig"><div class="cap">Signature du technicien</div>
        ${r.sigTech ? `<img src="${r.sigTech}" alt="Signature technicien">` : '<span class="none">Non signé</span>'}</div>
      <div class="rp-sig"><div class="cap">Signature du client / représentant</div>
        ${r.sigClient ? `<img src="${r.sigClient}" alt="Signature client">` : '<span class="none">Non signé</span>'}</div>
    </div>
    <div class="rp-foot"><span>Document généré le ${fmtDate(todayISO())} par Firewise Equipment Care</span><span>N° ${esc(r.no)}</span></div>
  </div>`;
}

function renderReportDetail(v){
  const r = state.reports.find(x => x.id === ui.reportId);
  if(!r){ go('reports'); return; }
  v.innerHTML = `
    <div id="reportDetailActions">
      <button class="btn" id="rdBack">← Retour à la liste</button>
      <span style="flex:1"></span>
      <button class="btn" id="rdEdit">Modifier</button>
      <button class="btn primary" id="rdPdf">Exporter en PDF</button>
      <button class="btn" id="rdDocx">Exporter en Word</button>
      <button class="btn danger" id="rdDel">Supprimer</button>
    </div>
    <div class="report-sheet">${reportSheetHTML(r)}</div>`;
  v.querySelector('#rdBack').onclick = () => go('reports');
  v.querySelector('#rdEdit').onclick = () => openReportForm(r.id);
  v.querySelector('#rdPdf').onclick = () => exportPDF(r.id);
  v.querySelector('#rdDocx').onclick = () => exportDOCX(r.id);
  v.querySelector('#rdDel').onclick = () => {
    confirmBox('Supprimer le rapport', `Supprimer définitivement le rapport <b>${esc(r.no)}</b> ?`, () => {
      state.reports = state.reports.filter(x => x.id !== r.id); save(); go('reports');
      toast('Rapport supprimé.', true);
    });
  };
}

/* ===== FIN DE reports.js ===== */