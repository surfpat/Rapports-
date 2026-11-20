/* =====================================================================
   FIREWISE EQUIPMENT CARE — sync.js
   Synchronisation multi-backend : WebDAV, endpoint HTTP, GitHub Gist
   ---------------------------------------------------------------------
   Note protocole : les navigateurs modernes (Chrome 86+, Firefox 88+,
   Safari 14+) ont retiré le support du protocole FTP dans fetch().
   WebDAV couvre la majorité des besoins « FTP-like » : Nextcloud,
   ownCloud, Synology Drive, Box, Koofr, pCloud, etc. GitHub Gist offre
   une option « sans serveur ».

   Sécurité : les credentials et la passphrase sont stockés dans
   localStorage (clé `firewise.sync`), séparés des données applicatives.
   Chiffrement optionnel AES-GCM + PBKDF2 côté client : le payload
   envoyé sur le réseau est alors illisible sans la passphrase.
   ===================================================================== */

const SYNC_KEY = 'firewise.sync';

const SYNC_BACKENDS = [
  { id:'webdav', label:'WebDAV',    desc:'Nextcloud, ownCloud, Synology Drive, Box, Koofr…' },
  { id:'http',   label:'HTTP',      desc:'Endpoint personnel : GET (lecture) + PUT (écriture)' },
  { id:'gist',   label:'GitHub Gist', desc:'Sans serveur — token GitHub, gist privé' },
];

const SYNC_DEFAULTS = {
  enabled:false,
  backend:'webdav',
  encrypt:false,
  passphrase:'',
  autoSync:false,
  autoSyncDelay:30,
  lastSync:0,
  lastDirection:'',
  lastError:'',
  deviceId:'',
  // WebDAV
  webdavUrl:'',
  webdavUser:'',
  webdavPass:'',
  // HTTP
  httpUrl:'',
  httpToken:'',
  // Gist
  gistToken:'',
  gistId:'',
  gistFilename:'firewise-backup.json',
};

let syncConfig = null;
let _syncTimer = null;
let _syncBusy = false;

function loadSync(){
  try{
    const raw = localStorage.getItem(SYNC_KEY);
    syncConfig = Object.assign({}, SYNC_DEFAULTS, raw ? JSON.parse(raw) : {});
  }catch(e){ syncConfig = Object.assign({}, SYNC_DEFAULTS); }
  if(!syncConfig.deviceId){
    syncConfig.deviceId = 'dev-' + uid();
    try{ localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig)); }catch(e){}
  }
  return syncConfig;
}
function saveSyncConfig(){
  try{ localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig)); }catch(e){}
}

/* ---------- Sérialisation payload ---------- */
function syncSerialize(){
  return JSON.stringify({
    app:'firewise',
    v:1,
    syncedAt: Date.now(),
    deviceId: syncConfig.deviceId,
    data: state,
  });
}

/* ---------- Chiffrement optionnel (AES-GCM + PBKDF2) ---------- */
async function syncDeriveKey(passphrase, salt){
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations:120000, hash:'SHA-256' },
    km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
function _b64(buf){
  const b = new Uint8Array(buf);
  let s = ''; for(let i=0;i<b.length;i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function _unb64(str){
  const s = atob(str);
  const b = new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) b[i] = s.charCodeAt(i);
  return b;
}
async function syncEncrypt(jsonStr){
  if(!syncConfig.encrypt || !syncConfig.passphrase) return jsonStr;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await syncDeriveKey(syncConfig.passphrase, salt);
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(jsonStr));
  return JSON.stringify({ enc:true, salt:_b64(salt), iv:_b64(iv), ct:_b64(ct) });
}
async function syncDecrypt(str){
  let obj;
  try{ obj = JSON.parse(str); }catch(e){ return str; } // payload brut non-JSON
  if(!obj || obj.enc !== true) return str;             // pas chiffré
  if(!syncConfig.passphrase) throw new Error('Passphrase requise pour déchiffrer le distant.');
  const salt = _unb64(obj.salt), iv = _unb64(obj.iv);
  const key = await syncDeriveKey(syncConfig.passphrase, salt);
  try{
    const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, _unb64(obj.ct));
    return new TextDecoder().decode(pt);
  }catch(e){ throw new Error('Déchiffrement impossible : passphrase erronée ou payload corrompu.'); }
}

