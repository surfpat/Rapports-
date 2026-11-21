# 🔥 Firewise — Equipment Care

**Application autonome de gestion et de suivi du matériel SSI (Sécurité Incendie) et des rapports d'intervention.**

Firewise est une application web **100 % côté client** (HTML / CSS / JavaScript pur, aucune dépendance serveur ni backend) conçue pour les installateurs et mainteneurs de systèmes de sécurité incendie. Toutes les données restent **locales** dans le navigateur de l'appareil — rien ne quitte jamais la machine.

- 🔒 **Aucune donnée transmise à un serveur** (localStorage uniquement)
- 📄 **Rapports d'intervention signés** exportables en **PDF et Word (.docx)**
- 🏢 **Multi-sites / multi-bâtiments** : registre hiérarchique sites → bâtiments → matériel
- 🏷️ **Catalogue marques / références** auto-alimenté à partir de vos saisies
- 📷 **Photos d'identification** compressées et stockées localement
- 🖊️ **Signatures** technicien + client directement à l'écran
- 🎨 **Personnalisation société** : votre logo + vos coordonnées dans l'app et les rapports
- ☁️ **Synchronisation cloud optionnelle** (configurable)
- 📱 **Installable comme une appli** (PWA-like) sur Android / iOS

---

## 📑 Sommaire

