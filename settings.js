/* =====================================================================
   FIREWISE EQUIPMENT CARE — settings.js
   Réglages (sauvegardes, démonstration) et démarrage de l'application
===================================================================== */

/* ---------- 14. Vue : Réglages ---------- */
function renderSettings(v){
  v.innerHTML = `
    <div class="view-head"><div><h1>Réglages</h1><div class="sub">Données locales, sauvegardes et démonstration</div></div></div>
    <div class="dash-grid">
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="panel">
          <div class="panel-h"><h2>Sauvegarde & restauration</h2></div>
          <div class="panel-b" style="padding-top:14px">
            <p class="hint" style="margin-bottom:14px">Toutes les données (sites, matériel, catalogue marques/références, photos, rapports) sont stockées dans le navigateur, rien ne quitte cet appareil. Exportez régulièrement un fichier de sauvegarde.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn" id="stExpJson">Exporter la sauvegarde (.json)</button>
              <button class="btn" id="stImpJson">Importer une sauvegarde</button>
              <button class="btn" id="stExpCsv">Exporter le registre (.csv)</button>
              <input type="file" id="stFile" accept="application/json" style="display:none">
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h2>Zone sensible</h2></div>
          <div class="panel-b" style="padding-top:14px">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn" id="stDemo">Charger le jeu de démonstration</button>
              <button class="btn danger" id="stReset">Tout effacer</button>
            </div>
            <p class="hint" style="margin-top:12px">« Tout effacer » supprime définitivement sites, bâtiments, matériel, catalogue et rapports de cet appareil.</p>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>À propos</h2></div>
        <div class="panel-b" style="padding-top:14px;line-height:1.8;font-size:13px;color:var(--ink-2)">
          <p><b style="color:var(--ink)">Firewise Equipment Care — v1.1</b><br>
          Application autonome de gestion et de suivi du matériel SSI : registre hiérarchique, catalogue marques/références auto-alimenté, photos d’identification, rapports d’intervention signés, exports PDF et Word.</p>
          <p style="margin-top:10px">Bibliothèques via CDN (signature_pad, html2pdf.js, docx.js) · aucune donnée transmise à un serveur.</p>
          <p style="margin-top:10px">Astuce : sur Android, ouvrez cette application dans Chrome puis utilisez « Ajouter à l’écran d’accueil » pour l’utiliser comme une application.</p>
        </div>
      </div>
    </div>`;

  const download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  v.querySelector('#stExpJson').onclick = () => {
    download(new Blob([JSON.stringify(state, null, 2)], { type:'application/json' }),
      `sauvegarde-firewise-${todayISO()}.json`);
    toast('Sauvegarde exportée.', true);
  };
  const fileInput = v.querySelector('#stFile');
  v.querySelector('#stImpJson').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const f = fileInput.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try{
        const d = JSON.parse(rd.result);
        if(!d || !Array.isArray(d.sites) || !Array.isArray(d.equipment)) throw new Error('format');
        state = {
          sites:d.sites, buildings:d.buildings||[], equipment:d.equipment,
          reports:Array.isArray(d.reports) ? d.reports : [],
          catalog:Array.isArray(d.catalog) ? d.catalog : [],
        };
        save(); render(); toast('Sauvegarde importée.', true);
      }catch(e){ toast('Fichier invalide : import annulé.'); }
    };
    rd.readAsText(f);
  };
  v.querySelector('#stExpCsv').onclick = () => {
    const rows = [['Site','Bâtiment','Type','Marque','Référence','N° série','Localisation','Mise en service','État','Photo']];
    state.equipment.forEach(e => {
      const s = state.sites.find(x => x.id === e.siteId);
      const b = state.buildings.find(x => x.id === e.buildingId);
      rows.push([s?s.name:'', b?b.name:'', typeLabel(e.type), e.brand||'', e.model||'', e.serial||'',
        e.loc||'', e.mes||'', STATUS[e.status]||'', e.photo ? 'oui' : 'non']);
    });
    const csv = '\uFEFF' + rows.map(rw => rw.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    download(new Blob([csv], { type:'text/csv;charset=utf-8' }), `registre-ssi-${todayISO()}.csv`);
    toast('Registre exporté en CSV.', true);
  };
  v.querySelector('#stDemo').onclick = () => {
    confirmBox('Jeu de démonstration', 'Charger les données de démonstration SSI ? Elles remplaceront les données actuelles de cet appareil.', () => {
      state = { sites:[], buildings:[], equipment:[], reports:[], catalog:[] };
      seedDemo(); ui.siteId = null; ui.buildingId = null; ui.reportId = null;
      render(); toast('Jeu de démonstration chargé.', true);
    });
  };
  v.querySelector('#stReset').onclick = () => {
    confirmBox('Tout effacer', 'Cette action supprime <b>définitivement</b> toutes les données locales (y compris le catalogue et les photos). Continuer ?', () => {
      try{ localStorage.removeItem(LS_KEY); }catch(e){}
      state = { sites:[], buildings:[], equipment:[], reports:[], catalog:[] };
      ui.siteId = null; ui.buildingId = null; ui.reportId = null;
      render(); toast('Toutes les données ont été effacées.', true);
    });
  };
}

/* ---------- 15. Démarrage ---------- */
if(!load()) seedDemo();
render();

/* ===== FIN DE settings.js ===== */