/* ---------- Backends : abstraction GET / PUT ---------- */
async function backendWebDAVGet(){
  if(!syncConfig.webdavUrl) throw new Error('URL WebDAV manquante.');
  const headers = {};
  if(syncConfig.webdavUser)
    headers['Authorization'] = 'Basic ' + btoa(unescape(encodeURIComponent(syncConfig.webdavUser + ':' + syncConfig.webdavPass)));
  const r = await fetch(syncConfig.webdavUrl, { method:'GET', headers });
  if(r.status === 404) return null;
  if(!r.ok) throw new Error('WebDAV GET → ' + r.status + ' ' + r.statusText);
  return await r.text();
}
async function backendWebDAVPut(body){
  if(!syncConfig.webdavUrl) throw new Error('URL WebDAV manquante.');
  const headers = { 'Content-Type':'application/json' };
  if(syncConfig.webdavUser)
    headers['Authorization'] = 'Basic ' + btoa(unescape(encodeURIComponent(syncConfig.webdavUser + ':' + syncConfig.webdavPass)));
  // Créer le dossier parent si nécessaire (best-effort, on ignore l'échec)
  try{
    const u = new URL(syncConfig.webdavUrl, location.href);
    const parts = u.pathname.split('/').filter(Boolean);
    if(parts.length > 1){
      for(let i = 1; i < parts.length; i++){
        const dir = u.origin + '/' + parts.slice(0, i).join('/') + '/';
        await fetch(dir, { method:'MKCOL', headers }).catch(()=>{});
      }
    }
  }catch(e){ /* ignore */ }
  const r = await fetch(syncConfig.webdavUrl, { method:'PUT', headers, body });
  if(!r.ok) throw new Error('WebDAV PUT → ' + r.status + ' ' + r.statusText);
}

async function backendHTTPGet(){
  if(!syncConfig.httpUrl) throw new Error('URL HTTP manquante.');
  const headers = {};
  if(syncConfig.httpToken) headers['Authorization'] = 'Bearer ' + syncConfig.httpToken;
  const r = await fetch(syncConfig.httpUrl, { method:'GET', headers });
  if(r.status === 404) return null;
  if(!r.ok) throw new Error('HTTP GET → ' + r.status);
  const txt = await r.text();
  // Le serveur peut renvoyer le payload brut, ou { data:"..." }
  try{
    const j = JSON.parse(txt);
    if(j && typeof j === 'object' && typeof j.data === 'string') return j.data;
  }catch(e){ /* payload brut */ }
  return txt;
}
async function backendHTTPPut(body){
  if(!syncConfig.httpUrl) throw new Error('URL HTTP manquante.');
  const headers = { 'Content-Type':'application/json' };
  if(syncConfig.httpToken) headers['Authorization'] = 'Bearer ' + syncConfig.httpToken;
  const r = await fetch(syncConfig.httpUrl, { method:'PUT', headers, body });
  if(!r.ok) throw new Error('HTTP PUT → ' + r.status);
}

