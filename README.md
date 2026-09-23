# 🗺️ Strategos

Carte interactive des conflits et tensions géopolitiques actuels, construite
pour apprendre la géo-visualisation de données et l'intégration d'API open
data — backend FastAPI, carte Leaflet, sans clé API pour démarrer.

## Fonctionnalités (MVP)

- **Carte interactive** — fond de carte sombre, marqueurs cliquables par zone
- **Données ouvertes** — [GDELT GEO 2.0 API](https://blog.gdeltproject.org/gdelt-geo-2-0-api-debuts/)
  (gratuite, sans inscription), événements géolocalisés des dernières 24h/7j
- **Mode démo** — jeu de données factice pour développer/démontrer l'UI sans
  dépendance réseau externe

## Architecture

```
app/
  main.py              # routes FastAPI (page + API JSON)
  services/
    gdelt.py           # client GDELT GEO 2.0
    demo_data.py        # données factices (mode démo)
  templates/index.html # page Leaflet
  static/app.js         # logique carte (fetch + rendu des marqueurs)
  static/style.css
```

## Démarrage

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

Puis ouvrir http://127.0.0.1:8000

## Roadmap

- [ ] Filtres par type d'événement (CAMEO codes) et par pays
- [ ] Historique / timeline des événements (pas seulement l'instantané)
- [ ] Source alternative ACLED (données plus qualifiées, clé API requise)
- [ ] Déploiement (Cloudflare Pages / Workers pour le frontend, backend à héberger)
