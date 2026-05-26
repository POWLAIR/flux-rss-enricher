# flux-rss-enricher — Étape 2/3 : Enrichissement

Script Node.js qui consomme le `feed.xml` brut produit par `flux-rss-framework`, lui applique plusieurs traitements (déduplication, auto-tagging, score de signal, détection de langue) et publie un fichier `feed-enriched.json` structuré sur GitHub Pages.

## Pipeline global

```
[1] flux-rss-framework  →  feed.xml           (GitHub Pages)
         ↓
[2] flux-rss-enricher   →  feed-enriched.json (GitHub Pages)  ← vous êtes ici
         ↓
[3] flux-rss-site       →  Site de veille     (Vercel)
```

## Fonctionnement

`enrich.js` exécute 6 étapes en séquence :

| Étape | Description |
|---|---|
| 1. Fetch & parse | Récupère `feed.xml`, extrait source et titre propre depuis le préfixe `[source]` |
| 2. Déduplication | Supprime les articles avec la même URL |
| 3. Auto-tagging | Détecte les tags (React, TypeScript, Security…) dans le titre et la description |
| 4. Score de signal | Compte les articles partageant les mêmes tags dans une fenêtre de 48h |
| 5. Langue | Détecte la langue (japonais, russe, arabe, thaï, anglais par défaut) |
| 6. ID stable | Hash MD5 sur l'URL pour identifier chaque article de façon permanente |

## Format de sortie

`feed-enriched.json` publié sur GitHub Pages :

```json
{
  "meta": {
    "generatedAt": "2026-05-26T12:05:00Z",
    "totalArticles": 87,
    "uniqueSources": 25,
    "availableTags": ["React", "TypeScript", "Performance", "Release"]
  },
  "articles": [
    {
      "id": "a1b2c3d4",
      "title": "React 19 released",
      "source": "React Blog",
      "url": "https://react.dev/blog/...",
      "date": "2026-05-26T10:00:00Z",
      "author": "React Team",
      "description": "...",
      "tags": ["React", "Release"],
      "signal": 3,
      "lang": "en"
    }
  ]
}
```

**URL du feed produit :**
```
https://powlair.github.io/flux-rss-enricher/feed-enriched.json
```

## Installation & usage local

```bash
# Installer les dépendances
npm install

# Lancer l'enrichissement (génère public/feed-enriched.json)
npm run build
```

> Le script récupère le feed live depuis `https://powlair.github.io/flux-rss-framework/feed.xml`.

## Configuration

### Règles de tagging (`tags.json`)

Dictionnaire de mots-clés (lowercase) → noms de tags. Ajouter une entrée pour créer un nouveau tag :

```json
{
  "react": "React",
  "typescript": "TypeScript",
  "security": "Security",
  "monmot": "MonTag"
}
```

La détection s'applique sur le titre, la description et les catégories de chaque article.

## Déploiement

1. Héberger ce code sur un dépôt GitHub public.
2. Aller dans **Settings > Pages** et activer GitHub Pages sur la branche `gh-pages`.
3. L'action se déclenche automatiquement **5 minutes après le framework** (`cron: 5 * * * *`).

## Stack technique

| Outil | Rôle |
|---|---|
| Node.js 20 | Runtime |
| `rss-parser` | Lecture du `feed.xml` en entrée |
| `crypto` (stdlib) | Génération des IDs stables |
| GitHub Actions | Exécution horaire |
| GitHub Pages | Hébergement du `feed-enriched.json` |

## Projets liés

| Étape | Dépôt | Rôle |
|---|---|---|
| 1 | [flux-rss-framework](https://github.com/POWLAIR/flux-rss-framework) | Collecte les sources RSS → `feed.xml` |
| 3 | [flux-rss-site](https://github.com/POWLAIR/flux-rss-site) | Site de veille qui affiche le feed enrichi |