async function backendGistGet(){
  if(!syncConfig.gistToken) throw new Error('Token GitHub manquant.');
  const fn = syncConfig.gistFilename || 'firewise-backup.json';
  if(!syncConfig.gistId){
    // Rechercher un gist existant portant notre nom de fichier
    const r = await fetch('https://api.github.com/gists?per_page=100', {
      headers:{ 'Authorization':'Bearer ' + syncConfig.gistToken, 'Accept':'application/vnd.github+json' }
    });
    if(!r.ok) throw new Error('Gist list → ' + r.status);
    const gists = await r.json();
    const found = (gists || []).find(g => g.files && g.files[fn]);
    if(found){ syncConfig.gistId = found.id; saveSyncConfig(); }
    else return null;
  }
  const r = await fetch('https://api.github.com/gists/' + syncConfig.gistId, {
    headers:{ 'Authorization':'Bearer ' + syncConfig.gistToken, 'Accept':'application/vnd.github+json' }
  });
  if(r.status === 404){ syncConfig.gistId = ''; saveSyncConfig(); return null; }
  if(!r.ok) throw new Error('Gist GET → ' + r.status);
  const g = await r.json();
  const f = g.files && g.files[fn];
  if(!f || !f.content) return null;
  return f.content;
}
async function backendGistPut(body){
  if(!syncConfig.gistToken) throw new Error('Token GitHub manquant.');
  const fn = syncConfig.gistFilename || 'firewise-backup.json';
  const headers = { 'Authorization':'Bearer ' + syncConfig.gistToken, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' };
  if(syncConfig.gistId){
    const r = await fetch('https://api.github.com/gists/' + syncConfig.gistId, {
      method:'PATCH', headers,
      body: JSON.stringify({ files:{ [fn]:{ content: body } } })
    });
    if(!r.ok) throw new Error('Gist PATCH → ' + r.status);
  } else {
    const r = await fetch('https://api.github.com/gists', {
      method:'POST', headers,
      body: JSON.stringify({ description:'Firewise Equipment Care — sauvegarde', public:false, files:{ [fn]:{ content: body } } })
    });
    if(!r.ok) throw new Error('Gist POST → ' + r.status);
    const g = await r.json();
    syncConfig.gistId = g.id; saveSyncConfig();
  }
}

function backendGet(){
  if(syncConfig.backend === 'webdav') return backendWebDAVGet();
  if(syncConfig.backend === 'http')   return backendHTTPGet();
  if(syncConfig.backend === 'gist')   return backendGistGet();
  return Promise.reject(new Error('Aucun backend configuré.'));
}
function backendPut(body){
  if(syncConfig.backend === 'webdav') return backendWebDAVPut(body);
  if(syncConfig.backend === 'http')   return backendHTTPPut(body);
  if(syncConfig.backend === 'gist')   return backendGistPut(body);
  return Promise.reject(new Error('Aucun backend configuré.'));
}

/* ---------- Test de connexion ---------- */
async function syncTest(){
  if(syncConfig.backend === 'gist' && !syncConfig.gistId){
    if(!syncConfig.gistToken) throw new Error('Token GitHub manquant.');
    const r = await fetch('https://api.github.com/user', { headers:{ 'Authorization':'Bearer ' + syncConfig.gistToken } });
    if(!r.ok) throw new Error('Token GitHub invalide (' + r.status + ').');
    const u = await r.json();
    // Cherche ensuite un gist existant
    const txt = await backendGistGet();
    if(txt === null) return 'Token OK (utilisateur : ' + (u.login||'?') + '). Aucun backup distant — premier push à faire.';
    return _probeRemote(txt, 'utilisateur ' + (u.login||'?'));
  }
  const txt = await backendGet();
  if(txt === null) return 'Connexion OK — aucun backup distant trouvé (premier push à effectuer).';
  return _probeRemote(txt, '');
}
async function _probeRemote(txt, extra){
  let obj = null;
  try{ const dec = await syncDecrypt(txt); obj = JSON.parse(dec); }
  catch(e){ throw new Error('Backup distant illisible : ' + e.message); }
  if(!obj || obj.app !== 'firewise') throw new Error('Le distant contient un fichier non-Firewise.');
  const when = new Date(obj.syncedAt).toLocaleString('fr-FR');
  const dev = obj.deviceId ? ('appareil ' + String(obj.deviceId).slice(0,10) + '…') : 'appareil inconnu';
  return 'Connexion OK — backup distant trouvé (sync ' + when + ', ' + dev + (extra ? ', ' + extra : '') + ').';
}

/* ---------- Push / Pull ---------- */
async function syncPush(force){
  syncConfig.lastError = '';
  // Récupérer le distant pour détecter un conflit (un autre appareil a poussé depuis notre dernière synchro)
  let remoteStr = null, remote = null;
  try{ remoteStr = await backendGet(); }catch(e){ /* 404 ou erreur réseau — non fatal pour un premier push */ }
  if(remoteStr !== null){
    try{ const dec = await syncDecrypt(remoteStr); remote = JSON.parse(dec); }
    catch(e){ throw new Error('Distant illisible (passphrase différente ?) : ' + e.message); }
  }
  if(!force && remote && remote.syncedAt && remote.deviceId !== syncConfig.deviceId
     && remote.syncedAt > syncConfig.lastSync){
    const diffMin = Math.max(1, Math.round((Date.now() - remote.syncedAt) / 60000));
    const e = new Error('Conflit : le distant a été modifié par un autre appareil il y a environ ' + diffMin + ' min. Pousser écrasera ces modifications.');
    e.conflict = true; e.remote = remote;
    throw e;
  }
  const body = await syncEncrypt(syncSerialize());
  await backendPut(body);
  syncConfig.lastSync = Date.now();
  syncConfig.lastDirection = 'push';
  saveSyncConfig();
  return true;
}

async function syncPull(){
  syncConfig.lastError = '';
  const remoteStr = await backendGet();
  if(remoteStr === null) throw new Error('Aucun backup distant trouvé. Effectuez d\'abord un push depuis cet appareil.');
  const dec = await syncDecrypt(remoteStr);
  const obj = JSON.parse(dec);
  if(!obj || obj.app !== 'firewise') throw new Error('Le distant n\'est pas un backup Firewise.');
  if(!obj.data || !Array.isArray(obj.data.sites)) throw new Error('Payload distant invalide.');
  state = {
    sites: obj.data.sites || [],
    buildings: obj.data.buildings || [],
    equipment: obj.data.equipment || [],
    reports: obj.data.reports || [],
    catalog: obj.data.catalog || [],
  };
  save();
  syncConfig.lastSync = obj.syncedAt || Date.now();
  syncConfig.lastDirection = 'pull';
  saveSyncConfig();
  return true;
}

/* ---------- Auto-sync : appelé après chaque save() local ---------- */
function scheduleAutoSync(){
  if(!syncConfig || !syncConfig.enabled || !syncConfig.autoSync) return;
  if(_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    _syncTimer = null;
    if(_syncBusy) return;
    _syncBusy = true;
    try{
      await syncPush(true); // auto-sync = force (pas de prompt de conflit)
    }catch(e){
      syncConfig.lastError = (e && e.message) || String(e);
      saveSyncConfig();
    }finally{ _syncBusy = false; }
  }, Math.max(5, syncConfig.autoSyncDelay || 30) * 1000);
}
// Hook appelé par core.save() après persistance locale
function onSyncSave(){ scheduleAutoSync(); }

