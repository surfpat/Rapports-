# Prompt applicatif — Firewise Equipment Care

> Copiez l'intégralité de ce prompt dans une nouvelle session IA pour travailler sur le code de l'application.

---

## Identité

Tu travailles sur **Firewise Equipment Care** (v1.1), une application web autonome de gestion et de suivi du matériel SSI (Système de Sécurité Incendie). Destinée aux techniciens de maintenance incendie, elle fonctionne **entièrement en local** dans le navigateur — aucune donnée ne quitte l'appareil.

L'application gère : un registre hiérarchique sites → bâtiments → matériel, un catalogue marques/références auto-alimenté, des photos d'identification, des rapports d'intervention signés (signature manuscrite tactile), des calculs d'autonomie batterie selon NF S 61-930, et des exports PDF / Word.

## Stack technique

- **Vanilla JavaScript (ES6+)** — aucun framework, aucun bundler, aucune étape de build.
- **HTML + CSS statiques** — un seul `index.html`, un `style.css`, 9 fichiers `.js`.
- **Persistance** : `localStorage` (clé `firewise.v1`), sérialisation JSON.
- **Bibliothèques externes via CDN** (jsdelivr) avec `defer` (non-bloquantes) :
  - `signature_pad@4.1.7` — signatures manuscrites sur canvas.
  - `html2pdf.js@0.10.1` — export PDF (html2canvas + jsPDF).
  - `docx@8.5.0` — export Word .docx.
- L'app **fonctionne sans les CDN** ; seules les signatures et les exports nécessitent une connexion au premier usage (gardes `typeof` partout).

## Architecture des fichiers

```
index.html      — coquille HTML (sidebar statique, #view, #overlay, #toasts, #printArea)
style.css       — design system complet (variables CSS, responsive, feuille de rapport)
core.js         — utilitaires, référentiels SSI, état global, persistance, catalogue, démo, modales
views.js        — navigation (NAV), routage go(), rendu dashboard
registry.js     — vue registre maître-détail (sites → bâtiments → matériel)
forms.js        — formulaires site / bâtiment / matériel (avec photo compressée)
reports.js      — liste des rapports + reportSheetHTML() (feuille de rapport réutilisée à l'écran et pour l'export)
reportform.js   — formulaire de rapport (le cœur : liaison registre, check-list matériel, signatures)
reportrows.js   — sections dynamiques : matériel testé, mesures batteries (calculs auto)
exports.js      — exportPDF() (html2pdf) + exportDOCX() (docx.js)
settings.js     — réglages (sauvegarde/restauration JSON, CSV, démo, reset) + démarrage
```

**Ordre de chargement** (fin de `<body>`, sans `defer`) : core → views → registry → forms → reports → reportform → reportrows → exports → settings. Les CDN sont chargés après, avec `defer`.

Chaque fichier est une collection de fonctions globales (pas de modules ES). L'état est partagé via les variables globales `state` et `ui`.

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

