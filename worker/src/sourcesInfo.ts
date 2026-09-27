/** Métadonnées descriptives des sources (page Méthodologie). Une seule
 * source de vérité : la page est générée depuis ces listes, et l'état de
 * configuration est lu à l'exécution (jamais supposé). */
import type { Env } from "./types.ts";

export interface ConflictSourceInfo {
  key: string;
  name: string;
  full: string;
  url: string;
  reliability: "verified" | "press";
  kind: string;
  freshness: string;
  coverage: string;
  license: string;
  access: string;
  secrets: (keyof Env)[];
}

// ACLED a été envisagé (voir NOT_INTEGRATED ci-dessous) mais n'est plus
// interrogé : son API d'événements n'est plus accessible aux adresses email
// personnelles, seulement académiques/institutionnelles.
export const CONFLICT_SOURCES: ConflictSourceInfo[] = [
  {
    key: "ucdp",
    name: "UCDP GED",
    full: "Uppsala Conflict Data Program — Georeferenced Event Dataset",
    url: "https://ucdp.uu.se/",
    reliability: "verified",
    kind: "Jeu de données académique évalué par des pairs, événements de violence organisée",
    freshness: "Versions « candidate » mensuelles, environ 2 semaines de décalage (la version annuelle a ~9 mois de retard)",
    coverage: "Mondiale",
    license: "CC BY 4.0 — citer Sundberg & Melander (2013), Journal of Peace Research 50(4)",
    access: "Jeton d'accès gratuit, sur demande auprès de l'équipe UCDP",
    secrets: ["UCDP_ACCESS_TOKEN"],
  },
  {
    key: "gdelt",
    name: "GDELT",
    full: "Global Database of Events, Language, and Tone",
    url: "https://www.gdeltproject.org/",
    reliability: "press",
    kind: "Extraction automatique d'événements dans la presse mondiale — non vérifiée",
    freshness: "Toutes les 15 minutes (historique depuis le début de la collecte)",
    coverage: "Mondiale, très inégale selon la couverture médiatique",
    license: "Libre d'usage, citation du projet GDELT demandée",
    access: "Aucun compte requis",
    secrets: [],
  },
];

export interface NotIntegratedSource {
  name: string;
  url: string;
  reason: string;
}

export const NOT_INTEGRATED_SOURCES: NotIntegratedSource[] = [
  {
    name: "ACLED (Armed Conflict Location & Event Data)",
    url: "https://acleddata.com/",
    reason:
      "Source de référence, très riche (des dizaines de types d'événements, y compris manifestations et violences mineures, codés à la main). Mais son API d'événements n'est plus accessible aux adresses email personnelles, seulement aux adresses académiques ou institutionnelles (confirmé par l'équipe ACLED). Le niveau public restant (« Open ») ne fournit que des données agrégées, pas d'événements individuels géolocalisés.",
  },
  {
    name: "POLECAT (successeur d'ICEWS)",
    url: "https://dataverse.harvard.edu/dataverse/POLECAT",
    reason:
      "Événements géolocalisés générés par apprentissage automatique (ontologie PLOVER), financé par le Program on Geostrategic Risk (ex-Political Instability Task Force, CIA). Présenté dans sa documentation comme mis à jour à l'heure/à la semaine, mais en pratique à l'arrêt : le dernier fichier publié sur Dataverse date d'août 2024 (vérifié via l'API Dataverse). Écarté pour éviter d'afficher des données obsolètes comme si elles étaient courantes.",
  },
  {
    name: "ICEWS (Integrated Crisis Early Warning System)",
    url: "https://dataverse.harvard.edu/dataverse/icews",
    reason:
      "Projet historique dont POLECAT est le successeur direct. Arrêté officiellement le 11 avril 2023 : plus aucune mise à jour.",
  },
  {
    name: "Global Terrorism Database (GTD)",
    url: "https://www.start.umd.edu/gtd/",
    reason:
      "Périmètre limité au terrorisme (hors combats conventionnels, manifestations, etc.) et mise à jour annuelle avec 1 à 2 ans de retard — inadapté à une carte se voulant proche du temps réel.",
  },
];

export const LAYER_SOURCES = [
  {
    name: "Sites nucléaires civils",
    provider: "Wikidata",
    url: "https://www.wikidata.org/",
    freshness: "Cache 24 h",
    license: "CC0",
    note: "Centrales et sites civils déclarés uniquement. Base collaborative, non exhaustive.",
  },
  {
    name: "Bases militaires",
    provider: "OpenStreetMap (Overpass)",
    url: "https://www.openstreetmap.org/",
    freshness: "Cache 6 h",
    license: "ODbL — © contributeurs OpenStreetMap",
    note: "Sites nommés et publics uniquement. Base collaborative, non exhaustive.",
  },
  {
    name: "Infrastructures",
    provider: "OpenStreetMap (Overpass)",
    url: "https://www.openstreetmap.org/",
    freshness: "Cache 6 h",
    license: "ODbL — © contributeurs OpenStreetMap",
    note: "Aéroports internationaux, ports, centrales électriques non nucléaires.",
  },
];

export const CONTROL_SOURCES = [
  {
    name: "Contrôle territorial (Ukraine)",
    provider: "VIINA 2.0 — Université Notre-Dame",
    url: "https://github.com/zhukovyuri/VIINA",
    freshness: "Instantané quotidien (fichier statique)",
    license: "ODbL 1.0 — attribution obligatoire",
    note:
      "Statut par localité (russe / contesté), avec les changements de main des 90 derniers jours, issu d'un vote entre DeepStateMap, ISW, Wikipédia et des rapports de presse. C'est une estimation, pas une ligne de front officielle.",
  },
  {
    name: "Contrôle territorial (Yémen)",
    provider: "ACAPS — Yemen Analysis Hub",
    url: "https://data.humdata.org/dataset/yemen-areas-of-control",
    freshness: "Mise à jour environ trimestrielle (fichier statique)",
    license: "CC BY 4.0 — attribution obligatoire",
    note:
      "Polygone de contrôle par district (admin2 : IRG, gouvernement internationalement reconnu, ou DFA, autorités de facto/Ansar Allah). Recherché mais non trouvé pour les autres conflits suivis (Mali, Iran, Soudan, Syrie, Afghanistan, Irak) : les sources disponibles n'ont ni méthodologie déclarée ni licence de réutilisation.",
  },
];

export const BASEMAP_CREDITS: [string, string][] = [
  ["Imagerie satellite et calques de référence", "Esri, Maxar, Earthstar Geographics"],
  ["Relief mondial", "Cesium World Terrain (Cesium ion)"],
  ["Villes 3D photoréalistes", "Google Photorealistic 3D Tiles, via Cesium ion — soumis aux conditions de Google"],
  ["Moteur 3D", "CesiumJS"],
];

export const isConfigured = (env: Env, s: ConflictSourceInfo): boolean => s.secrets.every((k) => Boolean(env[k]));