/* ---------- UI : panneau de Réglages ---------- */
function renderSyncPanelHTML(){
  const c = syncConfig;
  const lastTxt = c.lastSync ? new Date(c.lastSync).toLocaleString('fr-FR') : 'jamais';
  const dirTxt = c.lastDirection === 'push' ? '↑ Poussé' : c.lastDirection === 'pull' ? '↓ Tiré' : '—';
  const err = c.lastError
    ? `<div class="sync-err">⚠ ${esc(c.lastError)}</div>` : '';
  const desc = (SYNC_BACKENDS.find(b => b.id === c.backend) || {}).desc || '';

  return `<div class="panel" id="syncPanel">
    <div class="panel-h"><h2>Synchronisation cloud</h2></div>
    <div class="panel-b" style="padding-top:14px">
      <p class="hint" style="margin-bottom:14px">
        Synchronisez vos données entre plusieurs appareils via WebDAV, un endpoint HTTP,
        ou GitHub Gist. <b>Le protocole FTP pur n'est plus supporté par les navigateurs
        modernes</b> (Chrome, Firefox, Safari l'ont retiré de <code>fetch</code>) —
        WebDAV couvre Nextcloud, ownCloud, Synology Drive, Box, Koofr…
      </p>

      <label class="fld fld-row">
        <span>Activer la synchronisation</span>
        <input type="checkbox" id="syncEnabled" ${c.enabled?'checked':''}>
      </label>

      <div class="fld">
        <span>Backend</span>
        <div class="seg">
          ${SYNC_BACKENDS.map(b => `<button type="button" class="seg-btn ${c.backend===b.id?'active':''}" data-be="${b.id}">${b.label}</button>`).join('')}
        </div>
        <span class="hint">${esc(desc)}</span>
      </div>

      <div id="syncFields">${renderSyncFieldsHTML()}</div>

      <label class="fld fld-row">
        <span>Chiffrer la sauvegarde (AES-GCM + passphrase)</span>
        <input type="checkbox" id="syncEnc" ${c.encrypt?'checked':''}>
      </label>
      <div class="fld" id="syncPassFld" style="${c.encrypt?'':'display:none'}">
        <span>Passphrase</span>
        <input type="password" id="syncPass" value="${esc(c.passphrase)}" placeholder="Phrase secrète" autocomplete="new-password">
      </div>

      <label class="fld fld-row">
        <span>Synchronisation automatique après chaque modification</span>
        <input type="checkbox" id="syncAuto" ${c.autoSync?'checked':''}>
      </label>
      <div class="fld" id="syncDelayFld" style="${c.autoSync?'':'display:none'}">
        <span>Délai avant synchro (secondes)</span>
        <input type="number" id="syncDelay" value="${c.autoSyncDelay||30}" min="5" max="600" style="max-width:120px">
      </div>

      <div class="sync-status">
        <div><span class="lab">Dernière synchro</span><b>${esc(lastTxt)}</b></div>
        <div><span class="lab">Sens</span><b>${dirTxt}</b></div>
        <div><span class="lab">Appareil</span><b title="${esc(c.deviceId)}">${esc(String(c.deviceId).slice(0,12))}…</b></div>
      </div>
      ${err}

      <div class="sync-actions">
        <button type="button" class="btn" id="syncTest">Tester</button>
        <button type="button" class="btn" id="syncPull">↓ Tirer</button>
        <button type="button" class="btn primary" id="syncPush">↑ Pousser</button>
      </div>
    </div>
  </div>`;
}

