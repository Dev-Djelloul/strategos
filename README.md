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
- **Navigation 3D** — recherche de lieux (loupe), 11 régions pré-cadrées en
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

### ACLED (conflits)

1. Crée un compte sur https://acleddata.com/user/register
2. Copie `.env.example` en `.env` et renseigne ton email/mot de passe ACLED
3. **Le niveau d'accès conditionne l'API** : une adresse générique (gmail…)
   reçoit le niveau *Open* (données agrégées seulement, pas d'événements
   → erreur 403). Les événements détaillés (décalés d'environ une semaine)
   nécessitent le niveau *Research* ou supérieur, attribué selon le domaine
   email de l'organisation, ou sur demande à access@acleddata.com
   (licences : licensing@acleddata.com). Tant que l'accès n'est pas
   accordé, la couche indique « indisponible ».

### UCDP (conflits, référence académique)

Jeton gratuit à demander par email à mertcan.yilmaz@pcr.uu.se, puis dans `.env` :
`UCDP_ACCESS_TOKEN=...` (version du jeu de données : `UCDP_GED_VERSION`).

### GDELT (conflits, presse mondiale)

Aucune configuration : fichiers publics toutes les 15 min. Données
détectées automatiquement dans la presse, **non vérifiées** (violence
matérielle, localisée à la ville/région, ≥ 2 sources), agrégées par lieu.
Mises en cache dans `.cache/`.

### Cesium Ion (relief du globe, optionnel)

1. Crée un compte gratuit sur https://ion.cesium.com/signup
2. Génère un token d'accès (Access Tokens dans le dashboard)
3. Ajoute-le à `.env` : `CESIUM_ION_TOKEN=...`

Sans token Cesium Ion, le globe reste plat (ellipsoïde) mais reste
pleinement fonctionnel - le relief est un bonus visuel, pas un prérequis.

```bash
cp .env.example .env
# puis édite .env avec tes identifiants
```

`.env` est ignoré par git - ne jamais y committer de vrais identifiants.

## Architecture

```
app/
  main.py              # routes FastAPI (page + API JSON)
  services/
    acled.py           # client ACLED (OAuth + requêtes)
    ucdp.py            # client UCDP GED (jeton requis)
    conflicts.py       # fusion des sources + niveau de fiabilité
    gdelt.py           # client GDELT 2.0 (fichiers 15 min, cache disque)
    nuclear.py          # client Wikidata (sites nucléaires civils)
    overpass.py         # client générique Overpass (OpenStreetMap)
    military.py         # requête Overpass : bases militaires
    infrastructure.py   # requête Overpass : aéroports/ports/énergie
  templates/index.html # page globe CesiumJS
  static/app.js         # logique globe (fetch + rendu des couches)
  static/style.css
scripts/
  test_acled_auth.py   # diagnostic auth ACLED (hors app, usage manuel)
```

## Démarrage

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

Puis ouvrir http://127.0.0.1:8000

## Roadmap

- [x] Timeline des événements (curseur + lecture sur la période choisie)
- [ ] Historique long terme (au-delà de 30 jours, pas seulement l'instantané)
- [ ] Zones de contrôle territorial (pas de source ouverte identifiée pour
  l'instant - à rechercher)
- [ ] Déploiement (Cloudflare Pages / Workers pour le frontend, backend à
  héberger)
