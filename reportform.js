/* =====================================================================
   FIREWISE EQUIPMENT CARE — reportform.js
   Formulaire de rapport : liaison registre avec check-list complète du
   matériel concerné, contenu, matériel testé, mesures batteries, signatures
===================================================================== */

/* ---------- 11. Formulaire de rapport (le cœur de l’app) ---------- */
let pads = {}; // SignaturePad actifs de la modale courante

function nextReportNo(){
  const year = new Date().getFullYear();
  let max = 0;
  state.reports.forEach(r => {
    const m = /^RPT-(\d{4})-(\d+)$/.exec(r.no || '');
    if(m && +m[1] === year) max = Math.max(max, +m[2]);
  });
  return `RPT-${year}-${String(max + 1).padStart(4, '0')}`;
}

function eqDesc(e){
  return `${typeLabel(e.type)} ${e.brand||''} ${e.model||''}`.trim() + (e.serial ? ` (NS ${e.serial})` : '');
}

function openReportForm(reportId){
  pads = {};
  const r = state.reports.find(x => x.id === reportId) || {};
  const mode = r.linkMode || 'base';
  const piecesHTML = (r.pieces && r.pieces.length ? r.pieces : [{}]).map(p => pieceRow(p)).join('');

  openModal((r.id ? 'Modifier le rapport ' + r.no : 'Nouveau rapport — ' + nextReportNo()), `
    <div class="fgrid">
      <div class="field"><label>Type de rapport *</label>
        <select id="f_type">${Object.entries(REPORT_TYPES).map(([k,l]) => `<option value="${k}" ${k===r.type?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Date d’intervention *</label><input type="date" id="f_date" value="${esc(r.date||todayISO())}"></div>
      <div class="field full"><label>Technicien *</label><input id="f_tech" value="${esc(r.tech||'')}" placeholder="Nom et initiales"></div>
    </div>
    <fieldset class="fs"><legend>Liaison au registre</legend>
      <div style="display:flex;gap:18px;margin-bottom:12px;font-size:13px">
        <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="f_linkmode" value="base" ${mode==='base'?'checked':''}> Lier au registre</label>
        <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="f_linkmode" value="free" ${mode==='free'?'checked':''}> Saisie libre (hors registre)</label>
      </div>
      <div id="lkBase" style="${mode==='free'?'display:none':''}">
        <div class="fgrid">
          <div class="field"><label>Site</label><select id="f_site"><option value="">—</option>${state.sites.map(s => `<option value="${s.id}" ${s.id===r.siteId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Bâtiment</label><select id="f_bld"><option value="">— tout le site —</option></select></div>
        </div>
        <div class="field"><label>Matériel concerné — tout est sélectionné automatiquement</label>
          <div id="f_eqBox" style="border:1px solid var(--line-2);border-radius:6px;max-height:190px;overflow-y:auto;background:#fff">
            <div class="hint" style="padding:10px">Choisissez un site et un bâtiment pour lister son matériel.</div>
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;align-items:center">
            <button type="button" class="mini" id="f_eqAll">Tout sélectionner</button>
            <button type="button" class="mini" id="f_eqNone">Tout désélectionner</button>
            <span class="hint" id="f_eqCount" style="margin-left:auto"></span>
          </div>
          <span class="hint">Le matériel coché alimente automatiquement la section « Matériel testé » du rapport.</span>
        </div>
        ${!state.sites.length ? '<p class="hint">Le registre est vide : créez un site, ou choisissez « saisie libre ».</p>' : ''}
      </div>
      <div id="lkFree" style="${mode==='base'?'display:none':''}">
        <div class="fgrid">
          <div class="field"><label>Site (texte libre)</label><input id="f_freeSite" value="${esc(r.siteName||'')}"></div>
          <div class="field"><label>Bâtiment / zone</label><input id="f_freeBld" value="${esc(r.buildingName||'')}"></div>
          <div class="field full"><label>Matériel décrit</label><input id="f_freeEq" value="${esc(r.equipmentDesc||'')}" placeholder="Ex. : Centrale de détection, local CMCF"></div>
        </div>
      </div>
    </fieldset>
    <fieldset class="fs"><legend>Contenu du rapport</legend>
      <div class="field"><label>Observations / constat *</label><textarea id="f_obs">${esc(r.obs||'')}</textarea></div>
      <div class="field"><label>Anomalies constatées</label><textarea id="f_ano" style="min-height:56px">${esc(r.anomalies||'')}</textarea></div>
      <div class="field"><label>Actions réalisées</label><textarea id="f_act" style="min-height:56px">${esc(r.actions||'')}</textarea></div>
      <div class="field"><label>Pièces remplacées</label>
        <div id="piecesBox">${piecesHTML}</div>
        <div><button type="button" class="mini" id="addPiece">+ Ajouter une pièce</button></div>
      </div>
      <div class="fgrid">
        <div class="field"><label>Recommandations</label><textarea id="f_reco" style="min-height:52px">${esc(r.reco||'')}</textarea></div>
        <div class="field"><label>Prochaine visite</label><input type="date" id="f_next" value="${esc(r.nextVisit||'')}"></div>
      </div>
    </fieldset>
    ${testsFieldsetHTML(r)}
    ${batteriesFieldsetHTML(r)}
    <fieldset class="fs"><legend>Signatures</legend>
      <div class="fgrid">
        <div class="field"><label>Technicien</label>
          <div class="sigBox"><canvas id="sigTech" style="width:100%;height:140px;border:1px dashed var(--line-2);border-radius:6px;background:#fff;touch-action:none"></canvas>
          <div style="margin-top:6px"><button type="button" class="mini" id="clearTech">Effacer</button></div></div></div>
        <div class="field"><label>Client / représentant site</label>
          <div class="sigBox"><canvas id="sigClient" style="width:100%;height:140px;border:1px dashed var(--line-2);border-radius:6px;background:#fff;touch-action:none"></canvas>
          <div style="margin-top:6px"><button type="button" class="mini" id="clearClient">Effacer</button></div></div></div>
      </div>
    </fieldset>
  `, true);

  // --- signatures ---
  function initPad(canvasId, existingData){
    const cv = document.getElementById(canvasId);
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(rect.width * dpr); cv.height = Math.round(rect.height * dpr);
    const pad = new SignaturePad(cv, { penColor:'#1e2022', backgroundColor:'rgb(255,255,255)' });
    if(existingData) pad.fromDataURL(existingData, { ratio:1 });
    return pad;
  }
  setTimeout(() => {
    pads.tech = initPad('sigTech', r.sigTech);
    pads.client = initPad('sigClient', r.sigClient);
  }, 60);
  modalBox.querySelector('#clearTech').onclick = () => pads.tech && pads.tech.clear();
  modalBox.querySelector('#clearClient').onclick = () => pads.client && pads.client.clear();

  // --- liaison registre / saisie libre ---
  const linkRadios = modalBox.querySelectorAll('input[name="f_linkmode"]');
  function syncLink(){
    const free = modalBox.querySelector('input[name="f_linkmode"]:checked').value === 'free';
    modalBox.querySelector('#lkBase').style.display = free ? 'none' : '';
    modalBox.querySelector('#lkFree').style.display = free ? '' : 'none';
  }
  linkRadios.forEach(rd => rd.onchange = syncLink);

  // --- cascades + check-list « Matériel concerné » ---
  const siteSel = modalBox.querySelector('#f_site'), bldSel = modalBox.querySelector('#f_bld');

  function eqChecklistHTML(list){
    return list.map(e => `
      <label style="display:flex;gap:9px;align-items:flex-start;padding:7px 10px;border-bottom:1px solid var(--line);font-size:13px">
        <input type="checkbox" class="f_eqChk" value="${e.id}" checked style="margin-top:2px">
        <span><b>${esc(eqDesc(e))}</b><br><span style="color:var(--ink-3);font-size:12px">${esc(e.loc||'Localisation non renseignée')}${e.serial ? ' · NS ' + esc(e.serial) : ''}</span></span>
      </label>`).join('');
  }
  function updateEqCount(){
    const all = modalBox.querySelectorAll('#f_eqBox .f_eqChk');
    const n = modalBox.querySelectorAll('#f_eqBox .f_eqChk:checked').length;
    modalBox.querySelector('#f_eqCount').textContent = all.length ? `${n}/${all.length} sélectionné(s)` : '';
  }
  function fillEq(){
    const sid = siteSel.value, bid = bldSel.value;
    const es = state.equipment.filter(e => e.siteId === sid && (!bid || e.buildingId === bid));
    const box = modalBox.querySelector('#f_eqBox');
    box.innerHTML = es.length ? eqChecklistHTML(es)
      : '<div class="hint" style="padding:10px">Aucun matériel dans ce périmètre : ajoutez-en au registre, ou passez en saisie libre.</div>';
    box.querySelectorAll('.f_eqChk').forEach(c => c.onchange = updateEqCount);
    updateEqCount();
    syncTestsToChecklist();
  }
  function fillBld(keep){
    const bs = state.buildings.filter(b => b.siteId === siteSel.value);
    bldSel.innerHTML = '<option value="">— tout le site —</option>'
      + bs.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    if(keep && bs.find(b => b.id === keep)) bldSel.value = keep;
    fillEq();
  }
  siteSel.onchange = () => fillBld();
  bldSel.onchange = () => fillEq();
  modalBox.querySelector('#f_eqAll').onclick = () => {
    modalBox.querySelectorAll('#f_eqBox .f_eqChk').forEach(c => c.checked = true);
    updateEqCount(); syncTestsToChecklist();
  };
  modalBox.querySelector('#f_eqNone').onclick = () => {
    modalBox.querySelectorAll('#f_eqBox .f_eqChk').forEach(c => c.checked = false);
    updateEqCount(); syncTestsToChecklist();
  };
  if(mode === 'base') fillBld(r.buildingId);

  // --- pièces ---
  function pieceRow(p = {}){
    return `<div class="pieceRow" style="display:grid;grid-template-columns:1fr 130px 56px 30px;gap:8px;margin-bottom:8px">
      <input class="p_d" placeholder="Désignation" value="${esc(p.d||'')}">
      <input class="p_r" placeholder="Référence" value="${esc(p.r||'')}">
      <input class="p_q" placeholder="Qté" value="${esc(p.q||'')}">
      <button type="button" class="mini del p_del" title="Retirer">×</button></div>`;
  }
  modalBox.querySelector('#addPiece').onclick = () => {
    const box = modalBox.querySelector('#piecesBox');
    box.insertAdjacentHTML('beforeend', pieceRow());
    wirePieceDels();
  };
  function wirePieceDels(){
    modalBox.querySelectorAll('.p_del').forEach(b => b.onclick = () => b.closest('.pieceRow').remove());
  }
  wirePieceDels();

  // --- matériel testé + mesures batteries (reportrows.js) ---
  wireReportRows();

  // --- enregistrement ---
  const submit = formFooter(r.id ? 'Enregistrer le rapport' : 'Créer le rapport');
  submit.onclick = () => {
    const type = modalBox.querySelector('#f_type').value;
    const date = modalBox.querySelector('#f_date').value;
    const tech = modalBox.querySelector('#f_tech').value.trim();
    const obs  = modalBox.querySelector('#f_obs').value.trim();
    const linkMode = modalBox.querySelector('input[name="f_linkmode"]:checked').value;

    if(!date){ markInvalid(modalBox.querySelector('#f_date')); return toast('La date est obligatoire.'); }
    if(!tech){ markInvalid(modalBox.querySelector('#f_tech')); return toast('Le nom du technicien est obligatoire.'); }
    if(!obs){ markInvalid(modalBox.querySelector('#f_obs')); return toast('Les observations sont obligatoires.'); }

    let link = { siteId:null, buildingId:null, equipmentId:null, siteName:'', buildingName:'', equipmentDesc:'', equipmentList:[] };
    if(linkMode === 'base'){
      if(!siteSel.value){ markInvalid(siteSel); return toast('Sélectionnez un site ou passez en saisie libre.'); }
      const s = state.sites.find(x => x.id === siteSel.value);
      const b = state.buildings.find(x => x.id === bldSel.value);
      const checkedEqs = [...modalBox.querySelectorAll('#f_eqBox .f_eqChk:checked')]
        .map(c => state.equipment.find(x => x.id === c.value)).filter(Boolean);
      link = {
        siteId:s.id, buildingId:b ? b.id : null,
        equipmentId:checkedEqs[0] ? checkedEqs[0].id : null,
        siteName:s.name, buildingName:b ? b.name : '',
        equipmentDesc: checkedEqs.length === 1 ? eqDesc(checkedEqs[0])
                     : checkedEqs.length ? `${checkedEqs.length} matériel(s) concerné(s)` : '',
        equipmentList: checkedEqs.map(e => eqFullLabel(e)),
      };
    } else {
      link.siteName  = modalBox.querySelector('#f_freeSite').value.trim();
      link.buildingName = modalBox.querySelector('#f_freeBld').value.trim();
      link.equipmentDesc = modalBox.querySelector('#f_freeEq').value.trim();
      if(!link.siteName){ markInvalid(modalBox.querySelector('#f_freeSite')); return toast('Indiquez au moins le site (texte libre).'); }
    }

    const pieces = [];
    modalBox.querySelectorAll('.pieceRow').forEach(row => {
      const d = row.querySelector('.p_d').value.trim();
      if(d) pieces.push({ d, r:row.querySelector('.p_r').value.trim(), q:row.querySelector('.p_q').value.trim() });
    });

    const data = {
      type, date, tech, linkMode, ...link, obs,
      anomalies:modalBox.querySelector('#f_ano').value.trim(),
      actions:modalBox.querySelector('#f_act').value.trim(),
      reco:modalBox.querySelector('#f_reco').value.trim(),
      nextVisit:modalBox.querySelector('#f_next').value,
      pieces,
      tests:collectTests(),
      batteries:collectBatteries(),
      sigTech:(pads.tech && !pads.tech.isEmpty()) ? pads.tech.toDataURL('image/png') : null,
      sigClient:(pads.client && !pads.client.isEmpty()) ? pads.client.toDataURL('image/png') : null,
    };

    if(r.id){
      Object.assign(state.reports.find(x => x.id === r.id), data);
    } else {
      const nr = { id:uid(), no:nextReportNo(), createdAt:Date.now(), ...data };
      state.reports.push(nr);
      ui.reportId = nr.id;
    }
    save(); closeModal(); render();
    toast(r.id ? 'Rapport mis à jour.' : 'Rapport créé.', true);
  };
}

/* ===== FIN DE reportform.js ===== */