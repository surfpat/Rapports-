/* =====================================================================
   FIREWISE EQUIPMENT CARE — reportform.js  (v2 — formulaire adaptatif)
   Formulaire de rapport structuré en accordéon, adaptatif selon :
   - le type de rapport (profil → sections affichées)
   - le type de matériel concerné (section batteries conditionnelle)
   Les fonctions collectTests/collectBatteries (reportrows.js) sont
   réutilisées à l'identique — compatibilité préservée avec le stockage.
===================================================================== */

/* ---------- 11. Formulaire de rapport ---------- */
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

/* Détermine si la section « batteries » doit s'afficher :
   - en mode base : si le matériel coché du périmètre contient un type
     de BATTERY_EQ_TYPES (centrales, extinction, etc.)
   - en mode libre : toujours proposée (matériel décrit en texte) */
function hasBatteryEquipment(r){
  if(r.linkMode === 'free') return true;
  const ids = Array.isArray(r.equipmentIds) ? r.equipmentIds : [];
  return state.equipment.some(e => ids.includes(e.id) && BATTERY_EQ_TYPES.includes(e.type));
}

/* ---------- Rendu d'une section d'accordéon ---------- */
function accSection(key, bodyHTML, opts = {}){
  const meta = REPORT_SECTIONS[key] || { title:key, ico:'•' };
  const open = opts.open ? ' open' : '';
  const disabled = opts.disabled ? ' disabled' : '';
  const sub = meta.sub ? `<span class="acc-sub"> — ${meta.sub}</span>` : '';
  return `
    <div class="acc-sec${open}${disabled}" data-sec="${key}">
      <button type="button" class="acc-head">
        <span class="acc-ico">${meta.ico||'•'}</span>
        <span class="acc-title">${meta.title}${sub}</span>
        <svg class="acc-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>
      </button>
      <div class="acc-body">${bodyHTML}</div>
    </div>`;
}

/* ---------- Câble l'accordéon (ouverture/fermeture au clic) ---------- */
function wireAccordion(){
  modalBox.querySelectorAll('.acc-sec:not(.disabled) .acc-head').forEach(head => {
    head.onclick = () => {
      const sec = head.closest('.acc-sec');
      // Si la section contient du matériel dynamique (équipement, batteries),
      // on ne peut pas juste toggler le display — on bascule la classe.
      sec.classList.toggle('open');
    };
  });
}

