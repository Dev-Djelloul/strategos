# 🌍 Strategos

Globe 3D interactif des conflits et tensions géopolitiques actuels, construit
pour apprendre la géo-visualisation de données et l'intégration d'API open
data — backend FastAPI, globe CesiumJS, données ACLED.

## Fonctionnalités

- **Globe 3D interactif** — CesiumJS, imagerie OpenStreetMap (aucune clé API
  requise pour le globe lui-même), points cliquables avec détail
- **Données** — [ACLED](https://acleddata.com/) (Armed Conflict Location &
  Event Data), données qualifiées et documentées sur les événements de
  conflit dans le monde. Inscription gratuite requise (usage
  non-commercial/académique)
- **Filtres** — par pays et par type d'événement (catégories réelles ACLED :
  batailles, violence contre civils, explosions, manifestations,
  développements stratégiques)
- **Mode démo** — jeu de données factice pour développer/démontrer l'UI sans
  compte ACLED ni dépendance réseau
- **Fallback automatique** — si ACLED est indisponible ou les identifiants
  absents, bascule silencieusement sur les données démo plutôt que de casser

## Configurer ACLED

1. Crée un compte gratuit sur https://acleddata.com/myacled
2. Copie `.env.example` en `.env` et renseigne ton email/mot de passe :
   ```bash
   cp .env.example .env
   ```
3. Édite `.env` avec tes identifiants (ce fichier est ignoré par git, ne le
   commit jamais)

Sans configuration, l'app fonctionne quand même en mode démo/fallback.

## Architecture

```
app/
  main.py              # routes FastAPI (page + API JSON)
  services/
    acled.py           # client ACLED (OAuth + requêtes)
    demo_data.py        # données factices (mode démo / fallback)
  templates/index.html # page globe CesiumJS
  static/app.js         # logique globe (fetch + rendu des points)
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

- [ ] Historique / timeline des événements (pas seulement l'instantané)
- [ ] Couches supplémentaires sur le globe (zones de contrôle, routes
  logistiques, bases militaires — data à définir)
- [ ] Déploiement (Cloudflare Pages / Workers pour le frontend, backend à
  héberger)
