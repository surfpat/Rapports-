/* =====================================================================
   FIREWISE EQUIPMENT CARE — core.js
   Utilitaires, référentiels SSI, état & persistance, catalogue
   marques/références, jeu de démo, modales
===================================================================== */

/* ---------- 1. Utilitaires ---------- */
const LS_KEY = 'firewise.v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Échappement HTML : toutes les données utilisateur passent par ici
function esc(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
const todayISO = () => new Date().toISOString().slice(0,10);
function fmtDate(iso){
  if(!iso) return '—';
  const [y,m,d] = String(iso).split('T')[0].split('-');
  return d ? `${d}/${m}/${y}` : iso;
}
function slug(s){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
}

function toast(msg, ok){
  const t = document.createElement('div');
  t.className = 'toast' + (ok ? ' ok' : '');
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

// Réduit une photo (caméra ou galerie) pour le stockage local : max 900px, JPEG
function compressImage(file, maxSide, quality){
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/jpeg', quality));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

// Petite plaque signalétique factice pour la démonstration
function fakePlate(lines){
  const cv = document.createElement('canvas');
  cv.width = 520; cv.height = 190;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#2b2e33'; ctx.fillRect(0, 0, 520, 190);
  ctx.strokeStyle = '#8f9296'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, 504, 174);
  ctx.fillStyle = '#c1272d'; ctx.fillRect(444, 24, 48, 48);
  lines.forEach((l, i) => {
    ctx.font = i === 0 ? 'bold 30px system-ui, sans-serif' : '20px system-ui, sans-serif';
    ctx.fillStyle = i === 0 ? '#ffffff' : '#b9bbbe';
    ctx.fillText(l, 28, 62 + i * 44);
  });
  return cv.toDataURL('image/jpeg', 0.8);
}

/* ---------- 2. Référentiels SSI (terminologie française) ---------- */
const TYPES_EQ = [
  // Détection incendie (SDI)
  ['cds','Centrale de détection incendie (CDS)'],
  ['trs','Tableau répétiteur de signalisation (TRS)'],
  ['det_fum','Détecteur de fumée'],
  ['det_the','Détecteur de chaleur / thermovélocimétrique'],
  ['det_fla','Détecteur de flamme'],
  ['det_lin','Détecteur linéaire (faisceau / thermique)'],
  ['det_asp','Détection par aspiration (type VESDA)'],
  ['dm','Déclencheur manuel (DM)'],
  // Mise en sécurité (CMSI)
  ['cmsi','CMSI / UCMAT — gestion de la mise en sécurité'],
  ['uga','UGA (Unité de Gestion des Alarmes)'],
  ['ta','Tableau d’alarme (TA / TAR)'],
  ['das','DAS (Dispositif Actionnaire de Sécurité)'],
  ['diff_son','Diffuseur sonore / avertisseur (AV)'],
  // Extinction automatique
  ['exgaz_cen','Extinction automatique à gaz — centrale / zone'],
  ['exgaz_bout','Batterie de bouteilles de gaz extincteur (CO₂, FM-200, Novec…)'],
  ['sprk','Extinction automatique par eau (sprinkleur)'],
  // Autres équipements liés au SSI
  ['desenf_dep','Désenfumage — exutoire / DEP / volet'],
  ['vent_des','Ventilateur de désenfumage'],
  ['pcf','Porte coupe-feu / compartimentage'],
  ['clapet','Clapet coupe-feu (gaine)'],
  ['col_sec','Colonne sèche'],
  ['col_charge','Colonne en charge'],
  ['ria','RIA (Robinet d’incendie armé)'],
  ['autre','Autre matériel SSI'],
];
const typeLabel = v => (TYPES_EQ.find(t => t[0] === v) || ['','Autre'])[1];

const STATUS = { service:'En service', verif:'À vérifier', hs:'Hors service' };
const statusBadge = s => `<span class="badge ${s==='service'?'ok':s==='verif'?'warn':'bad'}">${STATUS[s]||'—'}</span>`;

const REPORT_TYPES = { maintenance:'Maintenance', depannage:'Dépannage', mise:'Mise en service', journalier:'Rapport journalier' };

/* ---------- 2.b Profils de rapport : sections affichées selon le type ----------
   Chaque profil déclare :
   - label, sub  : titre + sous-titre du formulaire
   - sections    : tableau de clés de section (voir REPORT_SECTIONS ci-dessous)
   - intro       : texte d'aide affiché en haut du formulaire
   Le formulaire n'affiche QUE les sections du profil courant → adaptatif. */
const REPORT_SECTIONS = {
  // Identification / liaison registre : toujours présente (hors profil)
  info:        { title:'Informations générales',  ico:'i' },
  liaison:     { title:'Liaison au registre',     ico:'🔗' },
  equipement:  { title:'Matériel concerné & tests', ico:'✓', sub:'Cochez le matériel, saisissez le résultat et l’observation sur la même ligne.' },
  controle:    { title:'Contrôles & essais',     ico:'⚡', sub:'Tests réalisés, mesures, essais fonctionnels.' },
  batteries:   { title:'Mesures batteries',      ico:'🔋', sub:'Protocole NF S 61-930 — autonomie & capacité.' },
  diagnostic:  { title:'Diagnostic',             ico:'🔍', sub:'Cause, origine, analyse du défaut.' },
  actions:     { title:'Actions réalisées',      ico:'🛠', sub:'Intervention, réglages, remise en service.' },
  pieces:      { title:'Pièces remplacées',      ico:'⚙' },
  reception:   { title:'Réception d’installation', ico:'📋', sub:'État à réception, vérifications initiales.' },
  reglages:    { title:'Réglages & paramétrage', ico:'🎚', sub:'Configuration saisie, seuils, reports.' },
  formation:   { title:'Formation & remise',    ico:'📚', sub:'Formation utilisateur, documents remis.' },
  rondes:      { title:'Rondes & contrôles visuels', ico:'👁', sub:'États observés au cours de la journée.' },
  obs:         { title:'Observations / constat', ico:'📝' },
  anomalies:   { title:'Anomalies constatées',   ico:'⚠' },
  reco:        { title:'Recommandations',        ico:'💡' },
  nextVisit:   { title:'Prochaine visite',       ico:'📅' },
  signatures:  { title:'Signatures',             ico:'✍' },
};

const REPORT_PROFILES = {
  maintenance: {
    label:'Maintenance préventive',
    sub:'Contrôle périodique réglementaire du matériel SSI',
    sections:['info','liaison','equipement','controle','batteries','obs','anomalies','actions','pieces','reco','nextVisit','signatures'],
    intro:'Maintenance périodique — relevez le résultat des contrôles par matériel, les anomalies et les actions correctives.',
  },
  depannage: {
    label:'Dépannage',
    sub:'Intervention corrective suite à un défaut signalé',
    sections:['info','liaison','equipement','diagnostic','actions','pieces','controle','batteries','obs','anomalies','reco','nextVisit','signatures'],
    intro:'Dépannage — décrivez le défaut signalé, le diagnostic, l’intervention et le résultat après remise en service.',
  },
  mise: {
    label:'Mise en service',
    sub:'Réception et mise en service d’une installation neuve ou modifiée',
    sections:['info','liaison','reception','equipement','reglages','controle','batteries','obs','formation','reco','nextVisit','signatures'],
    intro:'Mise en service — réceptionnez l’installation, saisissez les réglages et les essais, puis la formation remise.',
  },
  journalier: {
    label:'Rapport journalier',
    sub:'Rondes et contrôles visuels de la journée',
    sections:['info','liaison','rondes','obs','anomalies','actions','reco','signatures'],
    intro:'Rapport journalier — consignez les rondes, les événements de la journée et les actions éventuelles.',
  },
};

/* Types de matériel impliquant une batterie de secours (section batteries pertinente) */
const BATTERY_EQ_TYPES = ['cds','cmsi','uga','ta','exgaz_cen','exgaz_bout','sprk'];

/* ---------- 3. État & persistance ---------- */
let state = { sites:[], buildings:[], equipment:[], reports:[], catalog:[] };
let ui = { view:'dashboard', siteId:null, buildingId:null, reportId:null, q:'', typeFilter:'' };

function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch(e){
    toast('Enregistrement impossible : stockage local saturé. La modification ne sera pas conservée après rechargement — exportez une sauvegarde JSON puis nettoyez les photos.');
    return false;
  }
  // Hook de synchronisation cloud (défini dans sync.js, chargé avant settings.js).
  // Garde-fou : si sync.js n'est pas chargé, on ne fait rien.
  if(typeof onSyncSave === 'function') onSyncSave();
  return true;
}
function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const d = JSON.parse(raw);
      state = {
        sites: Array.isArray(d.sites) ? d.sites : [],
        buildings: Array.isArray(d.buildings) ? d.buildings : [],
        equipment: Array.isArray(d.equipment) ? d.equipment : [],
        reports: Array.isArray(d.reports) ? d.reports : [],
        catalog: Array.isArray(d.catalog) ? d.catalog : [],
      };
      return true;
    }
  }catch(e){ /* données corrompues : on repart à vide */ }
  return false;
}

