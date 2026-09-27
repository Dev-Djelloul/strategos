# 🌍 Strategos

Globe 3D interactif des conflits et tensions géopolitiques actuels, construit
pour apprendre la géo-visualisation de données et l'intégration d'API open
data — backend FastAPI, globe CesiumJS, plusieurs couches de données.

## Fonctionnalités

- **Globe 3D interactif** — CesiumJS, imagerie satellite + frontières + routes
  (Esri, gratuit sans clé), relief mondial optionnel (Cesium World Terrain,
  nécessite un compte Cesium Ion gratuit), jour/nuit en temps réel
- **Horloge mondiale** — UTC + fuseaux stratégiques, intégrée à la barre
  d'outils
- **Bannière d'état et page `/methodologie`** — la bannière dit ce qui
  alimente le globe et signale l'absence de source qualifiée ; la page
  détaille sources, fraîcheur, licences, règles de fusion et limites
  (générée depuis `services/sources_info.py`)
- **Contrôle territorial (Ukraine, prototype)** — localités sous contrôle russe
  ou contestées et changements de main récents, d'après VIINA (ODbL).
  Estimation issue d'un vote entre sources, pas une ligne de front ; fichier
  statique produit par `worker/scripts/build_control.py` — recherche de lieux (loupe), 11 régions pré-cadrées en
  vue inclinée, et « Villes 3D photoréalistes » (Google Photorealistic 3D
  Tiles via Cesium Ion, nécessite le token)
- **Sources de conflits fusionnées** — ACLED, UCDP et GDELT sont regroupés
  (< 30 km, < 3 jours) en un seul marqueur avec un niveau de fiabilité :
  *confirmé* (≥ 2 sources dont une qualifiée), *qualifié*, ou *presse seule*
  (non vérifié, plus discret). Chaque source échoue indépendamment
