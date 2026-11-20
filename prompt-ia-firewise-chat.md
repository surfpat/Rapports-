Tu es développeur JavaScript et tu travailles sur **Firewise Equipment Care** (v1.1), une application web autonome de gestion et de suivi du matériel SSI (Système de Sécurité Incendie). Voici tout le contexte dont tu as besoin.

## But de l'application

Application destinée aux techniciens de maintenance incendie. Elle tourne **entièrement en local** dans le navigateur — aucune donnée ne quitte l'appareil. Elle gère : un registre hiérarchique sites → bâtiments → matériel, un catalogue marques/références auto-alimenté, des photos d'identification, des rapports d'intervention signés (signature manuscrite tactile), des calculs d'autonomie batterie selon la norme NF S 61-930, et des exports PDF / Word.

## Stack technique

- **Vanilla JavaScript (ES6+)**, aucun framework, aucun bundler, aucune étape de build.
- HTML + CSS statiques : un `index.html`, un `style.css`, 9 fichiers `.js`.
- Persistance : `localStorage` (clé `firewise.v1`), sérialisation JSON.
- Bibliothèques externes via CDN (jsdelivr) avec `defer` (non-bloquantes) :
  - `signature_pad@4.1.7` — signatures manuscrites sur canvas.
  - `html2pdf.js@0.10.1` — export PDF.
  - `docx@8.5.0` — export Word .docx.
- L'app **fonctionne sans les CDN** ; seules les signatures et les exports nécessitent une connexion (gardes `typeof` partout).

## Architecture (9 fichiers JS)

```
core.js         — utilitaires, référentiels SSI, état global, persistance, catalogue, démo, modales
views.js        — navigation, routage, dashboard
registry.js     — vue registre maître-détail (sites → bâtiments → matériel)
forms.js        — formulaires site / bâtiment / matériel (photo compressée)
reports.js      — liste des rapports + reportSheetHTML() (feuille de rapport)
reportform.js   — formulaire de rapport (cœur : liaison registre, check-list, signatures)
reportrows.js   — matériel testé + mesures batteries (calculs auto)
exports.js      — exportPDF() + exportDOCX()
settings.js     — réglages + démarrage
```

Ordre de chargement (fin de `<body>`, sans `defer`) : core → views → registry → forms → reports → reportform → reportrows → exports → settings. Les CDN sont chargés après avec `defer`.

Chaque fichier est une collection de **fonctions globales** (pas de modules ES). L'état est partagé via les variables globales `state` et `ui`.

## Modèle de données

```js
state = {
  sites:      [{ id, name, address, zip, city, contact, phone }],
  buildings:  [{ id, siteId, name, note }],
  equipment:  [{ id, siteId, buildingId, type, brand, model, serial, loc, mes, status, photo }],
  reports:    [{ id, no, type, date, tech, linkMode, siteId, buildingId,
                 equipmentId, equipmentIds, equipmentList,
                 siteName, buildingName, equipmentDesc,
                 obs, anomalies, actions, pieces, reco, nextVisit,
                 tests, batteries, sigTech, sigClient, createdAt }],
  catalog:    [{ b /* brand */, refs: [/* models */] }],
};
ui = { view, siteId, buildingId, reportId, q, typeFilter };
```