function renderSyncFieldsHTML(){
  const c = syncConfig;
  if(c.backend === 'webdav'){
    return `
      <div class="fld">
        <span>URL du fichier WebDAV (https://…)</span>
        <input type="url" id="syncWebdavUrl" value="${esc(c.webdavUrl)}" placeholder="https://cloud.exemple.fr/remote.php/dav/files/user/Firewise/firewise-backup.json">
      </div>
      <div class="fld">
        <span>Utilisateur <span class="hint" style="display:inline">(optionnel si URL publique)</span></span>
        <input type="text" id="syncWebdavUser" value="${esc(c.webdavUser)}" autocomplete="off">
      </div>
      <div class="fld">
        <span>Mot de passe / token d'application</span>
        <input type="password" id="syncWebdavPass" value="${esc(c.webdavPass)}" autocomplete="new-password">
      </div>
      <p class="hint">Nextcloud : Préférences → Sécurité → « Mot de passe d'application ».<br>
      Synology : DSM → File Station → partage WebDAV activé.</p>`;
  }
  if(c.backend === 'http'){
    return `
      <div class="fld">
        <span>URL endpoint HTTP</span>
        <input type="url" id="syncHttpUrl" value="${esc(c.httpUrl)}" placeholder="https://serveur.fr/api/firewise">
      </div>
      <div class="fld">
        <span>Token Bearer <span class="hint" style="display:inline">(optionnel)</span></span>
        <input type="password" id="syncHttpToken" value="${esc(c.httpToken)}" autocomplete="new-password">
      </div>
      <p class="hint">Le serveur doit accepter <code>GET</code> (renvoie le payload JSON) et
      <code>PUT</code> (reçoit le payload JSON dans le corps).</p>`;
  }
  if(c.backend === 'gist'){
    return `
      <div class="fld">
        <span>Token GitHub (Personal Access Token, scope « gist » uniquement)</span>
        <input type="password" id="syncGistToken" value="${esc(c.gistToken)}" autocomplete="new-password" placeholder="ghp_…">
      </div>
      <div class="fld">
        <span>ID du Gist <span class="hint" style="display:inline">(vide = créé automatiquement au 1er push)</span></span>
        <input type="text" id="syncGistId" value="${esc(c.gistId)}" placeholder="auto">
      </div>
      <div class="fld">
        <span>Nom de fichier</span>
        <input type="text" id="syncGistFn" value="${esc(c.gistFilename)}">
      </div>
      <p class="hint">Créez un token sur <code>github.com/settings/tokens</code> (cochez seulement « gist »).
      Le gist est créé <b>privé</b>. Limite GitHub : ~1 Mo par fichier.</p>`;
  }
  return '';
}