// Catalogue marques/références : alimenté automatiquement à chaque
// enregistrement de matériel, puis proposé dans les formulaires suivants
function addToCatalog(brand, model){
  const b = String(brand || '').trim();
  if(!b) return;
  let entry = state.catalog.find(c => String(c.b).toLowerCase() === b.toLowerCase());
  if(!entry){ entry = { b, refs: [] }; state.catalog.push(entry); }
  else entry.b = b; // conserve la casse la plus récente
  const m = String(model || '').trim();
  if(m && !entry.refs.some(r => String(r).toLowerCase() === m.toLowerCase())) entry.refs.push(m);
}

/* ---------- 4. Jeu de démonstration (premier lancement) ---------- */
function fakeSig(name){
  const cv = document.createElement('canvas');
  cv.width = 420; cv.height = 130;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = '#1e2022'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  let seed = 0; for(const c of name) seed += c.charCodeAt(0);
  ctx.beginPath();
  for(let x = 30; x <= 390; x += 4){
    const y = 65 + Math.sin(x/26 + seed) * 16 + Math.sin(x/9 + seed*1.7) * 6;
    x === 30 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(50, 92); ctx.bezierCurveTo(120, 60, 200, 118, 300, 78);
  ctx.stroke();
  return cv.toDataURL('image/png');
}

function seedDemo(){
  const s1 = uid(), s2 = uid(), b1 = uid(), b2 = uid(), b3 = uid(), b4 = uid();
  state.sites = [
    { id:s1, name:'Résidence Les Cèdres', address:'12 avenue du Parc', zip:'69007', city:'Lyon', contact:'Mme Laurent (syndic)', phone:'04 72 00 11 22' },
    { id:s2, name:'Usine Nord — Logistique', address:'ZI Nord, rue des Fonderies', zip:'59200', city:'Tourcoing', contact:'M. Diallo (HSE)', phone:'03 20 00 44 55' },
  ];
  state.buildings = [
    { id:b1, siteId:s1, name:'Bâtiment A — logements', note:'R+4, 42 lots' },
    { id:b2, siteId:s1, name:'Bâtiment B — parking', note:'Sous-sol, 2 niveaux' },
    { id:b3, siteId:s2, name:'Hall de production', note:'' },
    { id:b4, siteId:s2, name:'Local CMCF / technique', note:'' },
  ];
  state.catalog = [
    { b:'Bosch',   refs:['FPA-1200-U4','UGA intégrée FPA-1200'] },
    { b:'Siemens', refs:['TA — 24 zones'] },
    { b:'Apollo',  refs:['Détecteur Série 65'] },
    { b:'Hochiki', refs:['DM HRS'] },
    { b:'Aldes',   refs:['DEP 150'] },
    { b:'Kidde',   refs:['Centrale ExGas 4 zones','Batterie 6 × 40 L FM-200'] },
  ];
  state.equipment = [
    { id:uid(), siteId:s1, buildingId:b1, type:'ta',       brand:'Siemens', model:'TA — 24 zones',            serial:'TA-77431',  loc:'Cage d’escalier, RDC',   mes:'2022-01-25', status:'service' },
    { id:uid(), siteId:s1, buildingId:b1, type:'dm',       brand:'Hochiki', model:'DM HRS',                   serial:'DM-12A',    loc:'Palier 2e étage',        mes:'2022-01-25', status:'service', photo:fakePlate(['HOCHIKI DM HRS','NS DM-12A','Déclencheur manuel']) },
    { id:uid(), siteId:s1, buildingId:b1, type:'pcf',      brand:null,      model:'Porte CF 1h',              serial:'PCF-12A',   loc:'Cage d’escalier',        mes:'2018-06-15', status:'hs' },
    { id:uid(), siteId:s1, buildingId:b2, type:'col_sec',  brand:null,      model:'Colonne sèche DN100',      serial:'CS-5312',   loc:'Niveau -1, rampe A',     mes:'2023-02-08', status:'service' },
    { id:uid(), siteId:s2, buildingId:b3, type:'det_fum',  brand:'Apollo',  model:'Détecteur Série 65',       serial:'DF-33981',  loc:'Accès atelier 3',        mes:'2020-05-19', status:'service' },
    { id:uid(), siteId:s2, buildingId:b3, type:'desenf_dep',brand:'Aldes',  model:'DEP 150',                  serial:'DE-11873',  loc:'Toiture, zone B',        mes:'2021-10-30', status:'verif' },
    { id:uid(), siteId:s2, buildingId:b4, type:'cds',      brand:'Bosch',   model:'FPA-1200-U4',              serial:'FC-90214',  loc:'Local CMCF',             mes:'2022-01-25', status:'service', photo:fakePlate(['BOSCH FPA-1200-U4','NS FC-90214','Centrale de détection']) },
    { id:uid(), siteId:s2, buildingId:b4, type:'uga',      brand:'Bosch',   model:'UGA intégrée FPA-1200',    serial:'UG-90215',  loc:'Local CMCF',             mes:'2022-01-25', status:'service' },
    { id:uid(), siteId:s2, buildingId:b4, type:'exgaz_cen',brand:'Kidde',   model:'Centrale ExGas 4 zones',   serial:'EX-40112',  loc:'Salle machines',         mes:'2023-03-10', status:'service', photo:fakePlate(['KIDDE ExGas','NS EX-40112','Extinction gaz — 4 zones']) },
    { id:uid(), siteId:s2, buildingId:b4, type:'exgaz_bout',brand:'Kidde',  model:'Batterie 6 × 40 L FM-200', serial:'BT-40113',  loc:'Salle machines',         mes:'2023-03-10', status:'service' },
  ];
  const today = new Date();
  const dISO = d => d.toISOString().slice(0,10);
  state.reports = [{
    id:uid(), no:'RPT-' + today.getFullYear() + '-0001', type:'maintenance',
    date:dISO(new Date(today.getTime() - 6*864e5)), tech:'P. Morel', linkMode:'base',
    siteId:s2, buildingId:b4, equipmentId:state.equipment[6].id,
    equipmentIds:[state.equipment[6].id],
    equipmentList:['Centrale de détection incendie (CDS) Bosch FPA-1200-U4 (NS FC-90214) — Usine Nord — Logistique · Local CMCF / technique · Local CMCF'],
    tests:[{ eqId:state.equipment[6].id, label:eqFullLabel(state.equipment[6]), res:'conforme', note:'Boucles 1 à 4 testées, sensibilités conformes. Alimentation secourue vérifiée.' }],
    siteName:'Usine Nord — Logistique', buildingName:'Local CMCF / technique',
    equipmentDesc:'Centrale de détection incendie (CDS) Bosch FPA-1200-U4 (NS FC-90214)',
    obs:'Contrôle annuel de la centrale de détection : niveaux de sensibilité, tests de boucles, vérification de l’alimentation secourue et des reports au CMSI.',
    anomalies:'Détecteur de fumée de la boucle 2 (hall de production) signalant un défaut d’encrassement.',
    actions:'Nettoyage du détecteur concerné puis remplacement. Essais fonctionnels boucle 2 conformes après intervention.',
    pieces:[{d:'Détecteur de fumée Apollo Série 65', r:'55000-328', q:'1'}],
    reco:'Planifier le remplacement des détecteurs de la boucle 3 lors de la prochaine visite semestrielle.',
    nextVisit:dISO(new Date(today.getTime() + 180*864e5)),
    sigTech:fakeSig('P. Morel'), sigClient:fakeSig('M. Diallo'), createdAt:Date.now(),
  }];
  save();
}

/* ---------- 5. Modales génériques ---------- */
const overlay = document.getElementById('overlay');
const modalBox = document.getElementById('modalBox');

function openModal(title, bodyHTML, wide){
  modalBox.className = 'modal' + (wide ? ' wide' : '');
  modalBox.innerHTML = `
    <div class="modal-h"><h3>${esc(title)}</h3><button class="modal-x" id="mClose" title="Fermer">×</button></div>
    <div class="modal-b">${bodyHTML}</div>`;
  overlay.classList.add('open');
  document.getElementById('mClose').onclick = closeModal;
  return modalBox.querySelector('.modal-b');
}
function closeModal(){ overlay.classList.remove('open'); modalBox.innerHTML = ''; }
overlay.addEventListener('mousedown', e => { if(e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });

function confirmBox(title, msg, onOk){
  const body = openModal(title, `
    <p style="line-height:1.6;color:var(--ink-2)">${msg}</p>`);
  const foot = document.createElement('div');
  foot.className = 'modal-f';
  foot.innerHTML = `<button class="btn" id="cNo">Annuler</button><button class="btn primary" id="cYes">Confirmer</button>`;
  modalBox.appendChild(foot);
  foot.querySelector('#cNo').onclick = closeModal;
  foot.querySelector('#cYes').onclick = () => { closeModal(); onOk(); };
}

function formFooter(submitLabel){
  const foot = document.createElement('div');
  foot.className = 'modal-f';
  foot.innerHTML = `<button class="btn" id="fCancel">Annuler</button><button class="btn primary" id="fSubmit">${esc(submitLabel)}</button>`;
  modalBox.appendChild(foot);
  foot.querySelector('#fCancel').onclick = closeModal;
  return foot.querySelector('#fSubmit');
}
function markInvalid(el){ if(el){ el.classList.add('err'); el.focus(); } }