- [Aperçu](#aperçu)
- [Démarrage rapide](#démarrage-rapide)
- [Fonctionnalités](#fonctionnalités)
- [Architecture du projet](#architecture-du-projet)
- [Stockage & confidentialité](#stockage--confidentialité)
- [Personnalisation (société & logo)](#personnalisation-société--logo)
- [Exports PDF / Word](#exports-pdf--word)
- [Sauvegarde & restauration](#sauvegarde--restauration)
- [Installation comme application](#installation-comme-application)
- [Évolutions (changelog)](#évolutions-changelog)
- [Compatibilité](#compatibilité)
- [Licence](#licence)

---

## Aperçu

Firewise structure le travail d'un intervenant SSI autour de trois pôles :

| Pôle | Contenu |
|------|---------|
| **Registre** | Sites, bâtiments, matériel SSI (CDS, détecteurs, extincteurs, BAAS, déclencheurs…), photos, numéros de série, emplacements |
| **Rapports** | Rapports d'intervention typés (maintenance, installation, diagnostic, mise en service, rondes…), pièces remplacées, mesures batteries, anomalies, signatures |
| **Réglages** | Sauvegarde / restauration JSON, export CSV, catalogue marques, types de matériel personnalisés, coordonnées société + logo, synchro cloud |

L'application a été pensée pour un usage **terrain** : ouverte dans un navigateur (Chrome recommandé sur Android), elle fonctionne **hors connexion** et peut être ajoutée à l'écran d'accueil comme une application native.

---

## Démarrage rapide

### Option 1 — Téléchargement direct

1. Téléchargez ou clonez ce dépôt :
   ```bash
   git clone https://github.com/surfpat/Rapports-.git
   ```
2. Ouvrez le dossier :
   ```bash
   cd Rapports-
   ```
3. **Ouvrez `index.html` dans un navigateur moderne** (Chrome, Firefox, Edge, Safari).

   ⚠️ Important : ouvrez `index.html` depuis son dossier complet. Les 9 fichiers `.js` + `style.css` doivent être présents à côté, sinon un message d'erreur s'affichera.

### Option 2 — Via un petit serveur local (recommandé)

Si votre navigateur bloque certains scripts en `file://`, lancez un serveur local :

```bash
python3 -m http.server 8000
# puis ouvrez http://localhost:8000/
```

### Premier lancement

Au premier démarrage, l'application est vide. Allez dans **Réglages → Charger le jeu de démonstration** pour explorer avec des données fictives, ou créez directement votre premier site depuis **Sites & matériel → Nouveau site**.

---

## Fonctionnalités

### 🗂️ Registre hiérarchique

- **Sites** (nom, ville, adresse, contact)
- **Bâtiments** rattachés à un site
- **Matériel SSI** rattaché à un site et/ou un bâtiment :
  - Types prédéfinis : CDS, détecteurs automatiques, extincteurs, BAAS, déclencheurs manuels, désenfumage, etc.
  - **Types personnalisés** : créez vos propres types dans les Réglages
  - Marque, modèle, référence, numéro de série, emplacement, photos
  - Statut (en service / surveillé / hors service / à remplacer)
- **Recherche** instantanée et filtres
- **Catalogue marques / références** auto-alimenté : chaque saisie alimente une base réutilisable

### 📋 Rapports d'intervention

- **Types de rapports** spécialisés selon le contexte :
  - Maintenance préventive
  - Installation / mise en service
  - Diagnostic / dépannage
  - Réception d'installation
  - Rondes & contrôles visuels
- Chaque rapport contient :
  - Métadonnées (n°, date, technicien, objet)
  - **Matériel concerné & tests** (résultat conforme / surveillé / non conforme / à remplacer)
  - Diagnostic, analyse & origine
  - Réglages & paramétrage
  - Contrôles & essais
  - **Anomalies constatées**
  - **Actions réalisées**
  - **Pièces remplacées** (désignation, référence, quantité)
  - **Mesures batteries** (courant, tension t0 → 1 h, autonomie, capacité)
  - Formation & remise
  - Recommandations
  - Prochaine visite
  - **Signatures** technicien + client (signaturePad)

### 🖊️ Signatures

- Capturées directement à l'écran (tactile ou souris)
- Intégrées dans le rapport à l'écran et dans les exports PDF / Word
- Bibliothèque : `signature_pad`

### 📷 Photos

- Photos d'identification du matériel (caméra ou galerie)
- **Compression automatique** (max 900 px, JPEG) pour économiser le stockage local
- Stockées en base64 dans le localStorage

### 🎨 Société & logo (v1.2)

- Renseignez **une seule fois** le nom, slogan, adresse, téléphone, email, SIRET de votre société
- **Uploadez votre logo** (PNG / JPG / SVG / WebP, ≤ 500 Ko)
- Ces informations apparaissent automatiquement :
  - dans la **barre latérale** de l'application (logo + nom + coordonnées)
  - dans l'**en-tête** des rapports PDF et Word
  - dans le **pied de page** des rapports
- Voir [Personnalisation](#personnalisation-société--logo)

### ☁️ Synchronisation cloud (optionnelle)

- Mécanisme de synchro configurable (voir `sync.js`)
- Activable / désactivable depuis les Réglages
- Par défaut, l'application fonctionne **entièrement hors ligne**

---

## Architecture du projet

L'application est découpée en modules JavaScript clairs, sans framework, sans build step :

```
Rapports-/
├── index.html          # Point d'entrée, structure de base (sidebar + contenu)
├── style.css           # Tous les styles (responsive, impression)
├── core.js              # Utilitaires, état, persistance, référentiels SSI, démo, modales
├── views.js             # Navigation, routage, tableau de bord
├── registry.js          # Vue Registre (sites → bâtiments → matériel)
├── forms.js             # Formulaires (sites, bâtiments, matériel, catalogue)
├── reports.js           # Liste des rapports + feuille de rapport (écran & export)
├── reportform.js        # Formulaire de création / édition de rapport
├── reportrows.js        # Lignes dynamiques (pièces, tests, batteries) dans les rapports
├── exports.js           # Exports PDF (html2pdf.js) et Word (docx.js)
├── settings.js          # Réglages (sauvegardes, types, société, démo)
└── sync.js              # Synchronisation cloud optionnelle
```

### Pile technique

| Usage | Bibliothèque | Chargement |
|-------|--------------|------------|
| Signatures | `signature_pad@4.1.7` | CDN (defer) |
| Export PDF | `html2pdf.js@0.10.1` | CDN (defer) |
| Export Word | `docx@8.5.0` | CDN (defer) |

Les bibliothèques externes sont chargées en `defer` : l'application démarre sans elles et ne signale leur absence qu'au moment d'utiliser la fonction concernée (signature, export PDF, export Word). Une connexion internet est donc nécessaire **uniquement au premier usage** de ces fonctions, le temps de mettre en cache les bibliothèques.

### État et persistance

- Tout l'état applicatif est dans un objet `state` (sites, bâtiments, matériel, rapports, catalogue, types personnalisés, société).
- Persistance via `localStorage` sous la clé `firewise.v1`.
- À chaque modification, `save()` sérialise l'état complet → aucune perte de données entre les sessions.

---

## Stockage & confidentialité

**Aucune donnée ne quitte votre appareil.**

- Sites, matériel, photos, rapports, signatures, société : tout est stocké dans le `localStorage` du navigateur.
- Aucun appel réseau vers un serveur applicatif (hors chargement initial des bibliothèques CDN).
- La synchro cloud, si activée, est explicitement configurée par l'utilisateur.

### Limites à connaître

- Le `localStorage` est limité (~5–10 Mo selon le navigateur). Les photos sont compressées pour rester raisonnables, mais un parc très important peut saturer le quota — un message vous avertira et vous suggérera d'exporter une sauvegarde puis de nettoyer.
- Effacer les données du navigateur (cache, cookies) supprimera aussi l'application → **exportez régulièrement une sauvegarde JSON**.

---

## Personnalisation (société & logo)

Pour personnaliser l'identité de votre société :

1. Allez dans **Réglages → Société & logo**
2. Cliquez sur **« ✎ Modifier »**
3. Renseignez :
   - Nom de la société (obligatoire)
   - Slogan / activité
   - Téléphone, email
   - Adresse, code postal, ville
   - SIRET (optionnel)
   - **Logo** (bouton « Choisir un fichier… », PNG / JPG / SVG / WebP, ≤ 500 Ko)
4. Cliquez sur **« Enregistrer la société »**

Dès l'enregistrement :
- La **barre latérale** affiche votre logo + nom + coordonnées à la place de Firewise.
- Tous les **nouveaux rapports** (PDF et Word) incluent votre logo + vos coordonnées dans l'en-tête et le pied de page.
- Le nom « Firewise » reste la valeur par défaut tant que vous n'avez rien renseigné.

---

## Exports PDF / Word

Chaque rapport peut être exporté depuis la liste des rapports ou le détail d'un rapport :

### PDF (`.pdf`)

- Généré via `html2pdf.js` (rendu canvas → PDF)
- Mise en page A4 portrait, bandeau d'en-tête rouge, sections aérées
- Logo société + coordonnées dans l'en-tête
- Sauts de page propres (évite les coupures en plein milieu d'un tableau)
- Nom de fichier : `<numéro>-<type>.pdf`

### Word (`.docx`)

- Généré via `docx.js` (vrai document Word éditable)
- En-tête coloré (logo société + nom + coordonnées à gauche, titre + numéro à droite)
- Tableaux méta, pièces, mesures batteries
- Cadres de signatures
- Pied de page paginé : « Société · coordonnées » + « généré le JJ/MM/AAAA · N° … · page X / Y »
- Nom de fichier : `<numéro>-<type>.docx`

---

## Sauvegarde & restauration

Depuis **Réglages → Sauvegarde & restauration** :

| Action | Format | Description |
|--------|--------|-------------|
| **Exporter la sauvegarde** | `.json` | Tout l'état (sites, matériel, rapports, catalogue, types, société) dans un seul fichier |
| **Importer une sauvegarde** | `.json` | Restaure un fichier de sauvegarde (écrase l'état actuel) |
| **Exporter le registre** | `.csv` | Liste du matériel (sites, bâtiments, types, marques, modèles, n° de série) |

> 💡 **Conseil** : exportez une sauvegarde JSON régulièrement et conservez-la en lieu sûr (cloud, clé USB). C'est votre seule protection contre une perte de données navigateur.

---

## Installation comme application

### Sur Android (Chrome)

1. Ouvrez l'application dans Chrome
2. Menu ⋮ → **« Ajouter à l'écran d'accueil »**
3. L'icône apparaît sur votre écran d'accueil et s'ouvre en plein écran comme une application native

### Sur iOS (Safari)

1. Ouvrez l'application dans Safari
2. Bouton Partager → **« Sur l'écran d'accueil »**

### Sur ordinateur (Chrome / Edge)

1. Ouvrez l'application
2. Icône d'installation dans la barre d'adresse (ou menu → « Installer »)

---

## Évolutions (changelog)

### v1.2 — Personnalisation société & logo

- ✨ Nouveau panneau **« Société & logo »** dans les Réglages (nom, slogan, adresse, tél, email, SIRET, logo)
- 🎨 Logo + coordonnées société affichés dans la **barre latérale** de l'application
- 📄 Logo + coordonnées intégrés dans l'**en-tête** des rapports PDF et Word
- 📄 Coordonnées société répétées dans le **pied de page** des rapports
- 🔧 Reset / import / démo gèrent correctement la société (conservée au chargement démo)

### v1.1 — Types de matériel personnalisés & mise en page des exports

- ✨ **CRUD des types de matériel** : créez, renommez, supprimez vos propres types
- 🎨 **Refonte de la mise en page PDF** : bandeau coloré, sections aérées, sauts de page propres
- 🎨 **Refonte de l'en-tête Word** : bloc couleur pleine largeur, footer paginé
- 📊 Amélioration des tableaux (pièces, mesures batteries)

### v1.0 — Version initiale

- Registre hiérarchique sites → bâtiments → matériel
- Catalogue marques / références auto-alimenté
- Rapports d'intervention typés
- Signatures technicien + client
- Exports PDF et Word
- Sauvegarde / restauration JSON, export CSV
- Jeu de démonstration

---

## Compatibilité

| Navigateur | Support | Remarques |
|------------|---------|-----------|
| **Chrome** (Android / desktop) | ✅ Recommandé | Toutes fonctionnalités, installable comme appli |
| **Firefox** | ✅ | Toutes fonctionnalités |
| **Edge** | ✅ | Toutes fonctionnalités |
| **Safari** (iOS / macOS) | ✅ | Signatures tactiles OK |
| Navigateurs anciens (IE) | ❌ | Non supporté |

JavaScript doit être activé. Une connexion internet est nécessaire **uniquement** au premier usage des signatures et exports (chargement des bibliothèques CDN, mises en cache ensuite).

---

## Contribution

Les contributions sont les bienvenues ! Pour proposer une amélioration :

1. Forkez le dépôt
2. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
3. Commitez vos changements : `git commit -m "Ajout de …"`
4. Poussez : `git push origin feature/ma-fonctionnalite`
5. Ouvrez une **Pull Request**

### Idées d'évolutions welcome

- Mode PWA complet (service worker, manifest)
- Export Excel des rapports
- Gestion des contrats de maintenance / échéances
- Statistiques d'intervention (tableau de bord avancé)
- Multi-utilisateurs / multi-sociétés

---

## Licence

Ce projet est distribué sous licence **MIT**. Vous êtes libre de l'utiliser, le modifier et le redistribuer.

---

## Auteur

**surfpat** — [github.com/surfpat](https://github.com/surfpat)

---

> 🔥 **Firewise Equipment Care** — Gestion du matériel SSI et rapports d'intervention, 100 % locaux, 0 serveur.
