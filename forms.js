/* =====================================================================
   FIREWISE EQUIPMENT CARE — forms.js
   Formulaires : site, bâtiment, matériel
   Les marques/références saisies alimentent automatiquement le
   catalogue et sont proposées dans les formulaires suivants.
===================================================================== */

/* ---------- 9. Formulaires : site / bâtiment ---------- */
function openSiteForm(siteId){
  const s = state.sites.find(x => x.id === siteId) || {};
  openModal(s.id ? 'Modifier le site' : 'Nouveau site', `
    <div class="fgrid">
      <div class="field full"><label>Nom du site *</label><input id="f_name" value="${esc(s.name||'')}"></div>
      <div class="field full"><label>Adresse</label><input id="f_addr" value="${esc(s.address||'')}"></div>
      <div class="field"><label>Code postal</label><input id="f_zip" value="${esc(s.zip||'')}"></div>
      <div class="field"><label>Ville</label><input id="f_city" value="${esc(s.city||'')}"></div>
      <div class="field"><label>Contact sur site</label><input id="f_contact" value="${esc(s.contact||'')}"></div>
      <div class="field"><label>Téléphone</label><input id="f_phone" value="${esc(s.phone||'')}"></div>
    </div>`);
  const submit = formFooter(s.id ? 'Enregistrer' : 'Créer le site');
  submit.onclick = () => {
    const name = document.getElementById('f_name').value.trim();
    if(!name){ markInvalid(document.getElementById('f_name')); return toast('Le nom du site est obligatoire.'); }
    const data = {
      name, address:document.getElementById('f_addr').value.trim(),
      zip:document.getElementById('f_zip').value.trim(), city:document.getElementById('f_city').value.trim(),
      contact:document.getElementById('f_contact').value.trim(), phone:document.getElementById('f_phone').value.trim(),
    };
    if(s.id) Object.assign(state.sites.find(x => x.id === s.id), data);
    else { const ns = { id:uid(), ...data }; state.sites.push(ns); ui.siteId = ns.id; }
    save(); closeModal(); render(); toast(s.id ? 'Site mis à jour.' : 'Site créé.', true);
  };
}

function openBuildingForm(siteId){
  const opts = state.sites.map(s => `<option value="${s.id}" ${s.id===siteId?'selected':''}>${esc(s.name)}</option>`).join('');
  openModal('Nouveau bâtiment', `
    <div class="fgrid">
      <div class="field"><label>Site *</label><select id="f_site">${opts}</select></div>
      <div class="field"><label>Nom du bâtiment *</label><input id="f_name"></div>
      <div class="field full"><label>Note (niveaux, particularités…)</label><textarea id="f_note"></textarea></div>
    </div>`);
  const submit = formFooter('Créer le bâtiment');
  submit.onclick = () => {
    const siteSel = document.getElementById('f_site').value;
    const name = document.getElementById('f_name').value.trim();
    if(!name){ markInvalid(document.getElementById('f_name')); return toast('Le nom du bâtiment est obligatoire.'); }
    state.buildings.push({ id:uid(), siteId:siteSel, name, note:document.getElementById('f_note').value.trim() });
    ui.siteId = siteSel; save(); closeModal(); render(); toast('Bâtiment créé.', true);
  };
}