function openReportForm(reportId){
  pads = {};
  // reportId peut être : un id (string) | un objet draft (préfixé _draft) | null/undefined
  let r;
  if(reportId && typeof reportId === 'object' && reportId._draft){
    r = reportId; // brouillon en mémoire (changement de type sur nouveau rapport)
  } else {
    r = state.reports.find(x => x.id === reportId) || {};
  }
  const mode = r.linkMode || 'base';
  const reportType = r.type || 'maintenance';
  const profile = REPORT_PROFILES[reportType] || REPORT_PROFILES.maintenance;
  const piecesHTML = (r.pieces && r.pieces.length ? r.pieces : [{}]).map(p => pieceRow(p)).join('');

  // Détermine les sections réellement rendues (batteries conditionnelle au matériel)
  const showBatteries = hasBatteryEquipment(r);
  const sections = profile.sections.filter(s => s !== 'batteries' || showBatteries);

  // Construit le HTML de chaque section selon sa clé
  const sectionHTML = (key) => {
    switch(key){
      case 'info': return `
        <div class="fgrid">
          <div class="field"><label>Type de rapport *</label>
            <select id="f_type">${Object.entries(REPORT_TYPES).map(([k,l]) => `<option value="${k}" ${k===r.type?'selected':''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label>Date d’intervention *</label><input type="date" id="f_date" value="${esc(r.date||todayISO())}"></div>
          <div class="field full"><label>Technicien *</label><input id="f_tech" value="${esc(r.tech||'')}" placeholder="Nom et initiales"></div>
        </div>`;

      case 'liaison': return `
        <div style="display:flex;gap:18px;margin-bottom:14px;font-size:13px;flex-wrap:wrap">
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="f_linkmode" value="base" ${mode==='base'?'checked':''}> Lier au registre</label>
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="f_linkmode" value="free" ${mode==='free'?'checked':''}> Saisie libre (hors registre)</label>
        </div>
        <div id="lkBase" style="${mode==='free'?'display:none':''}">
          <div class="fgrid">
            <div class="field"><label>Site</label><select id="f_site"><option value="">—</option>${state.sites.map(s => `<option value="${s.id}" ${s.id===r.siteId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Bâtiment</label><select id="f_bld"><option value="">— tout le site —</option></select></div>
          </div>
          ${!state.sites.length ? '<p class="hint">Le registre est vide : créez un site, ou choisissez « saisie libre ».</p>' : ''}
        </div>
        <div id="lkFree" style="${mode==='base'?'display:none':''}">
          <div class="fgrid">
            <div class="field"><label>Site (texte libre)</label><input id="f_freeSite" value="${esc(r.siteName||'')}"></div>
            <div class="field"><label>Bâtiment / zone</label><input id="f_freeBld" value="${esc(r.buildingName||'')}"></div>
            <div class="field full"><label>Matériel décrit</label><input id="f_freeEq" value="${esc(r.equipmentDesc||'')}" placeholder="Ex. : Centrale de détection, local CMCF"></div>
          </div>
        </div>`;

      case 'equipement': return `
        <div id="lkBaseEquip" style="${mode==='free'?'display:none':''}">
          <div class="field"><label>Matériel concerné & tests</label>
            <div id="f_eqBox" style="border:1px solid var(--line-2);border-radius:6px;max-height:340px;overflow-y:auto;background:#fff">
              <div class="hint" style="padding:10px">Choisissez un site et un bâtiment pour lister son matériel.</div>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap">
              <button type="button" class="mini" id="f_eqAll">Tout sélectionner</button>
              <button type="button" class="mini" id="f_eqNone">Tout désélectionner</button>
              <button type="button" class="mini" id="f_eqAddFree">+ Hors registre</button>
              <span class="hint" id="f_eqCount" style="margin-left:auto"></span>
            </div>
          </div>
        </div>
        <div id="lkFreeEquip" style="${mode==='base'?'display:none':''}">
          <div class="field"><label>Matériel concerné (saisie libre)</label>
            <div id="f_eqBox" style="border:1px solid var(--line-2);border-radius:6px;min-height:60px;background:#fff"></div>
            <div style="margin-top:8px"><button type="button" class="mini" id="f_eqAddFree">+ Ajouter une ligne</button></div>
          </div>
        </div>`;

      case 'controle': return `
        <div class="field"><label>Contrôles & essais réalisés *</label>
          <textarea id="f_obs" placeholder="Tests de boucles, sensibilités, essais fonctionnels, alimentation secourue, reports au CMSI…">${esc(r.obs||'')}</textarea></div>`;

      case 'diagnostic': return `
        <div class="field"><label>Défaut signalé / cause</label>
          <textarea id="f_diag" placeholder="Défaut signalé, circonstances, hypothèses de cause…">${esc(r.diagnostic||'')}</textarea></div>
        <div class="field"><label>Analyse & origine</label>
          <textarea id="f_diag2" placeholder="Analyse technique, mesure ou test ayant permis d’identifier l’origine…">${esc(r.diag2||'')}</textarea></div>`;

      case 'actions': return `
        <div class="field"><label>Actions réalisées</label>
          <textarea id="f_act" placeholder="Intervention, réglages, remise en service, essais après intervention…">${esc(r.actions||'')}</textarea></div>`;

      case 'pieces': return `
        <div class="field"><label>Pièces remplacées</label>
          <div id="piecesBox">${piecesHTML}</div>
          <div style="margin-top:6px"><button type="button" class="mini" id="addPiece">+ Ajouter une pièce</button></div>
        </div>`;

      case 'reception': return `
        <div class="field"><label>État à réception</label>
          <textarea id="f_reception" placeholder="Conformité de l’installation reçue, documents techniques remis par l’installateur…">${esc(r.reception||'')}</textarea></div>
        <div class="field"><label>Vérifications initiales</label>
          <textarea id="f_verifInit" placeholder="Vérifications mécaniques, câblage, alimentations, protection…">${esc(r.verifInit||'')}</textarea></div>`;

      case 'reglages': return `
        <div class="field"><label>Réglages & paramétrage</label>
          <textarea id="f_reglages" placeholder="Configuration saisie, adresses boucles, seuils, temporisations, reports…">${esc(r.reglages||'')}</textarea></div>`;

      case 'formation': return `
        <div class="field"><label>Formation remise</label>
          <textarea id="f_formation" placeholder="Formation utilisateur, consignes d’exploitation, documents remis (carnet, schémas, procédures)…">${esc(r.formation||'')}</textarea></div>`;

      case 'rondes': return `
        <div class="field"><label>Rondes & contrôles visuels de la journée</label>
          <textarea id="f_obs" placeholder="États observés, points contrôlés, événements de la journée…">${esc(r.obs||'')}</textarea></div>`;

      case 'obs': return `
        <div class="field"><label>Observations / constat *</label>
          <textarea id="f_obs" placeholder="Observations générales, constat technique…">${esc(r.obs||'')}</textarea></div>`;

      case 'anomalies': return `
        <div class="field"><label>Anomalies constatées</label>
          <textarea id="f_ano" placeholder="Défauts, non-conformités, points nécessitant une action…">${esc(r.anomalies||'')}</textarea></div>`;

      case 'reco': return `
        <div class="fgrid">
          <div class="field"><label>Recommandations</label><textarea id="f_reco" placeholder="Recommandations, actions préventives…">${esc(r.reco||'')}</textarea></div>
          <div class="field"><label>Prochaine visite</label><input type="date" id="f_next" value="${esc(r.nextVisit||'')}"></div>
        </div>`;

      case 'batteries': return batteriesFieldsetHTML(r);

      case 'signatures': return `
        <div class="fgrid">
          <div class="field"><label>Technicien</label>
            <div class="sigBox"><canvas id="sigTech" style="width:100%;height:140px;border:1px dashed var(--line-2);border-radius:6px;background:#fff;touch-action:none"></canvas>
            <div style="margin-top:6px"><button type="button" class="mini" id="clearTech">Effacer</button></div></div></div>
          <div class="field"><label>Client / représentant site</label>
            <div class="sigBox"><canvas id="sigClient" style="width:100%;height:140px;border:1px dashed var(--line-2);border-radius:6px;background:#fff;touch-action:none"></canvas>
            <div style="margin-top:6px"><button type="button" class="mini" id="clearClient">Effacer</button></div></div></div>
        </div>`;
      default: return '';
    }
  };

  // Construit l'accordéon : 1re section (info) ouverte, les autres repliées
  const accordionHTML = sections.map((key, i) => {
    return accSection(key, sectionHTML(key), { open: i === 0 });
  }).join('');

  // Titre du modal : profil du type de rapport
  const modalTitle = r.id ? `Modifier le rapport ${r.no}` : `Nouveau rapport — ${nextReportNo()}`;
  const modalSub = profile.label + ' · ' + profile.sub;

  openModal(`${modalTitle}|||${modalSub}`, `
    <p class="hint" style="margin-bottom:14px;padding:11px 14px;background:var(--bg-2);border-radius:var(--radius);border-left:3px solid var(--accent)">${esc(profile.intro)}</p>
    <div class="accordion">${accordionHTML}</div>
  `, true);

  // Le titre du modal contient "titre|||sous-titre" → on sépare et on habille
  const modalH = modalBox.querySelector('.modal-h h3');
  if(modalH){
    const [main, sub] = modalH.textContent.split('|||');
    modalH.innerHTML = `${esc(main)}<div class="modal-h-sub">${esc(sub||'')}</div>`;
  }

  wireAccordion();

  // --- signatures ---
  function initPad(canvasId, existingData){
    const cv = document.getElementById(canvasId);
    if(!cv) return null;
    if(typeof SignaturePad === 'undefined'){
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#8f9296'; ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('Bibliothèque de signature non chargée', 12, 30);
      ctx.fillText('(connexion internet requise, rechargez la page)', 12, 50);
      return null;
    }
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(rect.width * dpr); cv.height = Math.round(rect.height * dpr);
    const pad = new SignaturePad(cv, { penColor:'#1e2022', backgroundColor:'rgb(255,255,255)' });
    if(existingData) pad.fromDataURL(existingData, { ratio:1 });
    return pad;
  }
  // Les signatures ne sont initialisées que si la section est rendue
  if(sections.includes('signatures')){
    setTimeout(() => {
      pads.tech = initPad('sigTech', r.sigTech);
      pads.client = initPad('sigClient', r.sigClient);
    }, 60);
    modalBox.querySelector('#clearTech').onclick = () => pads.tech && pads.tech.clear();
    modalBox.querySelector('#clearClient').onclick = () => pads.client && pads.client.clear();
  }

  // --- liaison registre / saisie libre ---
  const linkRadios = modalBox.querySelectorAll('input[name="f_linkmode"]');
  function syncLink(){
    const free = modalBox.querySelector('input[name="f_linkmode"]:checked').value === 'free';
    const lkBase = modalBox.querySelector('#lkBase');
    const lkFree = modalBox.querySelector('#lkFree');
    const lkBaseEquip = modalBox.querySelector('#lkBaseEquip');
    const lkFreeEquip = modalBox.querySelector('#lkFreeEquip');
    if(lkBase) lkBase.style.display = free ? 'none' : '';
    if(lkFree) lkFree.style.display = free ? '' : 'none';
    if(lkBaseEquip) lkBaseEquip.style.display = free ? 'none' : '';
    if(lkFreeEquip) lkFreeEquip.style.display = free ? '' : 'none';
    // En mode libre : on charge les lignes hors registre sauvegardées
    if(free){
      const savedFree = (r.tests || []).filter(t => !t.eqId);
      if(savedFree.length){
        const box = modalBox.querySelector('#f_eqBox');
        box.innerHTML = savedFree.map(t => eqTestRowHTML(null, true, t)).join('');
        wireEqRows();
      }
    }
  }
  if(linkRadios.length) linkRadios.forEach(rd => rd.onchange = syncLink);

  // --- cascades + check-list « Matériel concerné » (mode base uniquement) ---
  const siteSel = modalBox.querySelector('#f_site'), bldSel = modalBox.querySelector('#f_bld');

  function eqTestRowHTML(e, checked, test){
    const t = test || {};
    const isFree = !e;
    const label = e ? eqDesc(e) : (t.label || '');
    const sub = e ? `${esc(e.loc||'Localisation non renseignée')}${e.serial ? ' · NS ' + esc(e.serial) : ''}` : '';
    const resVal = t.res || 'nonteste';
    return `
      <div class="eqRow" data-eqid="${e ? e.id : ''}" style="display:grid;grid-template-columns:24px 1fr 130px;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);align-items:flex-start;font-size:13px">
        ${isFree
          ? `<button type="button" class="mini del eqDel" style="margin-top:0;padding:0;width:22px;height:22px;line-height:1">×</button>`
          : `<input type="checkbox" class="f_eqChk" value="${e.id}" ${checked ? 'checked' : ''} style="margin-top:3px">`}
        <div>
          ${isFree
            ? `<input class="t_free" placeholder="Désignation du matériel (saisie libre)" value="${esc(label)}" style="width:100%;font-weight:600;border:none;background:transparent;padding:0;font-size:13px">`
            : `<b>${esc(label)}</b><br><span style="color:var(--ink-3);font-size:12px">${sub}</span>`}
          <input class="t_note" placeholder="Test réalisé / observation" value="${esc(t.note||'')}" style="margin-top:4px;width:100%">
        </div>
        <select class="t_res">
          <option value="nonteste" ${resVal==='nonteste'?'selected':''}>Non testé</option>
          ${Object.entries(TEST_RESULTS).map(([v,l]) => `<option value="${v}" ${v===resVal?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;
  }
  function updateEqCount(){
    const all = modalBox.querySelectorAll('#f_eqBox .f_eqChk');
    const n = modalBox.querySelectorAll('#f_eqBox .f_eqChk:checked').length;
    const countEl = modalBox.querySelector('#f_eqCount');
    if(countEl) countEl.textContent = all.length ? `${n}/${all.length} sélectionné(s)` : '';
    syncBatteriesSection();
  }
  // Recalcule dynamiquement la visibilité de la section batteries selon le
  // matériel coché : insère la section si du matériel à batterie est coché,
  // la retire sinon. Préserve les saisies de batteries déjà effectuées.
  function syncBatteriesSection(){
    const profile = REPORT_PROFILES[modalBox.querySelector('#f_type')?.value || 'maintenance'] || REPORT_PROFILES.maintenance;
    if(!profile.sections.includes('batteries')) return; // profil sans section batteries (journalier)
    const checkedIds = [...modalBox.querySelectorAll('#f_eqBox .f_eqChk:checked')].map(c => c.value);
    const hasBat = checkedIds.some(id => {
      const e = state.equipment.find(x => x.id === id);
      return e && BATTERY_EQ_TYPES.includes(e.type);
    });
    // En mode libre, on considère qu'il peut y avoir batterie
    const linkMode = modalBox.querySelector('input[name="f_linkmode"]:checked')?.value || 'base';
    const show = hasBat || linkMode === 'free';
    const existing = modalBox.querySelector('.acc-sec[data-sec="batteries"]');
    if(show && !existing){
      // Préserver les batteries déjà saisies
      const savedBatteries = (r.batteries && r.batteries.length) ? r.batteries : [{}];
      const fakeR = Object.assign({}, r, { batteries: savedBatteries });
      // Insérer la section batteries AVANT la section 'actions' ou à défaut avant 'reco'
      const order = profile.sections;
      const batIdx = order.indexOf('batteries');
      const afterKey = order.slice(batIdx + 1).find(k => modalBox.querySelector(`.acc-sec[data-sec="${k}"]`));
      const refNode = afterKey ? modalBox.querySelector(`.acc-sec[data-sec="${afterKey}"]`) : null;
      const html = accSection('batteries', batteriesFieldsetHTML(fakeR), { open: false });
      if(refNode){
        refNode.insertAdjacentHTML('beforebegin', html);
      } else {
        const acc = modalBox.querySelector('.accordion');
        if(acc) acc.insertAdjacentHTML('beforeend', html);
      }
      // Câbler la section batteries fraîchement insérée
      const newSec = modalBox.querySelector('.acc-sec[data-sec="batteries"]');
      if(newSec){
        const head = newSec.querySelector('.acc-head');
        if(head) head.onclick = () => newSec.classList.toggle('open');
        newSec.querySelectorAll('.batRow').forEach(wireBatteryRow);
        const addBtn = newSec.querySelector('#addBattery');
        if(addBtn) addBtn.onclick = () => {
          const box = newSec.querySelector('#batteriesBox');
          if(box){ box.insertAdjacentHTML('beforeend', batteryRowHTML()); wireBatteryRow(box.lastElementChild); }
        };
      }
    } else if(!show && existing){
      // Sauvegarder les batteries saisies avant de retirer la section
      if(typeof collectBatteries === 'function'){
        r.batteries = collectBatteries();
      }
      existing.remove();
    }
  }
  function captureEqState(){
    const cur = { checked:new Set(), tests:{}, free:[] };
    modalBox.querySelectorAll('#f_eqBox .eqRow').forEach(row => {
      const eqId = row.dataset.eqid;
      const chk = row.querySelector('.f_eqChk');
      const res = row.querySelector('.t_res').value;
      const note = row.querySelector('.t_note').value.trim();
      if(eqId){
        if(chk && chk.checked) cur.checked.add(eqId);
        cur.tests[eqId] = { res, note };
      } else {
        cur.free.push({ label: row.querySelector('.t_free').value.trim(), res, note });
      }
    });
    return cur;
  }
  function wireEqRows(){
    modalBox.querySelectorAll('#f_eqBox .eqRow').forEach(row => {
      const chk = row.querySelector('.f_eqChk');
      const res = row.querySelector('.t_res');
      const note = row.querySelector('.t_note');
      const del = row.querySelector('.eqDel');
      const syncRow = () => {
        if(chk){
          const on = chk.checked;
          row.style.opacity = on ? '1' : '0.45';
          if(res) res.disabled = !on;
          if(note) note.disabled = !on;
        }
      };
      if(chk) chk.onchange = () => { syncRow(); updateEqCount(); };
      if(del) del.onclick = () => { row.remove(); updateEqCount(); };
      syncRow();
    });
  }
  function fillEq(){
    const sid = siteSel ? siteSel.value : '', bid = bldSel ? bldSel.value : '';
    const es = state.equipment.filter(e => e.siteId === sid && (!bid || e.buildingId === bid));
    const box = modalBox.querySelector('#f_eqBox');
    if(!box) return;
    const hasRows = !!box.querySelector('.eqRow');
    const cur = hasRows ? captureEqState() : null;
    const savedIds = r.id && Array.isArray(r.equipmentIds) ? new Set(r.equipmentIds) : null;
    const savedTests = {};
    if(r.tests) r.tests.forEach(t => { if(t.eqId) savedTests[t.eqId] = t; });
    const savedFree = r.tests ? r.tests.filter(t => !t.eqId) : [];

    let html = '';
    if(es.length){
      html += es.map(e => {
        let checked, test;
        if(cur && cur.tests[e.id]){
          checked = cur.checked.has(e.id);
          test = cur.tests[e.id];
        } else if(savedIds){
          checked = savedIds.has(e.id);
          test = savedTests[e.id] || { res:'nonteste' };
        } else {
          checked = true;
          test = { res:'nonteste' };
        }
        return eqTestRowHTML(e, checked, test);
      }).join('');
    }
    const freeRows = cur ? cur.free : savedFree;
    freeRows.forEach(t => { html += eqTestRowHTML(null, true, t); });

    if(!html){
      html = '<div class="hint" style="padding:10px">Aucun matériel dans ce périmètre : ajoutez-en au registre, ou cliquez « + Hors registre ».</div>';
    }
    box.innerHTML = html;
    wireEqRows();
    updateEqCount();
  }
  function fillBld(keep){
    if(!bldSel) return;
    const bs = state.buildings.filter(b => b.siteId === siteSel.value);
    bldSel.innerHTML = '<option value="">— tout le site —</option>'
      + bs.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    if(keep && bs.find(b => b.id === keep)) bldSel.value = keep;
    fillEq();
  }
  if(siteSel) siteSel.onchange = () => fillBld();
  if(bldSel) bldSel.onchange = () => fillEq();
  function setAllEq(checked){
    modalBox.querySelectorAll('#f_eqBox .f_eqChk').forEach(c => {
      c.checked = checked;
      const row = c.closest('.eqRow');
      row.style.opacity = checked ? '1' : '0.45';
      row.querySelector('.t_res').disabled = !checked;
      row.querySelector('.t_note').disabled = !checked;
    });
    updateEqCount();
  }
  const eqAll = modalBox.querySelector('#f_eqAll');
  const eqNone = modalBox.querySelector('#f_eqNone');
  const eqAddFree = modalBox.querySelector('#f_eqAddFree');
  if(eqAll) eqAll.onclick = () => setAllEq(true);
  if(eqNone) eqNone.onclick = () => setAllEq(false);
  if(eqAddFree) eqAddFree.onclick = () => {
    const box = modalBox.querySelector('#f_eqBox');
    const hint = box.querySelector('.hint');
    if(hint) hint.remove();
    box.insertAdjacentHTML('beforeend', eqTestRowHTML(null, true, { res:'nonteste' }));
    wireEqRows();
  };
  if(mode === 'base' && siteSel){
    fillBld(r.buildingId);
  } else if(mode === 'free'){
    const savedFree = (r.tests || []).filter(t => !t.eqId);
    if(savedFree.length){
      const box = modalBox.querySelector('#f_eqBox');
      if(box){
        box.innerHTML = savedFree.map(t => eqTestRowHTML(null, true, t)).join('');
        wireEqRows();
      }
    }
  }

  // --- pièces ---
  function pieceRow(p = {}){
    return `<div class="pieceRow" style="display:grid;grid-template-columns:1fr 130px 56px 30px;gap:8px;margin-bottom:8px">
      <input class="p_d" placeholder="Désignation" value="${esc(p.d||'')}">
      <input class="p_r" placeholder="Référence" value="${esc(p.r||'')}">
      <input class="p_q" placeholder="Qté" value="${esc(p.q||'')}">
      <button type="button" class="mini del p_del" title="Retirer">×</button></div>`;
  }
  const addPieceBtn = modalBox.querySelector('#addPiece');
  if(addPieceBtn) addPieceBtn.onclick = () => {
    const box = modalBox.querySelector('#piecesBox');
    if(box){
      box.insertAdjacentHTML('beforeend', pieceRow());
      wirePieceDels();
    }
  };
  function wirePieceDels(){
    modalBox.querySelectorAll('.p_del').forEach(b => b.onclick = () => b.closest('.pieceRow').remove());
  }
  wirePieceDels();

  // --- matériel testé + mesures batteries (reportrows.js) ---
  if(typeof wireReportRows === 'function') wireReportRows();

  // --- Changement de type de rapport : recharger le formulaire avec le bon profil ---
  const typeSel = modalBox.querySelector('#f_type');
  if(typeSel){
    typeSel.onchange = () => {
      // Préserver les saisies courantes dans un objet draft en mémoire
      const cur = collectCurrent();
      cur.type = typeSel.value;
      cur._draft = true;            // marqueur : brouillon non sauvegardé
      if(r.id) cur.id = r.id;       // conserver l'id si on édite un rapport existant
      // Préserver le matériel testé et les batteries saisies
      if(typeof collectTests === 'function') cur.tests = collectTests();
      if(typeof collectBatteries === 'function') cur.batteries = collectBatteries();
      cur.pieces = collectPieces();
      if(pads.tech && !pads.tech.isEmpty()) cur.sigTech = pads.tech.toDataURL('image/png');
      else if(r.sigTech) cur.sigTech = r.sigTech;
      if(pads.client && !pads.client.isEmpty()) cur.sigClient = pads.client.toDataURL('image/png');
      else if(r.sigClient) cur.sigClient = r.sigClient;
      // Préserver la liaison registre courante (valeurs des selects)
      const linkChecked = modalBox.querySelector('input[name="f_linkmode"]:checked');
      cur.linkMode = linkChecked ? linkChecked.value : (r.linkMode || 'base');
      if(cur.linkMode === 'base'){
        const ssEl = modalBox.querySelector('#f_site');
        const bsEl = modalBox.querySelector('#f_bld');
        if(ssEl && ssEl.value){
          cur.siteId = ssEl.value;
          cur.buildingId = bsEl ? (bsEl.value || null) : null;
          const s = state.sites.find(x => x.id === ssEl.value);
          const b = state.buildings.find(x => x.id === (bsEl ? bsEl.value : ''));
          if(s) cur.siteName = s.name;
          if(b) cur.buildingName = b.name;
          const checkedEqs = [...modalBox.querySelectorAll('#f_eqBox .f_eqChk:checked')]
            .map(c => state.equipment.find(x => x.id === c.value)).filter(Boolean);
          cur.equipmentIds = checkedEqs.map(e => e.id);
          cur.equipmentId = checkedEqs[0] ? checkedEqs[0].id : null;
          cur.equipmentDesc = checkedEqs.length === 1 ? eqDesc(checkedEqs[0])
                            : checkedEqs.length ? `${checkedEqs.length} matériel(s) concerné(s)` : '';
          cur.equipmentList = checkedEqs.map(e => eqFullLabel(e));
        }
      } else {
        // Mode libre : préserver les champs texte
        const fss = modalBox.querySelector('#f_freeSite');
        const fbs = modalBox.querySelector('#f_freeBld');
        const feq = modalBox.querySelector('#f_freeEq');
        if(fss) cur.siteName = fss.value.trim();
        if(fbs) cur.buildingName = fbs.value.trim();
        if(feq) cur.equipmentDesc = feq.value.trim();
      }
      // Re-render complet du formulaire avec le nouveau profil
      closeModal();
      openReportForm(cur);
    };
  }
  function collectPieces(){
    const out = [];
    modalBox.querySelectorAll('.pieceRow').forEach(row => {
      const d = row.querySelector('.p_d').value.trim();
      if(d) out.push({ d, r:row.querySelector('.p_r').value.trim(), q:row.querySelector('.p_q').value.trim() });
    });
    return out;
  }
  function collectCurrent(){
    const g = id => { const el = modalBox.querySelector('#'+id); return el ? el.value.trim() : ''; };
    const out = {
      type: g('f_type'), date: g('f_date'), tech: g('f_tech'),
      obs: g('f_obs'), anomalies: g('f_ano'), actions: g('f_act'),
      reco: g('f_reco'), nextVisit: modalBox.querySelector('#f_next') ? modalBox.querySelector('#f_next').value : '',
      diagnostic: g('f_diag'), diag2: g('f_diag2'),
      reception: g('f_reception'), verifInit: g('f_verifInit'),
      reglages: g('f_reglages'), formation: g('f_formation'),
    };
    return out;
  }

  // --- enregistrement ---
  const submit = formFooter(r.id ? 'Enregistrer le rapport' : 'Créer le rapport');
  submit.onclick = () => {
    const type = modalBox.querySelector('#f_type').value;
    const date = modalBox.querySelector('#f_date').value;
    const tech = modalBox.querySelector('#f_tech').value.trim();
    const obs  = modalBox.querySelector('#f_obs') ? modalBox.querySelector('#f_obs').value.trim() : '';
    const linkMode = modalBox.querySelector('input[name="f_linkmode"]:checked') ? modalBox.querySelector('input[name="f_linkmode"]:checked').value : 'base';

    if(!date){ markInvalid(modalBox.querySelector('#f_date')); return toast('La date est obligatoire.'); }
    if(!tech){ markInvalid(modalBox.querySelector('#f_tech')); return toast('Le nom du technicien est obligatoire.'); }
    // obs obligatoire seulement si la section obs/controle/rondes est présente (champ f_obs)
    if(modalBox.querySelector('#f_obs') && !obs){ markInvalid(modalBox.querySelector('#f_obs')); return toast('Les observations / contrôles sont obligatoires.'); }

    let link = { siteId:null, buildingId:null, equipmentId:null, equipmentIds:[], siteName:'', buildingName:'', equipmentDesc:'', equipmentList:[] };
    if(linkMode === 'base'){
      if(!siteSel || !siteSel.value){ if(siteSel) markInvalid(siteSel); return toast('Sélectionnez un site ou passez en saisie libre.'); }
      const s = state.sites.find(x => x.id === siteSel.value);
      const b = state.buildings.find(x => x.id === bldSel.value);
      const checkedEqs = [...modalBox.querySelectorAll('#f_eqBox .f_eqChk:checked')]
        .map(c => state.equipment.find(x => x.id === c.value)).filter(Boolean);
      link = {
        siteId:s.id, buildingId:b ? b.id : null,
        equipmentId:checkedEqs[0] ? checkedEqs[0].id : null,
        equipmentIds: checkedEqs.map(e => e.id),
        siteName:s.name, buildingName:b ? b.name : '',
        equipmentDesc: checkedEqs.length === 1 ? eqDesc(checkedEqs[0])
                     : checkedEqs.length ? `${checkedEqs.length} matériel(s) concerné(s)` : '',
        equipmentList: checkedEqs.map(e => eqFullLabel(e)),
      };
    } else {
      link.siteName  = modalBox.querySelector('#f_freeSite') ? modalBox.querySelector('#f_freeSite').value.trim() : '';
      link.buildingName = modalBox.querySelector('#f_freeBld') ? modalBox.querySelector('#f_freeBld').value.trim() : '';
      link.equipmentDesc = modalBox.querySelector('#f_freeEq') ? modalBox.querySelector('#f_freeEq').value.trim() : '';
      if(!link.siteName){ const el = modalBox.querySelector('#f_freeSite'); if(el) markInvalid(el); return toast('Indiquez au moins le site (texte libre).'); }
    }

    const pieces = [];
    modalBox.querySelectorAll('.pieceRow').forEach(row => {
      const d = row.querySelector('.p_d').value.trim();
      if(d) pieces.push({ d, r:row.querySelector('.p_r').value.trim(), q:row.querySelector('.p_q').value.trim() });
    });

    // Champs spécifiques aux profils (récupérés seulement si présents)
    const g = id => { const el = modalBox.querySelector('#'+id); return el ? el.value.trim() : ''; };

    const data = {
      type, date, tech, linkMode, ...link, obs,
      anomalies: g('f_ano'),
      actions: g('f_act'),
      diagnostic: g('f_diag'), diag2: g('f_diag2'),
      reception: g('f_reception'), verifInit: g('f_verifInit'),
      reglages: g('f_reglages'), formation: g('f_formation'),
      reco: g('f_reco'),
      nextVisit: g('f_next'),
      pieces,
      tests: typeof collectTests === 'function' ? collectTests() : [],
      batteries: typeof collectBatteries === 'function' ? collectBatteries() : [],
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
