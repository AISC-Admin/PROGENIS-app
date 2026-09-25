# Progenis · Espace projet

Application web collaborative de **OÜ Progenis Biosystems**, aux couleurs du site officiel
(logo, palette mousse / ambre, polices Fraunces + IBM Plex, thème clair / sombre).

| Onglet | Contenu |
| --- | --- |
| **01 · Tâches** | Tableau façon Trello : colonnes, cartes glissées-déposées, étiquettes de couleur, case « Je m'en occupe », **pastilles d'avancement** (Démarré, En cours, Bloqué, En revue, Terminé + %) avec historique, échéances, priorités, filtres. |
| **02 · Réflexion** | Forum : sujets et messages **tous sauvegardés**, documents, images, PDF, **vidéos**, **messages vocaux** enregistrés depuis le navigateur, **liens de conversations IA** (DeepSeek, Claude, ChatGPT, Gemini, Perplexity, Le Chat) avec badge, et une **Bibliothèque IA** qui regroupe tous les liens partagés. |
| **03 · Projet** | Stratégie & projet : sections éditables (Vision, Objectifs, Stratégie…), jalons datés, documents de référence, indicateurs d'avancement. |
| **04 · Accès** *(manager uniquement)* | Création des participants, génération des **codes d'accès**, rôle **Éditeur** ou **Visionneur**, désactivation, journal d'activité. |

## Rôles

- **Manager** : tous les droits + gestion des accès (codes, rôles, désactivation).
- **Éditeur** : crée et modifie cartes, pastilles, messages, fichiers, projet.
- **Visionneur** : consultation uniquement.

Les changements de rôle et les désactivations s'appliquent **immédiatement**. Après 8 codes erronés, une adresse IP est bloquée 15 minutes (et toutes les connexions le sont au-delà de 50 échecs en 15 minutes). « Nouveau code » invalide l'ancien code et ferme les sessions ouvertes de la personne. Les codes sont stockés chiffrés (HMAC) : ils ne sont affichés qu'une fois, au moment de leur création.

## Pile technique (recommandée)

- **Next.js 15** (App Router, TypeScript, Tailwind CSS 4) — hébergé sur **Vercel**
- **Base de données : Neon Postgres** (via le Marketplace Vercel — c'est l'offre Postgres officielle de Vercel, gratuite pour démarrer, sans serveur à gérer)
- **Fichiers : Vercel Blob** (store *privé* : les fichiers ne sont accessibles qu'aux membres connectés ; les vidéos lourdes sont envoyées directement du navigateur vers le stockage, jusqu'à 500 Mo)

Le schéma de la base est créé **automatiquement** au premier accès. Aucune migration à lancer.

---

## Déploiement : GitHub → Vercel (≈ 15 minutes)

### 1. Mettre le code sur GitHub

```bash
cd progenis-app
git init
git add -A && git commit -m "Progenis · Espace projet"
git branch -M main
git remote add origin https://github.com/<votre-compte>/progenis-app.git
git push -u origin main
```

Gardez le dépôt **privé**.

### 2. Importer dans Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import** le dépôt `progenis-app` (framework détecté : Next.js).
2. Ne déployez pas encore, ou laissez le premier déploiement échouer : il faut d'abord la base et les variables.

### 3. Créer la base de données (Neon)

Projet Vercel → onglet **Storage** → **Create Database** → **Neon (Serverless Postgres)** → région *Frankfurt (eu-central-1)* → **Connect** au projet.
La variable `DATABASE_URL` est ajoutée automatiquement.

### 4. Créer le stockage de fichiers (Blob)

Onglet **Storage** → **Create** → **Blob** → choisissez l'accès **Private** → **Connect** au projet.
La variable `BLOB_READ_WRITE_TOKEN` est ajoutée automatiquement.

### 5. Ajouter les variables d'environnement

Projet → **Settings → Environment Variables** :

| Nom | Valeur |
| --- | --- |
| `AUTH_SECRET` | une longue chaîne aléatoire (ex. résultat de `openssl rand -base64 32`) |
| `MANAGER_BOOTSTRAP_CODE` | le code du **premier** compte manager, ex. `PROGENIS-ADMIN-2026` |
| `BLOB_ACCESS` | `private` (ou `public` si vous avez créé un store public) |

> ⚠️ Ne changez plus `AUTH_SECRET` ensuite : tous les codes d'accès en dépendent.

### 6. Déployer

**Deployments → Redeploy**. Ouvrez l'URL, saisissez `MANAGER_BOOTSTRAP_CODE` : le compte **Manager** est créé.
Puis, dans **Accès** :

1. ce code devient votre code manager permanent ; vous pouvez le remplacer quand vous voulez avec « **Nouveau code** » sur votre propre ligne ;
2. renommez votre compte ;
3. ajoutez les participants (Éditeur ou Visionneur) et envoyez-leur l'invitation (bouton « Copier l'invitation »).

Domaine personnalisé (facultatif) : **Settings → Domains** → ex. `espace.progenis-biosystems.com`.

---

## Développement local

```bash
npm install
cp .env.example .env.local     # renseignez DATABASE_URL (Neon, ou un Postgres local)
npm run dev                    # http://localhost:3000
```

Sans `BLOB_READ_WRITE_TOKEN`, les fichiers sont stockés dans `./.uploads` (développement uniquement).

`npm run db:init` crée le schéma manuellement (facultatif).

## Structure

```
app/
  login/                 page de connexion par code
  (app)/taches           01 · tableau Trello
  (app)/reflexion        02 · forum + bibliothèque IA
  (app)/projet           03 · stratégie & projet
  (app)/gestion          04 · gestion des accès (manager)
  api/…                  routes serveur (auth, tasks, columns, labels, threads, messages, project, users, upload, files)
components/              interface (board/, forum/, project/, admin/)
lib/                     base de données, schéma SQL, auth, identité de la société (brand.ts)
public/brand/            logo Progenis
```

Coordonnées et textes de la société : `lib/brand.ts`. Couleurs : variables CSS en tête de `app/globals.css`.

## Notes

- Les données se rafraîchissent automatiquement toutes les 5 à 10 s (plusieurs personnes peuvent travailler en même temps).
- Sur mobile, le glisser-déposer est remplacé par le menu « Colonne » dans le détail d'une carte.
- Les messages supprimés laissent une trace dans l'historique ; un sujet complet ne peut être supprimé que par le manager.
- Enregistrement vocal : le navigateur demande l'autorisation du micro (HTTPS requis — c'est le cas sur Vercel).

## En cas de problème de connexion

Ouvrez `https://<votre-site>/api/health` : la page indique quelles variables manquent dans Vercel
(sans jamais afficher leur valeur) et si la base de données répond. Après toute modification des variables,
relancez un déploiement (**Deployments → Redeploy**) : Vercel ne les applique qu'au déploiement suivant.