- **Couche conflits (ACLED)** — [ACLED](https://acleddata.com/), données qualifiées
  sur les événements de conflit. Inscription gratuite requise ; l'accès API
  est en plus soumis à validation manuelle par ACLED (délai variable)
- **Couche sites nucléaires** — installations civiles déclarées (centrales,
  sites sous garanties AIEA), source [Wikidata](https://www.wikidata.org/)
  (SPARQL public, sans clé). Volontairement limité aux sites civils publics
  et documentés
- **Couche bases militaires** — sites nommés et publics (source:
  OpenStreetMap/Overpass)
- **Couche infrastructures** — aéroports internationaux, ports, énergie hors
  nucléaire (source: OpenStreetMap/Overpass)
- **Données réelles uniquement** — aucune donnée factice : si une source est
  indisponible, la couche l'indique (badge « indisponible » + cause au
  survol) au lieu d'afficher de fausses données. Chaque couche affiche le
  nombre d'éléments réels et l'heure de mise à jour

## Configurer les sources de données

### ACLED (non intégré)

Envisagé, mais **retiré de l'interface** : son API d'événements n'est plus
ouverte aux adresses email personnelles (confirmé par l'équipe ACLED),
seulement académiques/institutionnelles. Le code (`worker/src/sources/acled.ts`,
route `/api/events`) reste disponible pour un usage manuel ou une
réactivation future — il suffirait de reposer les secrets `ACLED_EMAIL` /
`ACLED_PASSWORD` et de rajouter `acled` dans `DEFAULT_SOURCES`
(`worker/src/conflicts.ts`) et dans les toggles du front (`public/index.html`,
`EVENT_SOURCES` dans `public/static/app.js`).

### UCDP (conflits, référence académique)

Jeton gratuit à demander par email à mertcan.yilmaz@pcr.uu.se, puis secret
`UCDP_ACCESS_TOKEN` (5 000 requêtes/jour). Les versions « candidate »
mensuelles (26.0.N, ~2 semaines de décalage) sont découvertes
automatiquement et mises en cache 6 h ; `UCDP_GED_VERSION` permet de les
imposer (liste séparée par des virgules).

### GDELT (conflits, presse mondiale)

Aucune configuration : fichiers publics toutes les 15 min. Données
détectées automatiquement dans la presse, **non vérifiées** (violence
matérielle, localisée à la ville/région, ≥ 2 sources), agrégées par lieu.
Mises en cache dans `.cache/`.

### Cesium Ion (relief du globe, optionnel)

1. Crée un compte gratuit sur https://ion.cesium.com/signup
2. Génère un token d'accès (Access Tokens dans le dashboard)
3. Renseigne-le dans le secret `CESIUM_ION_TOKEN` (`.dev.vars` en local)

Sans token, le globe reste plat (ellipsoïde) mais pleinement fonctionnel ;
le relief, la recherche de lieux et les villes 3D en dépendent.

Les secrets ne sont jamais committés (`.dev.vars` est ignoré par git).

## Architecture

Un seul projet Cloudflare (`worker/`) : un **Worker TypeScript** pour l'API et
les pages générées, et des **assets statiques** pour le globe.

```
worker/
  wrangler.jsonc        # assets, KV (CACHE), cron toutes les 15 min
  public/               # globe CesiumJS (index.html, static/app.js, style.css)
  src/
    index.ts            # routeur : /api/*, /methodologie, /config.js, cron
    conflicts.ts        # fusion ACLED + UCDP + GDELT, niveaux de fiabilité
    cache.ts            # cache KV + repli sur la dernière donnée réelle
    zip.ts              # lecture des archives ZIP GDELT
    methodology.ts      # page Sources et méthodologie
    sourcesInfo.ts      # métadonnées des sources (licences, fraîcheur…)
    sources/            # acled, ucdp, gdelt, overpass, military,
                        # infrastructure, nuclear
  test/                 # tests unitaires (npm test)
```

GDELT est collecté **en continu** par le cron (chaque fichier de 15 min est
filtré, agrégé et stocké dans KV par jour) : l'historique commence donc à
la mise en service, et une requête ne lit que quelques blobs.

## Démarrage local

```bash
cd worker
npm install
# Secrets locaux (jamais committés) : ACLED_EMAIL, ACLED_PASSWORD,
# UCDP_ACCESS_TOKEN, CESIUM_ION_TOKEN
cp .dev.vars.example .dev.vars
npx wrangler dev          # http://localhost:8787
npm test                  # tests unitaires
```

## Déploiement Cloudflare

Déployé sur https://strategos.djelloulabid75.workers.dev (usage personnel).

```bash
cd worker
npx wrangler kv namespace create strategos-cache  # copier l'id dans wrangler.jsonc
npx wrangler secret put CESIUM_ION_TOKEN    # + ACLED_EMAIL, ACLED_PASSWORD, UCDP_ACCESS_TOKEN
npx wrangler deploy
```

Les limites de CPU du plan Workers Free (10 ms/requête) sont serrées pour
la collecte GDELT ; le plan Workers Paid est recommandé.

## Mettre à jour le contrôle territorial

Le fichier `worker/public/data/ukraine-control.json` est un instantané produit
hors du Worker (les données VIINA pèsent ~450 Mo en CSV), **automatisé** par
`.github/workflows/update-control.yml` : tous les jours à 05:00 UTC, il
régénère le fichier, le committe s'il a changé, puis redéploie le Worker.

Nécessite le secret de dépôt GitHub `CLOUDFLARE_API_TOKEN` (jeton avec accès
"Edit Cloudflare Workers"). Déclenchement manuel possible depuis l'onglet
Actions du dépôt (`workflow_dispatch`). Pour relancer à la main :

```bash
cd worker && python3 scripts/build_control.py   # puis npx wrangler deploy
```

Attribution VIINA obligatoire (ODbL). Le contrôle territorial est branché sur
la timeline : à une date antérieure au dernier changement d'une localité,
son statut précédent est utilisé (seul le tout dernier changement de chaque
localité est conservé — voir la remarque dans `scripts/build_control.py`).

## Roadmap

- [x] Timeline des événements (curseur + lecture sur la période choisie)
- [ ] Historique long terme (au-delà de 30 jours, pas seulement l'instantané)
- [~] Zones de contrôle territorial : prototype Ukraine (VIINA). Pas de
  source ouverte trouvée pour les autres conflits ; demandes d'accès
  DeepStateMap / ISW en cours
- [x] Backend et frontend sur Cloudflare (Worker + assets) — à déployer