/* ---------- 9b. Formulaire matériel : catalogue + photo ---------- */
function openEquipmentForm(eqId){
  const e = state.equipment.find(x => x.id === eqId) || {};
  const selSite = e.siteId || (ui.siteId && state.sites.find(s => s.id === ui.siteId) ? ui.siteId : (state.sites[0]||{}).id);
  const bldOpts = sid => state.buildings.filter(b => b.siteId === sid)
    .map(b => `<option value="${b.id}" ${b.id===e.buildingId?'selected':''}>${esc(b.name)}</option>`).join('') || '<option value="">—</option>';

  // Catalogue marques/références connues (+ celle du matériel édité si absente)
  const brands = state.catalog.map(c => ({ b:c.b, refs:[...c.refs] }));
  if(e.brand && !brands.some(c => String(c.b).toLowerCase() === String(e.brand).toLowerCase()))
    brands.unshift({ b:e.brand, refs:e.model ? [e.model] : [] });
  brands.sort((a,b) => a.b.localeCompare(b.b, 'fr'));

  let photoData = e.photo || null;

  openModal(e.id ? 'Modifier le matériel' : 'Nouveau matériel', `
    <div class="fgrid">
      <div class="field"><label>Site *</label><select id="f_site">${state.sites.map(s => `<option value="${s.id}" ${s.id===selSite?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Bâtiment *</label><select id="f_bld">${bldOpts(selSite)}</select></div>
      <div class="field"><label>Type de matériel *</label><select id="f_type">${TYPES_EQ.map(([v,l]) => `<option value="${v}" ${v===e.type?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label>État *</label><select id="f_status">${Object.entries(STATUS).map(([v,l]) => `<option value="${v}" ${v===e.status?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Marque</label>
        <select id="f_brandSel">
          <option value="">— choisir dans le catalogue —</option>
          ${brands.map(c => `<option value="${esc(c.b)}" ${String(c.b)===String(e.brand)?'selected':''}>${esc(c.b)}</option>`).join('')}
          <option value="__other__">＋ Autre marque (nouvelle)…</option>
        </select>
        <input id="f_brand" placeholder="Taper la nouvelle marque" style="display:none;margin-top:6px" value="${esc(e.brand||'')}">
      </div>
      <div class="field"><label>Référence / modèle</label>
        <select id="f_modelSel"></select>
        <input id="f_model" placeholder="Taper la nouvelle référence" style="display:none;margin-top:6px" value="${esc(e.model||'')}">
      </div>
      <div class="field"><label>N° de série</label><input id="f_serial" value="${esc(e.serial||'')}"></div>
      <div class="field"><label>Date de mise en service</label><input type="date" id="f_mes" value="${esc(e.mes||'')}"></div>
      <div class="field full"><label>Localisation précise</label><input id="f_loc" value="${esc(e.loc||'')}" placeholder="Ex. : local CMCF, palier R+2, salle machines…"></div>
      <div class="field full"><label>Photo d’identification (plaque signalétique, étiquette…)</label>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <img id="f_photoPrev" alt="Photo d’identification" src="${photoData ? photoData : ''}"
               style="width:120px;height:90px;object-fit:cover;border:1px solid var(--line-2);border-radius:6px;background:#f2f1ef;${photoData ? '' : 'display:none'}">
          <div style="display:flex;flex-direction:column;gap:6px">
            <input type="file" id="f_photo" accept="image/*" capture="environment" style="font-size:12px">
            <button type="button" class="mini del" id="f_photoDel" ${photoData ? '' : 'style="display:none"'}>Retirer la photo</button>
            <span class="hint">La photo est réduite puis enregistrée localement avec le matériel.</span>
          </div>
        </div>
      </div>
    </div>`);

  const siteSel = modalBox.querySelector('#f_site'), bldSel = modalBox.querySelector('#f_bld');
  siteSel.onchange = () => { bldSel.innerHTML = bldOpts(siteSel.value); };

  // --- listes à choix alimentées par le catalogue ---
  const brandSel = modalBox.querySelector('#f_brandSel'), brandInput = modalBox.querySelector('#f_brand');
  const modelSel = modalBox.querySelector('#f_modelSel'), modelInput = modalBox.querySelector('#f_model');

  function syncBrandUI(){
    const other = brandSel.value === '__other__';
    brandInput.style.display = other ? '' : 'none';
    const entry = brands.find(c => c.b === brandSel.value);
    const refs = entry ? entry.refs : [];
    const cur = e.model || '';
    modelSel.innerHTML = '<option value="">— choisir dans le catalogue —</option>'
      + refs.map(rf => `<option value="${esc(rf)}" ${rf===cur?'selected':''}>${esc(rf)}</option>`).join('')
      + (cur && !refs.some(rf => rf === cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : '')
      + '<option value="__other__">＋ Autre référence (nouvelle)…</option>';
    syncModelUI();
  }
  function syncModelUI(){
    modelInput.style.display = modelSel.value === '__other__' ? '' : 'none';
  }
  brandSel.onchange = syncBrandUI;
  modelSel.onchange = syncModelUI;
  syncBrandUI();

  // --- photo d'identification ---
  const photoPrev = modalBox.querySelector('#f_photoPrev');
  const photoDel  = modalBox.querySelector('#f_photoDel');
  modalBox.querySelector('#f_photo').onchange = ev => {
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;
    compressImage(file, 900, 0.75).then(d => {
      photoData = d;
      photoPrev.src = d; photoPrev.style.display = '';
      photoDel.style.display = '';
    }).catch(() => toast('Impossible de lire cette image.'));
  };
  photoDel.onclick = () => {
    photoData = null;
    photoPrev.style.display = 'none';
    photoDel.style.display = 'none';
  };

  // --- enregistrement ---
  const submit = formFooter(e.id ? 'Enregistrer' : 'Ajouter le matériel');
  submit.onclick = () => {
    if(!bldSel.value){ markInvalid(bldSel); return toast('Sélectionnez un bâtiment (créez-en un si nécessaire).'); }
    const brand = brandSel.value === '__other__' ? brandInput.value.trim() : brandSel.value;
    const model = modelSel.value === '__other__' ? modelInput.value.trim() : modelSel.value;
    const data = {
      siteId:siteSel.value, buildingId:bldSel.value,
      type:document.getElementById('f_type').value, status:document.getElementById('f_status').value,
      brand, model,
      serial:document.getElementById('f_serial').value.trim(), mes:document.getElementById('f_mes').value,
      loc:document.getElementById('f_loc').value.trim(),
      photo:photoData,
    };
    // Enregistrement automatique dans le catalogue pour les prochains formulaires
    addToCatalog(brand, model);
    if(e.id) Object.assign(state.equipment.find(x => x.id === e.id), data);
    else { const ne = { id:uid(), ...data }; state.equipment.push(ne); ui.siteId = ne.siteId; }
    save(); closeModal(); render();
    toast(e.id ? 'Matériel mis à jour — catalogue marques/références actualisé.' : 'Matériel ajouté — catalogue marques/références actualisé.', true);
  };
}

/* ===== FIN DE forms.js ===== */