/* =====================================================================
   FIREWISE EQUIPMENT CARE — reportrows.js
   Sections dynamiques du rapport :
   - matériel testé (aligné sur la check-list « Matériel concerné »)
   - mesures batteries — protocole NF S 61-930 / EN 54-4 :
       · contrôle de charge (tension de flottement, courant de charge)
       · coupure secteur : intensité absorbée par le matériel + U à t0
       · après 1 h : U à t+1 h
       · calculs automatiques :
           Ah consommés (1 h)   = I absorbée × 1 h
           capacité restante (%) = f(U t+1 h) — table indicative bloc 12 V plomb
           autonomie estimée (h) = capacité restante (Ah) / I absorbée
           résultat proposé comparé à l'autonomie requise
===================================================================== */

const TEST_RESULTS = { conforme:'Conforme', surveil:'À surveiller', nonconforme:'Non conforme' };
const BATTERY_RESULTS = { conforme:'Conforme', surveil:'À surveiller', remplacer:'À remplacer' };

// Estimation indicative de l'état de charge d'un bloc 12 V plomb
// d'après la tension mesurée (valeurs approchées, matériel en fonctionnement)
const SOC_TABLE = [
  [12.7, 100],
  [12.5, 80],
  [12.3, 60],
  [12.1, 40],
  [11.9, 20],
  [11.7, 0],
];
function socFromU(u, unom){
  if(u === null || !(unom > 0)) return null;
  const ub = u * 12 / unom; // normalise à un bloc 12 V (ex. : 24,9 V → 12,45 V)
  if(ub >= SOC_TABLE[0][0]) return 100;
  if(ub <= SOC_TABLE[SOC_TABLE.length - 1][0]) return 0;
    for(let i = 0; i < SOC_TABLE.length - 1; i++){
    const uh = SOC_TABLE[i][0], sh = SOC_TABLE[i][1];
    const ub2 = SOC_TABLE[i+1][0], sb = SOC_TABLE[i+1][1];
    if(ub <= uh && ub >= ub2){
      return Math.round((sb + (ub - ub2) / (uh - ub2) * (sh - sb)) * 10) / 10;
    }
    }
  return null;
}

// Libellé complet d'un matériel du registre (avec site, bâtiment, localisation)
function eqFullLabel(e){
  const s = state.sites.find(x => x.id === e.siteId);
  const b = state.buildings.find(x => x.id === e.buildingId);
  const loc = [s ? s.name : '', b ? b.name : '', e.loc || ''].filter(Boolean).join(' · ');
  return eqDesc(e) + (loc ? ' — ' + loc : '');
}

// Liste déroulante du registre, groupée par site
function eqSelectOptions(selectedId){
  return '<option value="">— matériel du registre (ou saisie libre) —</option>'
    + state.sites.map(s => {
        const es = state.equipment.filter(e => e.siteId === s.id);
        if(!es.length) return '';
        return `<optgroup label="${esc(s.name)}">`
          + es.map(e => `<option value="${e.id}" ${e.id===selectedId?'selected':''}>${esc(eqDesc(e))} · ${esc(e.loc||'')}</option>`).join('')
          + '</optgroup>';
      }).join('')
    + '<option value="__free__">＋ Saisie libre…</option>';
}

/* ---------- Matériel testé ---------- */
function testsFieldsetHTML(r){
  const rows = (r.tests && r.tests.length ? r.tests : []);
  return `
    <fieldset class="fs"><legend>Matériel testé</legend>
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center">
        <select id="t_impSite" style="border:1px solid var(--line-2);border-radius:6px;padding:7px 8px;background:#fff">
          <option value="">— site à importer —</option>
          ${state.sites.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>
        <select id="t_impBld" style="border:1px solid var(--line-2);border-radius:6px;padding:7px 8px;background:#fff"></select>
        <button type="button" class="mini" id="importTests">+ Importer le matériel</button>
      </div>
      <p class="hint" style="margin-bottom:10px">En mode « lié au registre », la liste suit automatiquement la check-list « Matériel concerné » (résultat « Non testé » jusqu’à saisie du contrôle). L’import manuel reste disponible ici. Les matériels déjà listés ne sont pas dupliqués.</p>
      <div id="testsBox">${rows.map(t => testRowHTML(t)).join('')}</div>
      <div style="margin-top:8px"><button type="button" class="mini" id="addTest">+ Ajouter une ligne manuelle</button></div>
    </fieldset>`;
}