- `equipment.type` : clé parmi `TYPES_EQ` (voir core.js) — terminologie SSI française.
- `equipment.status` : `service` / `verif` / `hs`.
- `report.linkMode` : `base` (lié au registre) ou `free` (saisie libre).
- `report.equipmentIds` : tableau des ids cochés (restauré à l'édition).
- `report.tests` : `[{ eqId, label, res, note }]` — `res` ∈ `conforme`/`surveil`/`nonconforme`/`nonteste`.
- `report.batteries` : `[{ mat, bat, cnom, unom, vch, ich, iabs, ut0, ut1, areq, cmes, aut, q1h, res, note }]`.
- `report.sigTech` / `sigClient` : dataURL PNG (ou `null`).
- `report.no` : format `RPT-AAAA-NNNN`, séquence annuelle.

## Conventions de code (à respecter absolument)

1. **Échappement HTML** : toute donnée utilisateur insérée dans le DOM passe par `esc()` (core.js). Jamais de `innerHTML` avec des données non échappées. Les seules exceptions sont `openModal(bodyHTML)` et `confirmBox(msg)` où l'appelant est responsable de l'échappement.
2. **Pas de framework** : manipulation DOM directe (`document.getElementById`, `querySelector`, `addEventListener`). Pas de virtual DOM, pas de réactivité — `render()` re-rend toute la vue active.
3. **Modales** : `openModal(title, bodyHTML, wide)` retourne le corps ; `formFooter(label)` retourne le bouton submit ; `confirmBox(title, msg, onOk)` pour les confirmations. Fermeture : Échap ou clic sur l'overlay.
4. **Toasts** : `toast(msg, ok)` — `ok=true` pour le vert, sinon rouge.
5. **Validation** : `markInvalid(el)` ajoute la classe `.err` et focusse le champ.
6. **Persistance** : `save()` retourne un booléen. Toujours appeler `save()` après toute mutation de `state`, puis `render()`.
7. **Pas de calculs en tête** : utiliser Python ou `eval` dans le navigateur pour vérifier les arithmetic. Les calculs batteries sont dans `batCompute()` (reportrows.js).
8. **Commentaires** : en français, style en-tête de section `/* ---------- N. Titre ---------- */`.

## Domaine SSI (Système de Sécurité Incendie)

L'app utilise la **terminologie réglementaire française** (normes NF S 61-930 / EN 54). Référentiels dans core.js :

- **TYPES_EQ** : 23 types de matériel (CDS = Centrale de Détection Incendie, CMSI, UGA, DA, DAS, détecteurs fumée/chaleur/flamme/linéaire/aspiration, DM = Déclencheur Manuel, extinction gaz/eau, désenfumage, portes coupe-feu, colonnes sèche/en charge, RIA…).
- **STATUS** : En service / À vérifier / Hors service.
- **REPORT_TYPES** : Maintenance / Dépannage / Mise en service / Rapport journalier.

### Calculs batteries (NF S 61-930, protocole complet)

Le protocole est implémenté dans `reportrows.js` :
1. **Secteur présent** : relever tension de charge (flottement ≈ 13,5–13,8 V / bloc 12 V) et courant de charge.
2. **Secteur coupé** : intensité absorbée par le matériel + tension à t0.
3. **Après 1 h** : tension à t+1 h.

Calculs automatiques (`batCompute`) :
- **Ah consommés (1 h)** = I absorbée × 1 h
- **Capacité restante (%)** = interpolation sur `SOC_TABLE` (table indicative bloc 12 V plomb), normalisée via `u × 12 / unom` pour le 24 V
- **Autonomie estimée (h)** = (SOC% × capacité nominale Ah) / I absorbée
- **Résultat proposé** : ≥ autonomie requise → `conforme` ; ≥ 80 % → `surveil` ; sinon `remplacer` (sans écraser un choix manuel).

## Fonctionnalités clés à connaître

### Registre (maître-détail)
- Vue `registry.js` : liste des sites à gauche, matériel du site/bâtiment sélectionné à droite.
- Recherche instantanée (re-rendu à chaque frappe).
- Photos d'identification : `compressImage()` réduit à max 900 px, JPEG qualité 0.75.

### Catalogue auto-alimenté
- `addToCatalog(brand, model)` est appelé à chaque enregistrement de matériel.
- Le catalogue est proposé en autocomplétion dans les formulaires suivants (datalist).

### Rapports
- Numérotation séquentielle annuelle : `nextReportNo()` → `RPT-2026-0001`.
- Mode « lié au registre » : check-list du matériel concerné (tout coché par défaut à la création, **sélection restaurée à l'édition** via `equipmentIds`).
- `syncTestsToChecklist()` : la section « Matériel testé » suit automatiquement la check-list (ajoute des lignes « Non testé » pour le matériel nouvellement coché, retire les lignes non éditées pour le matériel décoché).
- Signatures : `SignaturePad` sur canvas (devicePixelRatio), sauvegardées en PNG dataURL.
- `reportSheetHTML(r)` : feuille de rapport HTML réutilisée pour l'affichage écran ET l'export PDF.
- Section « Matériel concerné » affichée si `r.equipmentList` est non vide.

### Exports
- **PDF** : `exportPDF()` → `#printArea` (off-screen à `left:-12000px`) → html2pdf (A4 portrait, scale 2).
- **DOCX** : `exportDOCX()` → docx.js (tableaux bordés, signatures en ImageRun 220×68 px).
- Nommage : `{r.no}-{slug(type)}.pdf` / `.docx`.

## Règles pour travailler sur le code

1. **Lire les fichiers concernés en entier** avant de modifier — les fonctions sont interdépendantes.
2. **Toujours échapper** les données dynamiques avec `esc()` dans tout `innerHTML`.
3. **Tester la syntaxe** : `node --check <fichier>.js` après chaque modification.
4. **Tester le runtime** : ouvrir `index.html` dans un navigateur, vérifier la console (F12) — aucune erreur attendue.
5. **Pas de build** : les modifications sont immédiates, il suffit de recharger la page.
6. **Responsive** : breakpoint à 960 px (style.css). Les tables ont `overflow-x:auto`.
7. **Langue** : tout le texte UI, les commentaires et les rapports sont en **français**.
8. **Pas de dépendance serveur** : ne pas introduire d'appels réseau vers un backend. L'app reste 100 % locale.
9. **CDN optionnels** : toute nouvelle fonctionnalité utilisant une bibliothèque externe doit fonctionner gracieusement sans elle (garde `typeof` + toast explicite).
10. **Persistance** : après toute mutation de `state`, appeler `save()` puis `render()`.

## Démarrage rapide

```bash
# L'app est un fichier statique — ouvrez-le directement :
open download/firewise/index.html        # macOS
xdg-open download/firewise/index.html    # Linux
start download/firewise/index.html       # Windows

# Vérification syntaxique :
cd download/firewise && for f in *.js; do node --check "$f"; done
```

Au premier lancement (localStorage vide), `seedDemo()` charge un jeu de démonstration : 2 sites, 4 bâtiments, 10 matériels, 1 rapport signé.

## Ce que tu peux me demander

- Ajouter / modifier un type de matériel SSI dans le référentiel.
- Créer un nouveau type de rapport ou un nouveau statut.
- Ajouter un champ au formulaire de matériel ou de rapport.
- Modifier les calculs d'autonomie batterie ou la table SOC.
- Ajouter un export (CSV matériel, Excel, etc.).
- Corriger un bug ou améliorer l'UX d'une vue.
- Adapter la terminologie à une autre norme ou région.

**Indique toujours quel(s) fichier(s) tu modifies et pourquoi, et vérifie la syntaxe + le runtime avant de conclure.**
