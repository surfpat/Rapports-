/* =====================================================================
   FIREWISE EQUIPMENT CARE — reportrows.js
   Sections dynamiques du rapport :
   - matériel concerné & tests : fusionné dans la check-list (reportform.js)
     → chaque ligne = [checkbox] + libellé + résultat + observation
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

/* ---------- Mesures batteries (protocole complet) ---------- */
function batteriesFieldsetHTML(r){
  const rows = (r.batteries && r.batteries.length ? r.batteries : [{}]);
  return `
    <fieldset class="fs"><legend>Mesures batteries — autonomie (NF S 61-930)</legend>
      <p class="hint" style="margin-bottom:10px">
        <b>Protocole (NF S 61-930) :</b> couper le secteur, relever le <b>courant absorbé</b> et la <b>tension au début (t0)</b>,
        puis la <b>tension après 1 h</b>. L'autonomie estimée et la capacité restante sont calculées automatiquement
        (table indicative bloc 12 V plomb) et comparées à l'autonomie requise. Se référer aux tables constructeur
        pour un contrôle certifié.
      </p>
      <div id="batteriesBox">${rows.map(b => batteryRowHTML(b)).join('')}</div>
      <div><button type="button" class="mini" id="addBattery">+ Ajouter des mesures</button></div>
    </fieldset>`;
}

function batteryRowHTML(b = {}){
  const ro = 'readonly style="background:#f2f1ef;color:var(--ink-2)"';
  return `
    <div class="batRow" style="border:1px solid var(--line);border-radius:6px;padding:10px;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:1fr 110px 110px;gap:8px">
        <input class="b_mat" placeholder="Matériel concerné (ex. : CDS boucles 1-2)" value="${esc(b.mat||'')}">
        <input class="b_cnom" inputmode="decimal" placeholder="Capacité (Ah)" value="${esc(b.cnom||'')}">
        <input class="b_unom" inputmode="decimal" placeholder="Tension (V)" value="${esc(b.unom||'')}">
      </div>
      <div style="margin:8px 0 4px;font-size:11px;color:var(--ink-3);font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Test — secteur coupé, 1 h</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <input class="b_iabs" inputmode="decimal" placeholder="Courant absorbé (A)" value="${esc(b.iabs||'')}">
        <input class="b_ut0" inputmode="decimal" placeholder="Tension début t0 (V)" value="${esc(b.ut0||'')}">
        <input class="b_ut1" inputmode="decimal" placeholder="Tension après 1 h (V)" value="${esc(b.ut1||'')}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 130px;gap:8px;margin-top:8px;align-items:center">
        <input class="b_areq" inputmode="decimal" placeholder="Autonomie requise (h)" value="${esc(b.areq||'')}">
        <input class="b_aut" ${ro} placeholder="Autonomie estimée (h) — auto" value="${esc(b.aut||'')}">
        <select class="b_res">
          <option value="nonteste" ${(!b.res || b.res === 'nonteste') ? 'selected' : ''}>Non testé</option>
          ${Object.entries(BATTERY_RESULTS).map(([v,l]) => `<option value="${v}" ${v===b.res?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 130px;gap:8px;margin-top:6px;align-items:center">
        <input class="b_note" placeholder="Observation" value="${esc(b.note||'')}">
        <input class="b_cmes" ${ro} placeholder="% restant — auto" value="${esc(b.cmes||'')}" style="text-align:right">
      </div>
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

/* ---------- Câblage & collecte ---------- */
function wireReportRows(){
  // Les lignes batteries (le matériel concerné & tests est câblé dans reportform.js)
  modalBox.querySelectorAll('.batRow').forEach(wireBatteryRow);
  modalBox.querySelector('#addBattery').onclick = () => {
    const box = modalBox.querySelector('#batteriesBox');
    box.insertAdjacentHTML('beforeend', batteryRowHTML());
    wireBatteryRow(box.lastElementChild);
  };
}

// Collecte du matériel concerné & tests depuis les lignes unifiées (#f_eqBox)
function collectTests(){
  const linkMode = (modalBox.querySelector('input[name="f_linkmode"]:checked') || {}).value;
  const out = [];
  modalBox.querySelectorAll('#f_eqBox .eqRow').forEach(row => {
    const eqId = row.dataset.eqid || null;
    if(eqId){
      // Ligne registre : incluse seulement en mode base et si cochée
      if(linkMode !== 'base') return;
      const chk = row.querySelector('.f_eqChk');
      if(chk && !chk.checked) return;
    }
    const res = row.querySelector('.t_res').value || 'nonteste';
    const note = row.querySelector('.t_note').value.trim();
    let label = '';
    if(eqId){
      const e = state.equipment.find(x => x.id === eqId);
      if(e) label = eqFullLabel(e);
    } else {
      label = row.querySelector('.t_free').value.trim();
    }
    if(label || note) out.push({ eqId, label, res, note });
  });
  return out;
}

function collectBatteries(){
  const out = [];
  modalBox.querySelectorAll('.batRow').forEach(row => {
    const g = c => row.querySelector(c).value.trim();
    const item = {
      mat:g('.b_mat'),
      cnom:g('.b_cnom'), unom:g('.b_unom'),
      iabs:g('.b_iabs'), ut0:g('.b_ut0'), ut1:g('.b_ut1'),
      areq:g('.b_areq'),
      cmes:g('.b_cmes'), aut:g('.b_aut'),
      res:g('.b_res') || 'nonteste', note:g('.b_note'),
    };
    if(item.mat || item.cnom || item.unom || item.iabs || item.ut0 || item.ut1 ||
       item.areq || item.cmes || item.aut || item.note) out.push(item);
  });
  return out;
}

/* ===== FIN DE reportrows.js ===== */