function testRowHTML(t = {}){
  const selVal = t.eqId || (t.label ? '__free__' : '');
  return `
    <div class="testRow" style="border:1px solid var(--line);border-radius:6px;padding:10px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:1fr 130px;gap:8px">
        <select class="t_eq">${eqSelectOptions(selVal)}</select>
        <select class="t_res">
          <option value="nonteste" ${(!t.res || t.res === 'nonteste') ? 'selected' : ''}>Non testé</option>
          ${Object.entries(TEST_RESULTS).map(([v,l]) => `<option value="${v}" ${v===t.res?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <input class="t_free" placeholder="Désignation du matériel testé (saisie libre)" style="display:none;margin-top:6px" value="${esc(t.eqId ? '' : (t.label||''))}">
      <input class="t_note" placeholder="Test réalisé / observation" style="margin-top:6px" value="${esc(t.note||'')}">
      <div style="text-align:right;margin-top:6px"><button type="button" class="mini del t_del">Retirer</button></div>
    </div>`;
}

function wireTestRow(row){
  const sel = row.querySelector('.t_eq'), free = row.querySelector('.t_free');
  const sync = () => { free.style.display = sel.value === '__free__' ? '' : 'none'; };
  sel.onchange = sync; sync();
  row.querySelector('.t_del').onclick = () => row.remove();
}

/* ---------- Mesures batteries (protocole complet) ---------- */
function batteriesFieldsetHTML(r){
  const rows = (r.batteries && r.batteries.length ? r.batteries : [{}]);
  return `
    <fieldset class="fs"><legend>Mesures batteries — autonomie (NF S 61-930)</legend>
      <p class="hint" style="margin-bottom:10px">
        <b>Protocole :</b> 1) secteur présent — relever tension/courant de charge (flottement ≈ 13,5–13,8 V par bloc 12 V) ;
        2) secteur coupé — relever l’<b>intensité absorbée par le matériel</b> et la tension à <b>t0</b> ;
        3) après <b>1 h</b> — relever la tension à <b>t+1 h</b>.<br>
        <b>Calculs automatiques :</b> Ah consommés = I absorbée × 1 h ; capacité restante estimée d’après la tension
        (table indicative bloc 12 V plomb) ; autonomie estimée = capacité restante / I absorbée, comparée à
        l’autonomie requise (≥ 100 % → conforme, ≥ 80 % → à surveiller). Estimation indicative : se référer
        aux tables constructeur pour un contrôle certifié.
      </p>
      <div id="batteriesBox">${rows.map(b => batteryRowHTML(b)).join('')}</div>
      <div><button type="button" class="mini" id="addBattery">+ Ajouter des mesures</button></div>
    </fieldset>`;
}

function batteryRowHTML(b = {}){
  const ro = 'readonly style="background:#f2f1ef;color:var(--ink-2)"';
  return `
    <div class="batRow" style="border:1px solid var(--line);border-radius:6px;padding:10px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <input class="b_mat" placeholder="Matériel concerné (ex. : CDS boucles 1-2)" value="${esc(b.mat||'')}">
        <input class="b_bat" placeholder="Batteries (ex. : 2 × 12 V / 12 Ah)" value="${esc(b.bat||'')}">
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px">
        <input class="b_cnom" inputmode="decimal" placeholder="Capacité nominale (Ah)" value="${esc(b.cnom||'')}">
        <input class="b_unom" inputmode="decimal" placeholder="Tension nominale (12 ou 24 V)" value="${esc(b.unom||'')}">
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px">
        <input class="b_vch" inputmode="decimal" placeholder="Tension de charge — secteur (V)" value="${esc(b.vch||'')}">
        <input class="b_ich" inputmode="decimal" placeholder="Courant de charge — secteur (A)" value="${esc(b.ich||'')}">
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px">
        <input class="b_iabs" inputmode="decimal" placeholder="Intensité absorbée (A) — secteur coupé" value="${esc(b.iabs||'')}">
        <input class="b_ut0" inputmode="decimal" placeholder="Tension à t0 (V)" value="${esc(b.ut0||'')}">
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px">
        <input class="b_ut1" inputmode="decimal" placeholder="Tension à t+1 h (V)" value="${esc(b.ut1||'')}">
        <input class="b_areq" inputmode="decimal" placeholder="Autonomie requise (h)" value="${esc(b.areq||'')}">
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px">
        <input class="b_cmes" ${ro} placeholder="Capacité restante (%) — auto" value="${esc(b.cmes||'')}">
        <input class="b_aut" ${ro} placeholder="Autonomie estimée (h) — auto" value="${esc(b.aut||'')}">
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px">
        <input class="b_q1h" ${ro} placeholder="Consommé pendant le test (Ah) — auto" value="${esc(b.q1h||'')}">
        <select class="b_res">
          <option value="nonteste" ${(!b.res || b.res === 'nonteste') ? 'selected' : ''}>Non testé</option>
          ${Object.entries(BATTERY_RESULTS).map(([v,l]) => `<option value="${v}" ${v===b.res?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <input class="b_note" placeholder="Observation (ex. : U(t+1h) au-dessus de la tension finale)" style="margin-top:6px" value="${esc(b.note||'')}">
      <div style="text-align:right;margin-top:6px"><button type="button" class="mini del b_del">Retirer</button></div>
    </div>`;
}

// Calculs automatiques de la ligne batteries
function batCompute(row){
  const num = sel => {
    const v = (row.querySelector(sel).value || '').trim().replace(',', '.');
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  };
  const cn = num('.b_cnom');   // capacité nominale (Ah)
  const un = num('.b_unom');   // tension nominale (V)
  const ia = num('.b_iabs');   // intensité absorbée (A)
  const ar = num('.b_areq');   // autonomie requise (h)
  const u0 = num('.b_ut0'), u1 = num('.b_ut1');

  // Capacité restante estimée (%) d'après U(t+1h), ou U(t0) si absente
  const soc = socFromU(u1 !== null ? u1 : u0, un || 12);
  if(soc !== null) row.querySelector('.b_cmes').value = String(soc);

  // Ah consommés pendant le test = I absorbée × 1 h
  const q = (ia !== null) ? ia * 1 : null;
  if(q !== null) row.querySelector('.b_q1h').value = String(Math.round(q * 100) / 100);

  // Autonomie estimée (h) = capacité restante (Ah) / I absorbée
  let aut = null;
  if(soc !== null && ia !== null && ia > 0 && cn && cn > 0){
    aut = (soc / 100 * cn) / ia;
    row.querySelector('.b_aut').value = String(Math.round(aut * 10) / 10);
  }

  // Proposition de résultat vs autonomie requise (sans écraser un choix manuel)
  const resSel = row.querySelector('.b_res');
  if(resSel.value === 'nonteste' || resSel.value === ''){
    if(aut !== null && ar && ar > 0){
      resSel.value = aut >= ar ? 'conforme' : (aut >= ar * 0.8 ? 'surveil' : 'remplacer');
    }
  }
}

function wireBatteryRow(row){
  row.querySelector('.b_del').onclick = () => row.remove();
  ['.b_iabs', '.b_cnom', '.b_unom', '.b_ut0', '.b_ut1', '.b_areq'].forEach(c =>
    row.querySelector(c).addEventListener('input', () => batCompute(row)));
  batCompute(row);
}

/* ---------- Synchronisation check-list → matériel testé ---------- */
function syncTestsToChecklist(){
  const link = modalBox.querySelector('input[name="f_linkmode"]:checked');
  if(!link || link.value !== 'base') return;
  const box = modalBox.querySelector('#testsBox');
  if(!box) return;
  const checked = [...modalBox.querySelectorAll('#f_eqBox .f_eqChk:checked')].map(c => c.value);
  const have = new Set([...box.querySelectorAll('.t_eq')].map(s => s.value));
  checked.forEach(id => {
    if(!have.has(id)){
      box.insertAdjacentHTML('beforeend', testRowHTML({ eqId:id, res:'nonteste' }));
      wireTestRow(box.lastElementChild);
      have.add(id);
    }
  });
  [...box.querySelectorAll('.testRow')].forEach(row => {
    const v = row.querySelector('.t_eq').value;
    if(v && v !== '__free__' && !checked.includes(v)){
      const edited = row.querySelector('.t_res').value !== 'nonteste'
                  || row.querySelector('.t_note').value.trim() !== '';
      if(!edited) row.remove();
    }
  });
}

/* ---------- Câblage & collecte ---------- */
function wireReportRows(){
  modalBox.querySelectorAll('.testRow').forEach(wireTestRow);
  modalBox.querySelectorAll('.batRow').forEach(wireBatteryRow);
  wireTestImport();
  modalBox.querySelector('#addTest').onclick = () => {
    const box = modalBox.querySelector('#testsBox');
    box.insertAdjacentHTML('beforeend', testRowHTML());
    wireTestRow(box.lastElementChild);
  };
  modalBox.querySelector('#addBattery').onclick = () => {
    const box = modalBox.querySelector('#batteriesBox');
    box.insertAdjacentHTML('beforeend', batteryRowHTML());
    wireBatteryRow(box.lastElementChild);
  };
}

function wireTestImport(){
  const siteSel = modalBox.querySelector('#t_impSite');
  const bldSel  = modalBox.querySelector('#t_impBld');

  const fillBlds = (keep) => {
    const bs = state.buildings.filter(b => b.siteId === siteSel.value);
    bldSel.innerHTML = '<option value="">Tout le site</option>'
      + bs.map(b => `<option value="${b.id}" ${b.id===keep?'selected':''}>${esc(b.name)}</option>`).join('');
  };

  const fSite = modalBox.querySelector('#f_site');
  const fBld  = modalBox.querySelector('#f_bld');
  if(fSite && fSite.value){ siteSel.value = fSite.value; fillBlds(fBld ? fBld.value : ''); }
  else fillBlds('');
  if(fSite){
    fSite.addEventListener('change', () => {
      if(fSite.value){ siteSel.value = fSite.value; fillBlds(fBld ? fBld.value : ''); }
    });
  }
  siteSel.onchange = () => fillBlds('');

  modalBox.querySelector('#importTests').onclick = () => {
    const sid = siteSel.value;
    if(!sid){ toast('Choisissez d’abord le site à importer.'); return; }
    const bid = bldSel.value;
    const list = state.equipment.filter(e => e.siteId === sid && (!bid || e.buildingId === bid));
    if(!list.length){ toast('Aucun matériel dans ce périmètre : ajoutez-en au registre d’abord.'); return; }
    const box = modalBox.querySelector('#testsBox');
    const existing = new Set([...box.querySelectorAll('.t_eq')].map(s => s.value));
    let added = 0, skipped = 0;
    list.forEach(e => {
      if(existing.has(e.id)){ skipped++; return; }
      box.insertAdjacentHTML('beforeend', testRowHTML({ eqId:e.id, res:'nonteste' }));
      wireTestRow(box.lastElementChild);
      existing.add(e.id);
      added++;
    });
    toast(`${added} matériel(s) importé(s)` + (skipped ? ` — ${skipped} déjà présent(s), non dupliqué(s)` : '') + '.', true);
  };
}

function collectTests(){
  const out = [];
  modalBox.querySelectorAll('.testRow').forEach(row => {
    const sel = row.querySelector('.t_eq');
    let eqId = null, label = '';
    if(sel.value === '__free__'){ label = row.querySelector('.t_free').value.trim(); }
    else if(sel.value){
      const e = state.equipment.find(x => x.id === sel.value);
      if(e){ eqId = e.id; label = eqFullLabel(e); }
    }
    const res = row.querySelector('.t_res').value || 'nonteste';
    const note = row.querySelector('.t_note').value.trim();
    if(label || note) out.push({ eqId, label, res, note });
  });
  return out;
}

function collectBatteries(){
  const out = [];
  modalBox.querySelectorAll('.batRow').forEach(row => {
    const g = c => row.querySelector(c).value.trim();
    const item = {
      mat:g('.b_mat'), bat:g('.b_bat'),
      cnom:g('.b_cnom'), unom:g('.b_unom'),
      vch:g('.b_vch'), ich:g('.b_ich'),
      iabs:g('.b_iabs'), ut0:g('.b_ut0'), ut1:g('.b_ut1'),
      areq:g('.b_areq'),
      cmes:g('.b_cmes'), aut:g('.b_aut'), q1h:g('.b_q1h'),
      res:g('.b_res') || 'nonteste', note:g('.b_note'),
    };
    if(item.mat || item.bat || item.cnom || item.unom || item.vch || item.ich ||
       item.iabs || item.ut0 || item.ut1 || item.areq || item.cmes || item.aut ||
       item.q1h || item.note) out.push(item);
  });
  return out;
}

/* ===== FIN DE reportrows.js ===== */