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
- **Couche conflits** — [ACLED](https://acleddata.com/), données qualifiées
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
- **Mode démo forcé** — bascule toutes les couches sur des données factices,
  sans appel réseau
- **Fallback automatique** — si une source échoue (identifiants absents,
  service en panne), chaque couche bascule silencieusement sur ses données
  démo plutôt que de casser l'app ; un badge à côté de chaque case à cocher
  indique toujours si la couche affichée est **live** ou **démo** (forcé ou
  suite à un repli), avec le détail au survol

## Configurer les sources de données

### ACLED (conflits)

1. Crée un compte gratuit sur https://acleddata.com/myacled
2. Copie `.env.example` en `.env` et renseigne ton email/mot de passe ACLED
3. L'accès à l'API ACLED nécessite en plus une validation manuelle par leur
   équipe (indépendante de l'inscription) - en attendant, la couche
   fonctionne en mode démo/fallback

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
    demo_data.py        # données factices conflits (mode démo / fallback)
    nuclear.py          # client Wikidata (sites nucléaires civils)
    nuclear_demo_data.py # données factices nucléaire (fallback)
    overpass.py         # client générique Overpass (OpenStreetMap)
    military.py         # requête Overpass : bases militaires
    military_demo_data.py
    infrastructure.py   # requête Overpass : aéroports/ports/énergie
    infrastructure_demo_data.py
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

- [ ] Historique / timeline des événements (pas seulement l'instantané)
- [ ] Zones de contrôle territorial (pas de source ouverte identifiée pour
  l'instant - à rechercher)
- [ ] Déploiement (Cloudflare Pages / Workers pour le frontend, backend à
  héberger)