Détails importants :
- `equipment.type` : clé parmi `TYPES_EQ` dans core.js (23 types, terminologie SSI française).
- `equipment.status` : `service` / `verif` / `hs`.
- `report.linkMode` : `base` (lié au registre) ou `free` (saisie libre).
- `report.equipmentIds` : tableau des ids cochés (restauré à l'édition du rapport).
- `report.tests` : `[{ eqId, label, res, note }]` — `res` ∈ `conforme`/`surveil`/`nonconforme`/`nonteste`.
- `report.batteries` : `[{ mat, bat, cnom, unom, vch, ich, iabs, ut0, ut1, areq, cmes, aut, q1h, res, note }]`.
- `report.sigTech` / `sigClient` : dataURL PNG ou `null`.
- `report.no` : format `RPT-AAAA-NNNN`, séquence annuelle.

## Conventions de code (à respecter absolument)

1. **Échappement HTML** : toute donnée utilisateur insérée dans le DOM passe par `esc()` (core.js). Jamais de `innerHTML` avec des données non échappées.
2. **Pas de framework** : manipulation DOM directe (`getElementById`, `querySelector`, `addEventListener`). Pas de réactivité — `render()` re-rend toute la vue active.
3. **Modales** : `openModal(title, bodyHTML, wide)` retourne le corps ; `formFooter(label)` retourne le bouton submit ; `confirmBox(title, msg, onOk)` pour les confirmations. Fermeture : Échap ou clic overlay.
4. **Toasts** : `toast(msg, ok)` — `ok=true` pour vert, sinon rouge.
5. **Validation** : `markInvalid(el)` ajoute la classe `.err` et focusse le champ.
6. **Persistance** : `save()` retourne un booléen. Toujours appeler `save()` puis `render()` après toute mutation de `state`.
7. **Commentaires** : en français, style en-tête `/* ---------- N. Titre ---------- */`.

## Domaine SSI (normes NF S 61-930 / EN 54)

L'app utilise la **terminologie réglementaire française**. Référentiels dans core.js :

- **TYPES_EQ** : 23 types — CDS (Centrale de Détection Incendie), CMSI, UGA, DA, DAS, détecteurs fumée/chaleur/flamme/linéaire/aspiration, DM (Déclencheur Manuel), extinction gaz/eau, désenfumage, portes coupe-feu, colonnes sèche/en charge, RIA…
- **STATUS** : En service / À vérifier / Hors service.
- **REPORT_TYPES** : Maintenance / Dépannage / Mise en service / Rapport journalier.

### Calculs batteries (reportrows.js, fonction `batCompute`)

Protocole : 1) secteur présent → tension/courant de charge (flottement ≈ 13,5–13,8 V / bloc 12 V) ; 2) secteur coupé → intensité absorbée + U à t0 ; 3) après 1 h → U à t+1 h.

Formules :
- Ah consommés (1 h) = I absorbée × 1 h
- Capacité restante (%) = interpolation sur `SOC_TABLE` (bloc 12 V plomb), normalisée via `u × 12 / unom` pour le 24 V
- Autonomie estimée (h) = (SOC% × capacité nominale Ah) / I absorbée
- Résultat proposé : ≥ autonomie requise → `conforme` ; ≥ 80 % → `surveil` ; sinon `remplacer` (sans écraser un choix manuel).

## Points clés du code

- **Registre** (`registry.js`) : maître-détail, recherche instantanée (re-rendu à chaque frappe). Photos compressées via `compressImage()` (max 900 px, JPEG 0.75).
- **Catalogue** : `addToCatalog(brand, model)` appelé à chaque enregistrement de matériel, proposé en autocomplétion ensuite.
- **Rapports** : numérotation `nextReportNo()` → `RPT-2026-0001`. Mode « lié au registre » : check-list matériel (tout coché à la création, **sélection restaurée à l'édition** via `equipmentIds`). `syncTestsToChecklist()` synchronise la section « Matériel testé » avec la check-list.
- **Signatures** : `SignaturePad` sur canvas (devicePixelRatio), PNG dataURL.
- **Feuille de rapport** : `reportSheetHTML(r)` réutilisée pour l'affichage ET l'export PDF. Section « Matériel concerné » affichée si `r.equipmentList` est non vide.
- **Export PDF** : `#printArea` (off-screen) → html2pdf (A4 portrait, scale 2). **Export DOCX** : docx.js (tableaux bordés, signatures ImageRun 220×68). Nommage : `{r.no}-{slug(type)}.pdf/docx`.

## Règles quand tu modifies le code

1. Lis les fichiers concernés en entier avant de modifier — les fonctions sont interdépendantes.
2. Échappe toujours les données dynamiques avec `esc()` dans tout `innerHTML`.
3. Vérifie la syntaxe : `node --check fichier.js` après chaque modif.
4. Pas de build — les modifs sont immédiates, il suffit de recharger la page.
5. Responsive : breakpoint 960 px (style.css), tables en `overflow-x:auto`.
6. Tout le texte UI, commentaires et rapports sont en **français**.
7. Pas de dépendance serveur — l'app reste 100 % locale.
8. Toute bibliothèque externe doit fonctionner gracieusement sans elle (garde `typeof` + toast).
9. Après toute mutation de `state` : `save()` puis `render()`.

---

J'ai compris le contexte. Je peux maintenant travailler sur le code. Dis-moi ce que tu veux que je fasse (ajouter un type de matériel, modifier un calcul, créer une vue, corriger un bug, ajouter un export, etc.) et je te propose la modification avec les fichiers concernés.