function bindSyncPanel(v){
  const wrap = v.querySelector('#syncPanel');
  if(!wrap) return;

  const readFields = () => {
    syncConfig.enabled   = v.querySelector('#syncEnabled').checked;
    syncConfig.autoSync  = v.querySelector('#syncAuto').checked;
    syncConfig.encrypt   = v.querySelector('#syncEnc').checked;
    syncConfig.autoSyncDelay = parseInt((v.querySelector('#syncDelay')||{}).value, 10) || 30;
    syncConfig.passphrase = (v.querySelector('#syncPass')||{}).value || '';
    if(syncConfig.backend === 'webdav'){
      syncConfig.webdavUrl  = (v.querySelector('#syncWebdavUrl')||{}).value || '';
      syncConfig.webdavUser = (v.querySelector('#syncWebdavUser')||{}).value || '';
      syncConfig.webdavPass = (v.querySelector('#syncWebdavPass')||{}).value || '';
    } else if(syncConfig.backend === 'http'){
      syncConfig.httpUrl   = (v.querySelector('#syncHttpUrl')||{}).value || '';
      syncConfig.httpToken = (v.querySelector('#syncHttpToken')||{}).value || '';
    } else if(syncConfig.backend === 'gist'){
      syncConfig.gistToken    = (v.querySelector('#syncGistToken')||{}).value || '';
      syncConfig.gistId       = (v.querySelector('#syncGistId')||{}).value || '';
      syncConfig.gistFilename = (v.querySelector('#syncGistFn')||{}).value || 'firewise-backup.json';
    }
    saveSyncConfig();
  };

  // Persistance live des champs
  wrap.addEventListener('input', () => readFields());
  wrap.addEventListener('change', () => readFields());

  // Sélecteur de backend
  wrap.querySelectorAll('[data-be]').forEach(btn => {
    btn.onclick = () => {
      readFields();
      syncConfig.backend = btn.dataset.be;
      saveSyncConfig();
      refreshSyncPanel(v);
    };
  });

  // Révélation conditionnelle
  const toggleReveal = () => {
    const enc = v.querySelector('#syncEnc');
    const auto = v.querySelector('#syncAuto');
    if(enc) v.querySelector('#syncPassFld').style.display = enc.checked ? '' : 'none';
    if(auto) v.querySelector('#syncDelayFld').style.display = auto.checked ? '' : 'none';
  };
  const enc = v.querySelector('#syncEnc');   if(enc) enc.onchange = toggleReveal;
  const auto = v.querySelector('#syncAuto'); if(auto) auto.onchange = toggleReveal;

  // Actions
  const runAsync = async (btn, fn) => {
    readFields();
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '…';
    try{ await fn(); }
    finally{ btn.disabled = false; btn.textContent = orig; }
  };

  wrap.querySelector('#syncTest').onclick = (ev) => runAsync(ev.currentTarget, async () => {
    try{
      const m = await syncTest();
      syncConfig.lastError = ''; saveSyncConfig();
      toast(m, true);
      refreshSyncPanel(v);
    }catch(e){
      syncConfig.lastError = e.message || String(e); saveSyncConfig();
      toast('Test échoué : ' + (e.message||e));
      refreshSyncPanel(v);
    }
  });

  wrap.querySelector('#syncPush').onclick = (ev) => runAsync(ev.currentTarget, async () => {
    try{
      await syncPush(false);
      toast('Sauvegarde poussée vers le cloud.', true);
      refreshSyncPanel(v);
    }catch(e){
      if(e.conflict){
        confirmBox('Conflit de synchronisation',
          (e.message||'') + '<br><br><b>Écraser le distant</b> avec les données locales ?',
          async () => {
            try{
              await syncPush(true);
              toast('Sauvegarde poussée (écrasement forcé).', true);
              refreshSyncPanel(v);
            }catch(e2){
              syncConfig.lastError = e2.message || String(e2); saveSyncConfig();
              toast('Push échoué : ' + (e2.message||e2));
              refreshSyncPanel(v);
            }
          });
      }else{
        syncConfig.lastError = e.message || String(e); saveSyncConfig();
        toast('Push échoué : ' + (e.message||e));
        refreshSyncPanel(v);
      }
    }
  });

  wrap.querySelector('#syncPull').onclick = (ev) => {
    confirmBox('Tirer la sauvegarde',
      'Remplacer les données locales par celles du cloud ? Les modifications locales non synchronisées seront perdues.',
      async () => {
        await runAsync(ev.currentTarget, async () => {
          try{
            await syncPull();
            toast('Sauvegarde tirée depuis le cloud.', true);
            render(); // recharge toutes les vues (l'état a changé)
          }catch(e){
            syncConfig.lastError = e.message || String(e); saveSyncConfig();
            toast('Pull échoué : ' + (e.message||e));
            refreshSyncPanel(v);
          }
        });
      });
  };
}

function refreshSyncPanel(v){
  const old = v.querySelector('#syncPanel');
  if(!old) return;
  old.outerHTML = renderSyncPanelHTML();
  bindSyncPanel(v);
}

// Chargement initial de la config sync (avant le démarrage de l'app)
loadSync();

/* ===== FIN DE sync.js ===== */
